"""Component + layout extraction.

For each page we produce two structured views:

1. `components_used` — flat sorted list of PascalCase components actually
   rendered. Drives context-aware transformation ("this page uses Sidebar
   + Card + Table") so the transformer doesn't rewrite blind.

2. `layout_tree` — a trimmed hierarchy of layout/container elements +
   rendered components. Tags like <div> that are pure wrappers are kept
   for structure; text children and prop literals are discarded.

The parser is a best-effort JSX tokenizer built on regex and a bracket
counter. It is NOT a full AST. It handles:
    - Self-closing tags: <Foo />, <br/>, <img src="..." />
    - Paired tags: <main>...</main>
    - Fragments: <>...</>  and <React.Fragment>...</React.Fragment>
    - Tag attributes with JSX expressions: className={cx(...)}, style={{...}}
    - Nested JSX inside props: element={<Foo/>}

Things it deliberately does NOT handle (and ignores rather than guesses):
    - Computed tag names: <Tag />  where Tag is a variable
    - TS generics on components: <Foo<T>>...</Foo>  (parses as <Foo)
    - Template literals inside JSX children — fine, we just skip text
    - Commented-out JSX — not stripped; may produce ghost nodes

That's acceptable: component extraction is a hint for the transformer,
not a contract. False positives are cheap, false negatives mean the
transformer has slightly less context.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


# Max depth we descend into the JSX tree. Anything beyond this is
# flattened into "children: [...]" summaries — we want a digest, not a
# full parse. 4 levels covers 99% of real pages (main → section → card → content).
_MAX_DEPTH = 4

# Max children we record per node. Prevents a loop-rendered list of 500
# items from bloating the payload.
_MAX_CHILDREN_PER_NODE = 20

# Layout-ish HTML tags we always keep in the tree; other lowercase tags
# (span, p, h1, img, a, etc.) are omitted unless they contain components,
# to keep the tree focused on structure rather than content.
_STRUCTURAL_HTML_TAGS = frozenset((
    "main", "section", "header", "nav", "article", "footer", "aside",
    "div", "form", "ul", "ol", "table", "dialog",
))

# Self-closing HTML elements we know about. A tag like <br /> should never
# be considered "open" when we scan for matching closers.
_VOID_HTML_TAGS = frozenset((
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "source", "track", "wbr",
))


# ── Public types ───────────────────────────────────────────────────────

@dataclass
class LayoutNode:
    """A node in the extracted layout tree.

    Serializes to a plain dict via `to_dict()` for pydantic/JSON output.
    """
    tag: str
    is_component: bool
    children: list["LayoutNode"] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "tag": self.tag,
            "is_component": self.is_component,
            "children": [c.to_dict() for c in self.children],
        }


@dataclass
class ExtractionResult:
    """What component extraction returns for a single page."""
    components_used: list[str]
    layout_tree: list[dict]  # already-serialized for downstream consumers

    def to_dict(self) -> dict:
        return {
            "components_used": list(self.components_used),
            "layout_tree": list(self.layout_tree),
        }


# ── Public API ─────────────────────────────────────────────────────────

def extract_components(content: str) -> ExtractionResult:
    """Return components + layout tree for a single page's source.

    Pure function. Deterministic: same input string → same output, always.
    """
    if not content:
        return ExtractionResult(components_used=[], layout_tree=[])

    # Strip strings + comments once; both the flat component list and the
    # tree parser share this view so JSX that appears inside a string
    # ("Click <Header/>") or a comment never counts.
    trimmed = _strip_strings_and_comments(content)

    components = sorted({
        name for name in re.findall(r"<([A-Z][A-Za-z0-9]*)[\s/>]", trimmed)
        if name not in ("Fragment", "React")
    })

    roots = _parse_jsx_trees_prepared(trimmed)
    layout_tree = [r.to_dict() for r in roots]

    return ExtractionResult(
        components_used=components,
        layout_tree=layout_tree,
    )


# ── Parser internals ───────────────────────────────────────────────────

def _parse_jsx_trees_prepared(trimmed: str) -> list[LayoutNode]:
    """Parse JSX trees from already-stripped content.

    Callers that have already stripped strings + comments pass that form
    directly to avoid doing it twice (extract_components shares it with
    the flat component scan).
    """
    roots: list[LayoutNode] = []
    i = 0
    n = len(trimmed)
    while i < n:
        m = _OPEN_TAG_RE.search(trimmed, i)
        if not m:
            break
        # A JSX opening tag is only valid in expression position. Cheap
        # check: the previous non-space char should be one of `={(,;` or
        # return/yield keywords. Anything else and we skip past.
        if not _is_jsx_position(trimmed, m.start()):
            i = m.end()
            continue
        node, end = _parse_element(trimmed, m.start())
        if node is not None:
            roots.append(node)
            i = end
        else:
            i = m.end()
    return roots


_OPEN_TAG_RE = re.compile(r"<([A-Za-z][A-Za-z0-9.]*)")


def _parse_element(src: str, start: int, depth: int = 0) -> tuple[LayoutNode | None, int]:
    """Parse one JSX element starting at `src[start]`. Returns (node, end_idx).

    `end_idx` is the index *past* the closing tag (or past the self-close).
    Returns (None, start) if we can't make sense of it — caller advances
    past and continues.
    """
    m = _OPEN_TAG_RE.match(src, start)
    if not m:
        return None, start
    tag = m.group(1)

    # Walk past the attributes, tracking { } nesting so JSX expressions
    # inside props don't confuse us.
    i, self_close = _scan_to_open_end(src, m.end())
    if i == -1:
        return None, start
    # `i` now points at the '>' ending the open tag (or '/' of '/>').

    is_component = _is_component_name(tag)
    keep_node = is_component or tag in _STRUCTURAL_HTML_TAGS

    if self_close or tag in _VOID_HTML_TAGS:
        node = LayoutNode(tag=tag, is_component=is_component) if keep_node else None
        # Advance past the '>'.
        end = i + 1
        return node, end

    # Paired tag: walk children until the matching closer.
    cursor = i + 1  # past '>'
    children: list[LayoutNode] = []
    while cursor < len(src):
        close_m = re.match(rf"</\s*{re.escape(tag)}\s*>", src[cursor:])
        if close_m:
            cursor += close_m.end()
            break
        # Child could be nested JSX, a text run, or an expression {}.
        child_open = _OPEN_TAG_RE.match(src, cursor)
        if child_open and _is_jsx_position(src, cursor):
            child, new_cursor = _parse_element(src, cursor, depth + 1)
            if child and depth < _MAX_DEPTH and len(children) < _MAX_CHILDREN_PER_NODE:
                children.append(child)
            # Defensive: if the child parser couldn't advance, skip one char
            # to avoid an infinite loop on malformed input.
            if new_cursor <= cursor:
                cursor += 1
            else:
                cursor = new_cursor
            continue
        # Expression block `{...}` — skip with brace counter.
        if src[cursor] == "{":
            cursor = _skip_balanced(src, cursor, "{", "}")
            continue
        # JSX fragment close `</>` — end of an outer fragment, not ours.
        if src.startswith("</>", cursor):
            cursor += 3
            break
        cursor += 1

    if not keep_node:
        # The node itself isn't structural, but it may wrap components.
        # Bubble children up by returning them as a synthetic list — but
        # we only return a single node, so wrap in a <div> placeholder only
        # if there are children worth surfacing. Otherwise drop.
        if children:
            return LayoutNode(tag="div", is_component=False, children=children), cursor
        return None, cursor

    return LayoutNode(tag=tag, is_component=is_component, children=children), cursor


def _scan_to_open_end(src: str, start: int) -> tuple[int, bool]:
    """From inside the opening tag's attr section, find the closing '>' .

    Returns (index_of_gt, is_self_closing). Returns (-1, False) on malformed
    input (unterminated tag).
    """
    i = start
    n = len(src)
    depth_brace = 0
    in_string = ""  # '"' or "'" or '`' when inside a literal, else ""
    while i < n:
        ch = src[i]
        if in_string:
            if ch == "\\" and i + 1 < n:
                i += 2
                continue
            if ch == in_string:
                in_string = ""
            i += 1
            continue
        if ch in ('"', "'", "`"):
            in_string = ch
            i += 1
            continue
        if ch == "{":
            depth_brace += 1
            i += 1
            continue
        if ch == "}":
            depth_brace = max(0, depth_brace - 1)
            i += 1
            continue
        if depth_brace == 0:
            if ch == "/" and i + 1 < n and src[i + 1] == ">":
                return i + 1, True  # self-close: return the '>' index
            if ch == ">":
                return i, False
        i += 1
    return -1, False


def _skip_balanced(src: str, start: int, open_ch: str, close_ch: str) -> int:
    """Advance past a balanced {...} block, respecting strings + nesting."""
    depth = 0
    in_string = ""
    i = start
    n = len(src)
    while i < n:
        ch = src[i]
        if in_string:
            if ch == "\\" and i + 1 < n:
                i += 2
                continue
            if ch == in_string:
                in_string = ""
            i += 1
            continue
        if ch in ('"', "'", "`"):
            in_string = ch
            i += 1
            continue
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n  # unterminated — advance to EOF so we don't loop forever


def _is_component_name(tag: str) -> bool:
    """PascalCase → component. Dotted members (Foo.Bar) also treated as components."""
    head = tag.split(".")[0]
    return bool(head) and head[0].isupper()


def _is_jsx_position(src: str, pos: int) -> bool:
    """Heuristic: is `<` at `pos` a JSX tag rather than less-than?

    Looks at the previous non-whitespace character. JSX can legally follow:
        =  (  ,  {  [  ;  &&  ||  ?  :  =>  return  yield
    Anything else (e.g. an identifier) and it's almost certainly a
    comparison operator.
    """
    j = pos - 1
    while j >= 0 and src[j] in " \t\n\r":
        j -= 1
    if j < 0:
        return True  # start-of-file JSX (common in snippets)
    ch = src[j]
    if ch in "=({[,;&|?:+*/%!<>~\n":
        return True
    # Arrow `=>` — back up one more.
    if ch == ">" and j > 0 and src[j - 1] == "=":
        return True
    # Keyword? Look at the preceding word.
    k = j
    while k >= 0 and (src[k].isalnum() or src[k] == "_"):
        k -= 1
    word = src[k + 1: j + 1]
    return word in ("return", "yield", "await", "throw")


# ── String/comment stripping ───────────────────────────────────────────

def _strip_strings_and_comments(src: str) -> str:
    """Replace string literals and comments with same-length spaces.

    Preserves offsets (so error/debug output still aligns to the original
    source), but removes the content so our regex scanners can't
    accidentally match JSX inside strings or comments.
    """
    out = list(src)
    i = 0
    n = len(src)
    while i < n:
        ch = src[i]
        # Line comment.
        if ch == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            if j == -1:
                j = n
            for k in range(i, j):
                if out[k] != "\n":
                    out[k] = " "
            i = j
            continue
        # Block comment.
        if ch == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            if j == -1:
                j = n
            else:
                j += 2
            for k in range(i, j):
                if out[k] != "\n":
                    out[k] = " "
            i = j
            continue
        # String / template.
        if ch in ('"', "'", "`"):
            quote = ch
            j = i + 1
            while j < n:
                if src[j] == "\\" and j + 1 < n:
                    j += 2
                    continue
                if src[j] == quote:
                    j += 1
                    break
                j += 1
            for k in range(i + 1, min(j - 1, n)):
                if out[k] != "\n":
                    out[k] = " "
            i = j
            continue
        i += 1
    return "".join(out)
