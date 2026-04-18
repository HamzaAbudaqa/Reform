"""Edit Lab service.

Loads the current (untransformed) website from a GitHub repo, detects
selectable sections on the rendered page, and applies section-scoped AI edits
to the source. Uses a persistent workspace (edit_lab_workspace) so repeated
edits in one session skip the clone/install/boot cycle.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import re
import uuid
from typing import Any, Optional

import anthropic

from app.services.anthropic_errors import (
    classify_anthropic_error,
    is_anthropic_exception,
    log_and_classify,
)
from app.services.edit_lab_workspace import (
    EditLabSession,
    create_session,
    get_registry,
)
from app.services.page_discovery import discover_pages

logger = logging.getLogger(__name__)


SECTION_DETECTION_SCRIPT = r"""
() => {
  // Three-tier detection so dashboards with lots of non-semantic markup
  // still produce selectable targets for drag-rectangle selection.
  //
  //   Tier 1 (semantic): the classic six landmark/structural tags.
  //   Tier 2 (content):  forms, tables, articles, lists, figures and any
  //                      div with a class hint suggesting it's a card /
  //                      panel / widget / group / stats block.
  //   Tier 3 (interactive): buttons, anchors, and role="button" elements
  //                      so small action targets still get a hit-box.
  const primarySelector = 'header, nav, main > *, section, footer, aside, article, form, figure, [data-section]';
  const contentClassHints = /\b(card|panel|widget|stats?|metric|tile|box|group|grid|shelf|toolbar|banner|hero|feature|cta|footer|header|sidebar)\b/i;
  const seen = new Set();
  const candidates = [];

  const pushCandidate = (el, tierMinW, tierMinH) => {
    if (seen.has(el)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < tierMinW || rect.height < tierMinH) return;
    seen.add(el);
    candidates.push({ el, rect });
  };

  document.querySelectorAll(primarySelector).forEach(el => pushCandidate(el, 120, 60));

  document.querySelectorAll('form, table, ul, ol, figure, article').forEach(el => pushCandidate(el, 100, 48));

  document.querySelectorAll('div, section').forEach(el => {
    const cls = (el.className && el.className.toString ? el.className.toString() : '');
    if (cls && contentClassHints.test(cls)) pushCandidate(el, 100, 48);
  });

  document.querySelectorAll('button, a[href], [role="button"], [role="navigation"], input[type="submit"]').forEach(el => pushCandidate(el, 40, 20));

  const sections = [];
  candidates.forEach((c, idx) => {
    const el = c.el;
    const rect = c.rect;
    const abs = {
      x: Math.round(rect.x + window.scrollX),
      y: Math.round(rect.y + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };

    const tag = el.tagName.toLowerCase();
    const classAttr = (el.className && el.className.toString ? el.className.toString() : '').toLowerCase();
    const dataSec = el.getAttribute('data-section') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';

    let label = dataSec || ariaLabel;
    if (!label) {
      if (tag === 'button' || (el.getAttribute && el.getAttribute('role') === 'button')) {
        const btnText = (el.textContent || '').trim();
        label = btnText ? btnText.slice(0, 32) : 'Button';
      } else if (tag === 'a') {
        const linkText = (el.textContent || '').trim();
        label = linkText ? linkText.slice(0, 32) : 'Link';
      } else if (tag === 'form') label = 'Form';
      else if (tag === 'table') label = 'Table';
      else if (tag === 'ul' || tag === 'ol') label = 'List';
      else if (tag === 'nav' || classAttr.includes('navbar') || classAttr.includes('menubar')) label = 'Navigation';
      else if (tag === 'header' || classAttr.includes('site-header') || classAttr.includes('page-header')) label = 'Header';
      else if (tag === 'footer' || classAttr.includes('footer')) label = 'Footer';
      else if (tag === 'aside' || classAttr.includes('sidebar')) label = 'Sidebar';
      else if (classAttr.includes('hero') || classAttr.includes('banner')) label = 'Hero';
      else if (classAttr.includes('pricing')) label = 'Pricing';
      else if (classAttr.includes('feature')) label = 'Features';
      else if (classAttr.includes('testimonial')) label = 'Testimonials';
      else if (classAttr.includes('cta')) label = 'Call to Action';
      else if (classAttr.includes('faq')) label = 'FAQ';
      else if (classAttr.includes('stats') || classAttr.includes('metric')) label = 'Stats';
      else if (classAttr.includes('gallery')) label = 'Gallery';
      else if (classAttr.includes('contact')) label = 'Contact';
      else if (classAttr.includes('card')) label = 'Card';
      else if (classAttr.includes('panel')) label = 'Panel';
      else if (classAttr.includes('widget')) label = 'Widget';
      else if (classAttr.includes('grid')) label = 'Grid';
      else if (classAttr.includes('toolbar')) label = 'Toolbar';
      else {
        const h = el.querySelector('h1, h2, h3');
        const headingText = h && h.textContent ? h.textContent.trim() : '';
        if (headingText) label = headingText.slice(0, 40);
        else label = tag.charAt(0).toUpperCase() + tag.slice(1) + ' ' + (idx + 1);
      }
    }

    const headingEl = el.querySelector('h1, h2, h3, h4');
    const heading = headingEl ? (headingEl.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120) : '';
    const paragraphEl = el.querySelector('p');
    const paragraph = paragraphEl ? (paragraphEl.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160) : '';
    const fullText = ((el.textContent || '').trim().replace(/\s+/g, ' ')).slice(0, 280);

    const classesRaw = (el.className && el.className.toString ? el.className.toString() : '').trim().slice(0, 240);
    const role = el.getAttribute('role') || '';
    const elementId = el.getAttribute('id') || '';

    sections.push({
      id: 'section-' + idx,
      tag,
      label: (label || 'Section').slice(0, 48),
      rect: abs,
      heading,
      paragraph,
      text: fullText,
      classes: classesRaw,
      role,
      aria_label: ariaLabel,
      element_id: elementId,
    });
  });

  return {
    sections,
    document_size: {
      width: Math.max(document.documentElement.scrollWidth, window.innerWidth),
      height: Math.max(document.documentElement.scrollHeight, window.innerHeight),
    },
  };
}
"""


_SOURCE_EXTS = (".tsx", ".jsx", ".ts", ".js")
_SKIP_DIRS = {"node_modules", ".next", "dist", "build", ".git", "out", "coverage", ".turbo"}

# Section → file mapping scoring thresholds
_MIN_ACCEPT_SCORE = 40

# Tailwind / utility class prefixes we never treat as meaningful component hints.
_UTIL_CLASS_PREFIXES = (
    "p-", "m-", "px-", "py-", "mx-", "my-", "pt-", "pb-", "pl-", "pr-",
    "mt-", "mb-", "ml-", "mr-", "w-", "h-", "min-", "max-", "text-",
    "bg-", "border-", "rounded-", "gap-", "space-", "flex-", "grid-",
    "items-", "justify-", "content-", "place-", "self-", "order-",
    "col-", "row-", "hover:", "focus:", "active:", "group-", "sm:",
    "md:", "lg:", "xl:", "2xl:", "dark:", "ring-", "shadow-", "opacity-",
    "z-", "overflow-", "top-", "bottom-", "left-", "right-", "inset-",
    "scale-", "rotate-", "translate-", "duration-", "ease-", "transition-",
)
_UTIL_CLASS_EXACT = {
    "flex", "grid", "block", "inline", "inline-block", "hidden", "visible",
    "absolute", "relative", "fixed", "sticky", "static", "container",
    "mono", "italic", "underline", "uppercase", "lowercase", "truncate",
    "whitespace-nowrap", "text-left", "text-center", "text-right",
    "cursor-pointer", "cursor-default",
}


def _distinctive_classes(classes: str) -> list[str]:
    """Keep only component/BEM-ish class names, drop Tailwind utilities."""
    if not classes:
        return []
    out: list[str] = []
    for c in classes.split():
        if not c or len(c) < 4:
            continue
        if c in _UTIL_CLASS_EXACT:
            continue
        if any(c.startswith(p) for p in _UTIL_CLASS_PREFIXES):
            continue
        out.append(c)
        if len(out) >= 6:
            break
    return out


def _score_file_for_section(
    rel_path: str,
    content: str,
    heading: str,
    paragraph: str,
    section_label: str,
    classes: str = "",
    role: str = "",
    aria_label: str = "",
) -> int:
    """Higher = better match. Returns 0 if no signal."""
    if not content:
        return 0
    lower = content.lower()
    score = 0

    if heading and len(heading) >= 6:
        h_lower = heading.lower()
        if h_lower in lower:
            score += 100
            # Strong bonus if the heading sits in a JSX text position
            if f">{h_lower}" in lower or f'"{h_lower}"' in lower or f"'{h_lower}'" in lower:
                score += 50
            # Small bonus if it appears inside a heading tag
            if f">{h_lower}</h" in lower:
                score += 30

    if paragraph and len(paragraph) >= 12:
        p_needle = paragraph[:80].lower()
        if p_needle in lower:
            score += 60

    if section_label:
        label_slug = section_label.replace(" ", "").lower()
        if label_slug and len(label_slug) >= 3:
            path_lower = rel_path.lower()
            if label_slug in path_lower:
                score += 30
            # Label appearing as a component name or class
            if (f"<{label_slug}" in lower or f"class{label_slug}" in lower
                    or f'"{label_slug}"' in lower):
                score += 15

    # Distinctive class names — strong signal that this file renders the section
    for cls in _distinctive_classes(classes):
        cl = cls.lower()
        if cl in lower:
            score += 20
            if (f'classname="{cl}' in lower or f"classname='{cl}" in lower
                    or f'"{cl}"' in lower or f"'{cl}'" in lower):
                score += 30
        # Filename match for component-like class names
        if cl in rel_path.lower():
            score += 15

    if aria_label and len(aria_label) >= 4:
        al = aria_label.lower()
        if al in lower:
            score += 45

    if role and len(role) >= 4 and role not in ("button", "link", "text"):
        rl = role.lower()
        if f'role="{rl}"' in lower or f"role='{rl}'" in lower:
            score += 30

    # Penalize files that are clearly not source components
    if rel_path.endswith((".test.tsx", ".test.jsx", ".test.ts", ".test.js",
                         ".stories.tsx", ".stories.jsx", ".spec.ts", ".spec.tsx")):
        score = max(0, score - 60)

    return score


def _find_best_source_file(
    frontend_dir: str,
    heading: str,
    paragraph: str,
    section_label: str,
    classes: str,
    role: str,
    aria_label: str,
    fallback: Optional[str],
) -> Optional[str]:
    """Rank candidate source files and return the highest-scoring one."""
    has_any_signal = any([heading, paragraph, section_label, classes, role, aria_label])
    if not has_any_signal:
        return fallback

    best_score = 0
    best_path: Optional[str] = None
    best_path_len = 0

    for root, dirs, files in os.walk(frontend_dir):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS and not d.startswith(".")]
        for fname in files:
            if not fname.endswith(_SOURCE_EXTS):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
            except Exception:
                continue
            rel = os.path.relpath(fpath, frontend_dir)
            score = _score_file_for_section(
                rel, content, heading, paragraph, section_label,
                classes=classes, role=role, aria_label=aria_label,
            )
            if score <= 0:
                continue
            if score > best_score or (score == best_score and (best_path_len == 0 or len(rel) < best_path_len)):
                best_score = score
                best_path = rel
                best_path_len = len(rel)

    if best_score >= _MIN_ACCEPT_SCORE:
        return best_path
    return fallback


def _assign_source_files(
    sections: list[dict[str, Any]],
    frontend_dir: str,
    fallback: Optional[str],
) -> None:
    """Mutate sections in place, filling in `source_file` via scored lookup."""
    for sec in sections:
        sec["source_file"] = _find_best_source_file(
            frontend_dir,
            heading=sec.get("heading") or "",
            paragraph=sec.get("paragraph") or "",
            section_label=sec.get("label") or "",
            classes=sec.get("classes") or "",
            role=sec.get("role") or "",
            aria_label=sec.get("aria_label") or "",
            fallback=fallback,
        )


_PROMPT_STOPWORDS = {
    "the", "a", "an", "to", "into", "from", "with", "and", "or", "of",
    "in", "on", "at", "this", "that", "these", "those", "it", "its",
    "change", "rename", "replace", "update", "make", "set", "move", "add",
    "remove", "delete", "edit", "modify", "switch", "turn", "fix", "adjust",
    "improve", "refine", "simplify", "cleanup", "clean", "polish", "tweak",
    "word", "words", "text", "label", "button", "section", "block", "area",
    "more", "less", "bigger", "smaller", "larger", "modern", "old", "new",
    "please", "just", "now", "very", "really",
}


def _extract_prompt_anchors(prompt: str) -> list[str]:
    """Pull literal strings the user most likely wants the edit to touch.

    Feeds two things:
      1. Repo text search → the file that actually contains the string wins
         the target over whatever source_file the frontend picked.
      2. A "Literal strings to find and modify" line in the Claude prompt so
         the model has concrete anchors to look for in the file.
    """
    if not prompt:
        return []
    anchors: list[str] = []

    # Quoted strings — strongest signal
    anchors.extend(re.findall(r'"([^"]{2,60})"', prompt))
    anchors.extend(re.findall(r"'([^']{2,60})'", prompt))

    # "change X to Y" / "rename A to B" / "replace A with B"
    for verb in ("change", "rename", "replace"):
        for m in re.finditer(
            rf"\b{verb}\s+(?:the\s+word\s+)?([A-Za-z][A-Za-z0-9_\- ]{{1,40}}?)\s+(?:to|with|into)\b",
            prompt,
            flags=re.IGNORECASE,
        ):
            anchors.append(m.group(1))
            # Also capture the replacement target so we avoid mis-searching for it later
        # "... to Y" — grab Y as a second anchor
        for m in re.finditer(
            rf"\b{verb}\b.*?\b(?:to|with|into)\s+([A-Za-z][A-Za-z0-9_\- ]{{1,40}})",
            prompt,
            flags=re.IGNORECASE,
        ):
            anchors.append(m.group(1))

    # "word X" patterns
    anchors.extend(re.findall(r"\bword\s+([A-Za-z][A-Za-z0-9_\-]{1,40})\b", prompt, flags=re.IGNORECASE))

    # Capitalized standalone words (likely proper nouns like brand names)
    for tok in re.findall(r"\b([A-Z][A-Za-z0-9]{2,})\b", prompt):
        anchors.append(tok)

    # Clean up: strip, dedup case-insensitively, drop stopwords
    seen: set[str] = set()
    out: list[str] = []
    for raw in anchors:
        a = raw.strip().strip('.,;:!?"\'')
        if not a or len(a) < 3:
            continue
        low = a.lower()
        if low in _PROMPT_STOPWORDS:
            continue
        # Skip very common short words even if Capitalized
        if low in seen:
            continue
        seen.add(low)
        out.append(a)
        if len(out) >= 6:
            break
    return out


def _find_best_file_for_anchors(
    frontend_dir: str,
    anchors: list[str],
    current_target: Optional[str],
) -> Optional[str]:
    """Rank source files by how many prompt anchors they literally contain.

    Returns a file path relative to frontend_dir if it's a strictly better
    match than `current_target`, otherwise None. This is the mechanism that
    lets "change the word acme to hamza" retarget the edit from the page
    root file (which only imports <Sidebar />) to components/Sidebar.tsx
    (which actually contains the literal `Acme`).
    """
    if not anchors:
        return None

    needles = [a.lower() for a in anchors if len(a) >= 3]
    if not needles:
        return None

    best_score = 0
    best_path: Optional[str] = None

    for root, dirs, files in os.walk(frontend_dir):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS and not d.startswith(".")]
        for fname in files:
            if not fname.endswith(_SOURCE_EXTS):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
            except Exception:
                continue
            lower = content.lower()
            score = 0
            for n in needles:
                count = lower.count(n)
                if count == 0:
                    continue
                score += 50 + min(count, 5) * 10
                # Extra credit if the string appears inside a JSX text node
                if f">{n}" in lower or f' "{n}"' in lower or f" '{n}'" in lower:
                    score += 30
            if score == 0:
                continue
            rel = os.path.relpath(fpath, frontend_dir)
            # Penalize test / story files
            if rel.endswith((".test.tsx", ".test.jsx", ".test.ts", ".test.js",
                             ".stories.tsx", ".stories.jsx", ".spec.ts", ".spec.tsx")):
                score = max(0, score - 100)
            if score > best_score:
                best_score = score
                best_path = rel

    if best_score >= 60 and best_path and best_path != current_target:
        return best_path
    return None


def _build_discovery_inputs_from_disk(frontend_dir: str) -> tuple[list[dict], list[str]]:
    """Walk the cloned workspace and build (files, file_tree) inputs that match
    the shape `page_discovery.discover_pages` expects."""
    files: list[dict] = []
    file_tree: list[str] = []
    for root, dirs, fnames in os.walk(frontend_dir):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS and not d.startswith(".")]
        for fname in fnames:
            if not fname.endswith(_SOURCE_EXTS):
                continue
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, frontend_dir).replace(os.sep, "/")
            file_tree.append(rel)
            try:
                with open(full, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
            except Exception:
                content = ""
            files.append({"path": rel, "content": content, "size": len(content)})
    return files, file_tree


def _discover_available_pages(sess: EditLabSession) -> list[dict]:
    """Return a list of {name, route, path} dicts for every discoverable page
    in the session's workspace, using the shared page_discovery logic.
    Side-effect: populates `sess.page_file_by_route` for navigate lookups."""
    try:
        files, file_tree = _build_discovery_inputs_from_disk(sess.frontend_dir)
        discovered, _framework, _deps = discover_pages(files, file_tree)
    except Exception as e:
        logger.warning("Edit Lab: page discovery failed: %s", e)
        discovered = []

    available: list[dict] = []
    seen_routes: set[str] = set()
    for p in discovered:
        if p.route in seen_routes:
            continue
        seen_routes.add(p.route)
        available.append({"name": p.name, "route": p.route, "path": p.path})
        sess.page_file_by_route[p.route] = p.path

    # No forced Home injection. If the repo has a real page at "/" the
    # discovery step already surfaced it (page_discovery names it "Home");
    # if it doesn't, don't invent a duplicate tab. `sess.root_file` is
    # still set independently and used as the fallback edit target when a
    # section's source_file can't be resolved.

    available.sort(key=lambda p: (p["route"] != "/", p["route"]))
    return available


def _resolve_overlay_target(frontend_dir: str, rel_path: str) -> str | None:
    """Pick the real on-disk location for `rel_path` inside `frontend_dir`.

    Upstream callers (e.g. the transform pipeline) emit file paths relative to
    whatever root they consider the repo — sometimes the git root, sometimes a
    sub-directory like `frontend/` or `apps/web/`. The Lab's workspace is
    rooted at `frontend_dir`, which may or may not include those outer
    segments. Rather than hard-coding a layout, we try the given path and then
    progressively shorter path-suffixes, returning the first one that matches
    an existing file. If nothing matches, we fall back to the path as-is
    (creating a new file at the literal location).

    Always returns a realpath inside `frontend_dir`, or None if the path
    resolves outside the workspace (path-traversal guard).
    """
    base = os.path.realpath(frontend_dir)
    normalized = rel_path.replace("\\", "/").lstrip("/")
    if not normalized or ".." in normalized.split("/"):
        return None

    parts = normalized.split("/")

    def safe_join(segments: list[str]) -> str | None:
        joined = "/".join(segments)
        resolved = os.path.realpath(os.path.join(base, joined))
        if resolved == base or resolved.startswith(base + os.sep):
            return resolved
        return None

    # 1. Exact match — preferred.
    direct = safe_join(parts)
    if direct and os.path.isfile(direct):
        return direct

    # 2. Suffix search — drop leading segments one at a time.
    for i in range(1, len(parts)):
        candidate = safe_join(parts[i:])
        if candidate and os.path.isfile(candidate):
            return candidate

    # 3. New file — no existing target. Also try stripping a leading segment
    # that matches the workspace's own basename (catches the common case where
    # both the caller and the session think they're "the frontend").
    base_name = os.path.basename(base.rstrip(os.sep))
    if base_name and parts and parts[0] == base_name:
        stripped = safe_join(parts[1:])
        if stripped:
            return stripped

    return direct


def _apply_overlay_files(frontend_dir: str, overlay_files: dict[str, str]) -> None:
    """Write each (path -> content) pair into the workspace.

    Paths are resolved via `_resolve_overlay_target` so the caller can emit
    paths relative to either the repo root or a sub-directory — whichever
    matches gets overwritten. Anything that escapes `frontend_dir` via `..`
    is rejected. Parent directories are created as needed.
    """
    for rel_path, content in overlay_files.items():
        if not rel_path or not isinstance(content, str):
            continue
        target = _resolve_overlay_target(frontend_dir, rel_path)
        if not target:
            logger.warning("Edit Lab overlay: rejecting path outside workspace: %s", rel_path)
            continue
        try:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info("Edit Lab overlay: wrote %s -> %s", rel_path, os.path.relpath(target, os.path.realpath(frontend_dir)))
        except Exception as e:
            logger.warning("Edit Lab overlay: failed to write %s: %s", rel_path, e)


async def _playwright_collect(url: str) -> tuple[str, dict]:
    """Navigate to URL, return (full_page_screenshot_b64, detection_payload)."""
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1500)
            detection = await page.evaluate(SECTION_DETECTION_SCRIPT)
            screenshot = await page.screenshot(type="png", full_page=True)
            return base64.b64encode(screenshot).decode("utf-8"), detection
        finally:
            await browser.close()


async def load_current_preview(
    github_url: str,
    branch: str = "main",
    access_token: str = "",
    overlay_files: dict[str, str] | None = None,
) -> dict:
    """Create a persistent workspace, render the root page, return payload + session_id.

    If overlay_files is provided (repo-relative path -> content), those files are
    written into the workspace after clone/install but before the first render.
    Used to layer a proposed-but-unpublished transform on top of the real repo
    so Lab edits stack on the proposal.
    """
    if not github_url:
        return {"error": "No repository URL provided."}

    registry = get_registry()
    registry.sweep()

    try:
        sess = await asyncio.to_thread(create_session, github_url, branch, access_token)
    except Exception as e:
        logger.error("Edit Lab load: create_session failed: %s", e, exc_info=True)
        return {"error": f"Workspace setup failed: {e}"}

    try:
        if overlay_files:
            _apply_overlay_files(sess.frontend_dir, overlay_files)

        root_code = ""
        if sess.root_file:
            try:
                with open(os.path.join(sess.frontend_dir, sess.root_file), "r", encoding="utf-8") as f:
                    root_code = f.read()
            except Exception as e:
                logger.warning("Edit Lab: could not read root file: %s", e)

        available_pages = _discover_available_pages(sess)

        logger.info("Edit Lab: rendering session %s at %s", sess.id, sess.base_url)
        if overlay_files:
            # Give the dev server a beat to pick up the overlay via its watcher
            # before we screenshot. Empirical: Next.js takes ~1-2s to recompile.
            await asyncio.sleep(2.0)
        screenshot_b64, detection = await _playwright_collect(sess.base_url)
        sections = detection.get("sections", []) or []
        document_size = detection.get("document_size", {"width": 1440, "height": 900})

        page_file_for_root = sess.page_file_by_route.get("/", sess.root_file)
        _assign_source_files(sections, sess.frontend_dir, page_file_for_root)

        return {
            "session_id": sess.id,
            "screenshot": screenshot_b64,
            "sections": sections,
            "document_size": document_size,
            "root_file": sess.root_file,
            "root_code": root_code,
            "framework": sess.framework,
            "available_pages": available_pages,
            "current_page": "/",
        }
    except Exception as e:
        logger.error("Edit Lab load failed: %s", e, exc_info=True)
        # Session is still alive — leave it in the registry, the client can retry render
        return {"session_id": sess.id, "error": f"Render failed: {e}"}


def _normalize_page_path(page_path: str) -> str:
    """Sanitize a user-supplied route. Returns '/' for empty input."""
    if not page_path:
        return "/"
    path = page_path.strip()
    if not path.startswith("/"):
        path = "/" + path
    # Strip query/fragment and reject traversal
    path = path.split("#", 1)[0].split("?", 1)[0]
    if ".." in path:
        return "/"
    return path or "/"


async def navigate_to_page(session_id: str, page_path: str) -> dict:
    """Navigate the warm dev server to a new route and re-detect sections.
    Reuses the existing workspace — no clone, install, or server restart."""
    if not session_id:
        return {"error": "Missing session_id. Please reload the preview.", "session_expired": True}

    registry = get_registry()
    registry.sweep()
    sess = registry.get(session_id)
    if not sess:
        return {"error": "Edit Lab session expired. Reloading preview…", "session_expired": True}

    normalized = _normalize_page_path(page_path)
    url = sess.base_url.rstrip("/") + normalized

    try:
        logger.info("Edit Lab: navigating session %s to %s", sess.id, url)
        screenshot_b64, detection = await _playwright_collect(url)
        sections = detection.get("sections", []) or []
        document_size = detection.get("document_size", {"width": 1440, "height": 900})

        page_file = sess.page_file_by_route.get(normalized) or sess.root_file
        _assign_source_files(sections, sess.frontend_dir, page_file)

        sess.touch()
        return {
            "session_id": sess.id,
            "screenshot": screenshot_b64,
            "sections": sections,
            "document_size": document_size,
            "current_page": normalized,
            "target_page_file": page_file,
        }
    except Exception as e:
        logger.error("Edit Lab navigate failed: %s", e, exc_info=True)
        return {"session_id": sess.id, "error": f"Navigate failed: {e}"}


def _build_scoped_prompt(
    current_code: str,
    section_label: str,
    section_heading: str,
    section_paragraph: str,
    section_text: str,
    section_tag: str,
    section_classes: str,
    section_role: str,
    section_aria_label: str,
    user_prompt: str,
    prompt_anchors: Optional[list[str]] = None,
) -> str:
    identifier_lines = [f'- Label: "{section_label}"']
    if section_tag:
        identifier_lines.append(f"- HTML tag: <{section_tag}>")
    if section_aria_label:
        identifier_lines.append(f'- aria-label: "{section_aria_label}"')
    if section_role:
        identifier_lines.append(f'- role: "{section_role}"')
    distinctive = _distinctive_classes(section_classes)
    if distinctive:
        identifier_lines.append(f'- CSS class names to match: {" ".join(distinctive)}')
    if section_heading:
        identifier_lines.append(f'- Heading text: "{section_heading}"')
    if section_paragraph:
        identifier_lines.append(f'- Paragraph snippet: "{section_paragraph}"')
    if section_text and not (section_heading or section_paragraph):
        identifier_lines.append(f'- Visible text: "{section_text[:160]}"')
    if prompt_anchors:
        identifier_lines.append(
            "- Literal strings from the user's prompt to find and modify: "
            + ", ".join(f'"{a}"' for a in prompt_anchors)
        )
    identifier = "\n".join(identifier_lines)

    return f"""You are a senior frontend engineer making a SCOPED edit to one JSX element.

## File (for context only — do NOT return this whole file)
{current_code}

## The user selected ONE element on the rendered page. Locate its JSX:
{identifier}

## User's requested change
"{user_prompt}"

---

## OUTPUT FORMAT (strict — the response is parsed)

Return exactly two fenced code blocks, in this order, nothing else:

[BEFORE]
```jsx
<the exact JSX of the single element you will modify, copied verbatim from the file>
```

[AFTER]
```jsx
<your modified version of that same JSX — same structure, only the attributes or text the user asked to change are different>
```

## HARD RULES

1. `[BEFORE]` must be COPIED CHARACTER-FOR-CHARACTER from the file (whitespace, quotes, self-closing slashes, everything). It is used as the exact key for a string replace. Any deviation breaks the edit.

2. `[BEFORE]` must appear EXACTLY ONCE in the file. If the element you want to modify is ambiguous (multiple matches), expand `[BEFORE]` to include just enough surrounding context — a parent's opening tag, a nearby sibling — to make it unique. Do NOT expand further than needed.

3. `[AFTER]` may differ from `[BEFORE]` ONLY in the attributes or text the user's change requires. Do not refactor, rename props, reorder children, add/remove siblings, restructure JSX, or change imports, exports, hooks, handlers, or logic. If you could satisfy the change by only editing a `className` or `style` attribute, you MUST do that and nothing else.

4. Styling changes (background, color, padding, margin, spacing, size, rounded, border, shadow, font-size, gap) must be applied via Tailwind `className` on the target element (or its direct wrapper if the target has no className). Do not introduce new CSS files or inline styles if Tailwind is already in use.

5. Content changes (copy, headings, button labels) only modify the text node(s). Preserve all markup.

6. The change MUST be visibly different. "Dark background" = `bg-neutral-900` or `bg-black`, not `bg-gray-100`. "Bigger button" = at least doubled padding or font-size.

7. If the element is rendered by an imported component (this file just renders `<SomeComponent />` and the visual lives elsewhere), still apply the change via `className` / prop on that usage in THIS file. Do not touch other files.

8. Output: only the two fenced code blocks after the `[BEFORE]` and `[AFTER]` markers. No commentary, no markdown headings, no explanation."""


def _extract_code_response(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[: text.rfind("```")].strip()
    return text


_BEFORE_AFTER_RE = re.compile(
    r"\[BEFORE\]\s*```(?:jsx|tsx|javascript|js|typescript|ts|html)?\s*\n(.*?)\n\s*```"
    r".*?"
    r"\[AFTER\]\s*```(?:jsx|tsx|javascript|js|typescript|ts|html)?\s*\n(.*?)\n\s*```",
    re.DOTALL,
)


def _parse_before_after(raw: str) -> Optional[tuple[str, str]]:
    """Extract the two JSX fragments from a [BEFORE]/[AFTER] response.

    Returns None if the response didn't follow the format."""
    m = _BEFORE_AFTER_RE.search(raw)
    if not m:
        return None
    before = m.group(1)
    after = m.group(2)
    if not before.strip() or not after.strip():
        return None
    return before, after


_STYLING_KEYWORDS = frozenset({
    "background", "bg", "backgrounds", "color", "colors", "dark", "light",
    "darker", "lighter", "padding", "padded", "margin", "spacing", "space",
    "size", "bigger", "smaller", "larger", "taller", "shorter", "wider",
    "narrower", "font", "fontsize", "rounded", "round", "corner", "corners",
    "border", "borders", "shadow", "shadows", "gap", "tight", "loose",
    "text", "white", "black", "gray", "grey", "blue", "red", "green",
    "purple", "yellow", "pink", "orange", "emerald", "rose", "indigo",
})


def _is_styling_prompt(user_prompt: str) -> bool:
    """Rough classifier: does this prompt describe a pure visual tweak?

    Used to tighten the diff guardrail — styling prompts should never
    produce large file diffs."""
    if not user_prompt:
        return False
    tokens = re.findall(r"[a-z]+", user_prompt.lower())
    return any(tok in _STYLING_KEYWORDS for tok in tokens)


def _match_updated_section(
    old_label: str,
    old_heading: str,
    old_paragraph: str,
    new_sections: list[dict[str, Any]],
) -> Optional[str]:
    """Return the id of the new section that corresponds to the old selection."""
    if not new_sections:
        return None
    old_h = (old_heading or "").strip().lower()
    old_p = (old_paragraph or "").strip()[:60].lower()
    old_l = (old_label or "").strip().lower()

    if old_h and len(old_h) >= 4:
        for sec in new_sections:
            h = (sec.get("heading") or "").strip().lower()
            if h == old_h:
                return sec.get("id")
        for sec in new_sections:
            h = (sec.get("heading") or "").strip().lower()
            if h and len(old_h) >= 6 and (old_h in h or h in old_h):
                return sec.get("id")

    if old_p and len(old_p) >= 10:
        for sec in new_sections:
            p = (sec.get("paragraph") or "").strip()[:60].lower()
            if p and (p[:30] == old_p[:30] or p in old_p or old_p in p):
                return sec.get("id")

    if old_l:
        for sec in new_sections:
            if (sec.get("label") or "").strip().lower() == old_l:
                return sec.get("id")
    return None


def _locate_target_file(sess: EditLabSession, target_file: str) -> Optional[str]:
    direct = os.path.join(sess.frontend_dir, target_file)
    if os.path.isfile(direct):
        return direct
    for root, dirs, files in os.walk(sess.frontend_dir):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS and not d.startswith(".")]
        for fn in files:
            candidate = os.path.join(root, fn)
            if candidate.endswith(target_file) or fn == os.path.basename(target_file):
                return candidate
    return None


async def accept_last_edit(session_id: str) -> dict:
    """Mark the most recent applied edit as accepted. The file path is
    added to the session's accepted_files set so /edit-lab/publish can
    include it in the GitHub commit. Clears the pending revert snapshot
    so the next edit starts fresh."""
    if not session_id:
        return {"error": "Missing session_id. Please reload the preview.", "session_expired": True}

    registry = get_registry()
    registry.sweep()
    sess = registry.get(session_id)
    if not sess:
        return {"error": "Edit Lab session expired. Reloading preview…", "session_expired": True}

    pending = sess.pending_revert
    if not pending:
        return {"session_id": sess.id, "accepted_files": list(sess.accepted_files)}

    target_file = pending.get("target_file")
    if target_file:
        sess.accepted_files.add(target_file)

    sess.pending_revert = None
    sess.touch()
    return {
        "session_id": sess.id,
        "accepted_files": sorted(sess.accepted_files),
    }


async def publish_session_edits(
    session_id: str,
    access_token: str,
    github_user_id: str = "",
) -> dict:
    """Read every accepted file from the warm workspace and push them to a
    new branch on the user's GitHub repo via the existing publisher."""
    if not session_id:
        return {"error": "Missing session_id. Please reload the preview.", "session_expired": True}
    if not access_token:
        return {"error": "GitHub access token is required to publish."}

    registry = get_registry()
    registry.sweep()
    sess = registry.get(session_id)
    if not sess:
        return {"error": "Edit Lab session expired. Reloading preview…", "session_expired": True}

    if not sess.accepted_files:
        return {"session_id": sess.id, "error": "No accepted edits to publish yet."}

    # Parse owner/repo from the session's github_url
    match = re.search(r"github\.com/([^/]+)/([^/.]+)(?:\.git)?/?$", sess.github_url)
    if not match:
        return {"session_id": sess.id, "error": f"Could not parse owner/repo from {sess.github_url}"}
    owner, repo = match.group(1), match.group(2)

    approved_files: list[dict] = []
    files_missing: list[str] = []
    for rel in sorted(sess.accepted_files):
        full = os.path.join(sess.frontend_dir, rel)
        if not os.path.isfile(full):
            files_missing.append(rel)
            continue
        try:
            with open(full, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            logger.warning("Edit Lab publish: could not read %s: %s", rel, e)
            files_missing.append(rel)
            continue

        # Figure out the path to use in the remote repo. The workspace's
        # frontend_dir may be nested under the repo root (e.g. frontend/,
        # apps/web/, packages/site/). Re-derive the repo-relative path by
        # stripping the workspace tmp_dir prefix.
        try:
            repo_rel = os.path.relpath(full, sess.tmp_dir).replace(os.sep, "/")
        except Exception:
            repo_rel = rel
        approved_files.append({"path": repo_rel, "content": content})

    if not approved_files:
        return {
            "session_id": sess.id,
            "error": f"None of the accepted files could be read from the workspace (missing: {', '.join(files_missing)}).",
        }

    from app.services.github_publisher import publish_approved_branch
    try:
        result = await publish_approved_branch(
            owner=owner,
            repo=repo,
            access_token=access_token,
            approved_files=approved_files,
            pages_transformed=[f["path"] for f in approved_files],
            summary_text="The Lab: section edits",
            base_branch=sess.branch,
        )
    except Exception as e:
        logger.error("Edit Lab publish failed: %s", e, exc_info=True)
        return {"session_id": sess.id, "error": f"Publish failed: {e}"}

    sess.touch()
    return {
        "session_id": sess.id,
        "branch_name": result.get("branch_name", ""),
        "branch_url": result.get("branch_url", ""),
        "files_changed": result.get("files_changed", []),
    }


async def _rewind_edits(sess: EditLabSession, drop_from_index: int) -> dict:
    """Restore files by popping entries from `edit_stack[drop_from_index:]`.

    Each popped entry's `pre_edit_code` is written back to its `target_full_path`
    in reverse order (latest-first) so that earlier edits see their correct
    pre-state when the later ones roll back on top of them.

    Shared helper behind both `revert_last_edit` and `revert_edit_by_id`.
    Caller is responsible for validating `drop_from_index`.
    """
    if drop_from_index < 0 or drop_from_index >= len(sess.edit_stack):
        return {"session_id": sess.id, "error": "Edit not found — it may already be reverted."}

    to_drop = sess.edit_stack[drop_from_index:]
    # Apply pre-edit snapshots latest-first.
    for entry in reversed(to_drop):
        target_full = entry.get("target_full_path") or os.path.join(
            sess.frontend_dir, entry.get("target_file", ""),
        )
        if not target_full or not os.path.isfile(target_full):
            logger.warning(
                "Edit Lab revert: target file missing for entry %s (%s) — skipping",
                entry.get("id"), entry.get("target_file"),
            )
            continue
        try:
            with open(target_full, "w", encoding="utf-8") as f:
                f.write(entry.get("pre_edit_code", ""))
        except OSError as e:
            logger.error("Edit Lab revert: failed to write %s: %s", target_full, e)
            return {"session_id": sess.id, "error": f"Revert failed writing {entry.get('target_file')}: {e}"}

    # History is the source of truth — trim it only after writes succeed.
    sess.edit_stack = sess.edit_stack[:drop_from_index]
    # Keep `pending_revert` pointing at the new top-of-stack (if any) so
    # the legacy single-level undo flow keeps working.
    if sess.edit_stack:
        top = sess.edit_stack[-1]
        sess.pending_revert = {
            "target_file": top["target_file"],
            "target_full_path": top["target_full_path"],
            "original_code": top["pre_edit_code"],
        }
    else:
        sess.pending_revert = None

    # Let HMR pick up the writes before we screenshot.
    await asyncio.sleep(3.0)
    try:
        import urllib.request, urllib.error
        req = urllib.request.Request(sess.base_url)
        with urllib.request.urlopen(req, timeout=10) as r:
            _ = r.read(2048)
    except (urllib.error.URLError, ConnectionRefusedError, OSError):
        pass
    await asyncio.sleep(2.0)

    screenshot_b64, detection = await _playwright_collect(sess.base_url)
    sections = detection.get("sections", []) or []
    document_size = detection.get("document_size", {"width": 1440, "height": 900})

    # Pass the first-dropped entry's target as a hint to section source-file
    # resolution so at least one section gets pinned to the edited file.
    hint_file = to_drop[0].get("target_file") if to_drop else None
    _assign_source_files(sections, sess.frontend_dir, hint_file)

    sess.touch()
    return {
        "session_id": sess.id,
        "screenshot": screenshot_b64,
        "sections": sections,
        "document_size": document_size,
        "reverted_count": len(to_drop),
    }


async def revert_last_edit(session_id: str) -> dict:
    """Pop the most recent edit from the stack, restore its pre-edit file
    snapshot, and re-render the warm dev server."""
    if not session_id:
        return {"error": "Missing session_id. Please reload the preview.", "session_expired": True}

    registry = get_registry()
    registry.sweep()
    sess = registry.get(session_id)
    if not sess:
        return {"error": "Edit Lab session expired. Reloading preview…", "session_expired": True}

    if not sess.edit_stack:
        return {"session_id": sess.id, "error": "Nothing to revert — no edit has been applied yet."}

    try:
        return await _rewind_edits(sess, len(sess.edit_stack) - 1)
    except Exception as e:
        logger.error("Edit Lab revert failed: %s", e, exc_info=True)
        return {"session_id": sess.id, "error": f"Revert failed: {e}"}


async def revert_edit_by_id(session_id: str, edit_id: str) -> dict:
    """Revert a specific edit by id. Cascades: every edit applied after it
    is also reverted, since later edits may have depended on earlier ones.
    The client surfaces this cascade in a confirmation prompt."""
    if not session_id:
        return {"error": "Missing session_id. Please reload the preview.", "session_expired": True}
    if not edit_id:
        return {"error": "Missing edit_id."}

    registry = get_registry()
    registry.sweep()
    sess = registry.get(session_id)
    if not sess:
        return {"error": "Edit Lab session expired. Reloading preview…", "session_expired": True}

    idx = next((i for i, e in enumerate(sess.edit_stack) if e.get("id") == edit_id), -1)
    if idx < 0:
        return {"session_id": sess.id, "error": "That edit is no longer in the history — it may already have been reverted."}

    try:
        return await _rewind_edits(sess, idx)
    except Exception as e:
        logger.error("Edit Lab revert-edit failed: %s", e, exc_info=True)
        return {"session_id": sess.id, "error": f"Revert failed: {e}"}


async def apply_section_edit(
    session_id: str,
    target_file: str,
    section_label: str,
    section_heading: str,
    section_paragraph: str,
    section_text: str,
    user_prompt: str,
    section_tag: str = "",
    section_classes: str = "",
    section_role: str = "",
    section_aria_label: str = "",
) -> dict:
    """Patch the target file in the live session workspace, trigger HMR, re-screenshot."""
    if not session_id:
        return {"error": "Missing session_id. Please reload the preview.", "session_expired": True}
    if not target_file:
        return {"error": "Missing target_file."}

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"error": "ANTHROPIC_API_KEY is not configured."}

    registry = get_registry()
    registry.sweep()
    sess = registry.get(session_id)
    if not sess:
        return {"error": "Edit Lab session expired. Reloading preview…", "session_expired": True}

    try:
        target_full = _locate_target_file(sess, target_file)
        if not target_full:
            return {"error": f"Could not locate {target_file} in the workspace."}

        # Extract literal anchors from the user's prompt and, if a different
        # source file in the workspace contains them more strongly than the
        # currently-selected target, retarget the edit. This is the fix for
        # "change the word acme to hamza" on a custom drag region: the
        # frontend passes the root page file, but the actual "Acme" text
        # lives in components/Sidebar.tsx — so we retarget there.
        prompt_anchors = _extract_prompt_anchors(user_prompt)
        if prompt_anchors:
            better = _find_best_file_for_anchors(
                sess.frontend_dir, prompt_anchors, target_file,
            )
            if better:
                logger.info(
                    "Edit Lab apply: retargeting %s → %s based on prompt anchors %s",
                    target_file, better, prompt_anchors,
                )
                target_file = better
                located = _locate_target_file(sess, target_file)
                if located:
                    target_full = located

        with open(target_full, "r", encoding="utf-8") as f:
            current_code = f.read()

        # Snapshot the pre-edit content so the user can reject the edit
        # afterwards. We store this on `sess` only after the file write
        # succeeds (further down), so a failed apply doesn't poison the
        # undo state.

        prompt = _build_scoped_prompt(
            current_code,
            section_label=section_label,
            section_heading=section_heading,
            section_paragraph=section_paragraph,
            section_text=section_text,
            section_tag=section_tag,
            section_classes=section_classes,
            section_role=section_role,
            section_aria_label=section_aria_label,
            user_prompt=user_prompt,
            prompt_anchors=prompt_anchors,
        )

        client = anthropic.Anthropic(api_key=api_key)
        message = await asyncio.to_thread(
            client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()

        # Parse the [BEFORE]/[AFTER] fragments. If the model didn't follow
        # the format, retry once with an explicit reminder.
        parsed = _parse_before_after(raw)
        if parsed is None:
            logger.warning("Edit Lab apply: response missing [BEFORE]/[AFTER] blocks; retrying")
            retry = await asyncio.to_thread(
                client.messages.create,
                model="claude-sonnet-4-6",
                max_tokens=8000,
                messages=[
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": raw[:1200]},
                    {"role": "user", "content": (
                        "Your response did not follow the required format. "
                        "Respond again with EXACTLY two fenced code blocks: "
                        "the first preceded by `[BEFORE]` and containing the "
                        "verbatim original JSX, the second preceded by `[AFTER]` "
                        "and containing your modified version. No other text."
                    )},
                ],
            )
            raw = retry.content[0].text.strip()
            parsed = _parse_before_after(raw)

        if parsed is None:
            return {
                "session_id": sess.id,
                "error": "Claude did not return a valid edit. Try rephrasing with a more specific change.",
            }

        before, after = parsed

        # Validate that the [BEFORE] fragment appears exactly once in the
        # source file. Zero = hallucination; multiple = ambiguous target.
        occurrences = current_code.count(before)
        if occurrences == 0:
            logger.warning(
                "Edit Lab apply: [BEFORE] block not found in %s (len=%d)",
                target_file, len(before),
            )
            return {
                "session_id": sess.id,
                "error": (
                    "Claude's edit couldn't be matched to the selected element. "
                    "Click directly on the element you want to change and try again."
                ),
            }
        if occurrences > 1:
            logger.warning(
                "Edit Lab apply: [BEFORE] block matches %d locations in %s",
                occurrences, target_file,
            )
            return {
                "session_id": sess.id,
                "error": (
                    f"The target appears {occurrences} times in the file, which is ambiguous. "
                    "Pick a more specific element or use a more distinctive prompt."
                ),
            }

        # Reject when AFTER ballooned far beyond BEFORE — usually a sign
        # the model is rewriting rather than editing.
        before_len = len(before)
        after_len = len(after)
        if before_len > 0 and after_len > before_len * 4 and after_len > 500:
            logger.warning(
                "Edit Lab apply: AFTER is %.1fx larger than BEFORE (%d -> %d chars)",
                after_len / max(before_len, 1), before_len, after_len,
            )
            return {
                "session_id": sess.id,
                "error": (
                    "The edit grew the element far beyond its original size. "
                    "Try a more specific prompt or a smaller element."
                ),
            }

        if before == after:
            return {
                "session_id": sess.id,
                "error": "Claude returned an identical [AFTER] block — no change was made. Try rephrasing.",
            }

        # Apply the scoped replace. Exactly one occurrence guaranteed above.
        revised_code = current_code.replace(before, after, 1)

        if revised_code == current_code:
            return {
                "session_id": sess.id,
                "error": "Replacement had no effect. Try rephrasing.",
            }

        # Diff guardrail: styling prompts ("make background dark", "bigger",
        # "rounded corners") should never change a large fraction of the
        # file. If they do, the model went off-script and we reject.
        if _is_styling_prompt(user_prompt):
            import difflib
            ratio = difflib.SequenceMatcher(a=current_code, b=revised_code).ratio()
            file_delta_pct = (1 - ratio) * 100
            if file_delta_pct > 30.0:
                logger.warning(
                    "Edit Lab apply: styling prompt produced %.1f%% file change — rejecting",
                    file_delta_pct,
                )
                return {
                    "session_id": sess.id,
                    "error": (
                        "The edit would change too much of the file for a styling tweak. "
                        "Click directly on the specific element you want to restyle."
                    ),
                }

        len_delta_pct = abs(len(revised_code) - len(current_code)) / max(len(current_code), 1) * 100
        logger.info(
            "Edit Lab apply: %s BEFORE=%d AFTER=%d file_delta=%+d chars (%.2f%%)",
            target_file, before_len, after_len,
            len(revised_code) - len(current_code), len_delta_pct,
        )

        with open(target_full, "w", encoding="utf-8") as f:
            f.write(revised_code)

        try:
            summary_msg = await asyncio.to_thread(
                client.messages.create,
                model="claude-haiku-4-5-20251001",
                max_tokens=80,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Write a 3-6 word commit title (no punctuation, no code terms) describing this UI "
                        f"change to the '{section_label}' section: {user_prompt}"
                    ),
                }],
            )
            summary = summary_msg.content[0].text.strip()
        except Exception:
            summary = f"Updated {section_label}"

        # Write succeeded — record this edit in the session history and
        # update the quick-undo pointer.
        edit_id = uuid.uuid4().hex
        sess.edit_stack.append({
            "id": edit_id,
            "summary": summary,
            "prompt": user_prompt,
            "target_file": target_file,
            "target_full_path": target_full,
            "pre_edit_code": current_code,
        })
        sess.pending_revert = {
            "target_file": target_file,
            "target_full_path": target_full,
            "original_code": current_code,
        }

        # Wait for Fast Refresh / HMR to recompile, then do a warmup GET
        # on the preview URL to force the dev server to actually serve the
        # new bundle before Playwright navigates. Otherwise the screenshot
        # catches a stale render on slow repos.
        await asyncio.sleep(3.0)
        try:
            import urllib.request, urllib.error
            req = urllib.request.Request(sess.base_url)
            with urllib.request.urlopen(req, timeout=10) as r:
                _ = r.read(2048)
        except (urllib.error.URLError, ConnectionRefusedError, OSError) as warmup_err:
            logger.debug("warmup GET failed (non-blocking): %s", warmup_err)
        await asyncio.sleep(2.0)

        # Screenshot against the *still-running* dev server — no restart
        screenshot_b64, detection = await _playwright_collect(sess.base_url)
        sections = detection.get("sections", []) or []
        document_size = detection.get("document_size", {"width": 1440, "height": 900})

        _assign_source_files(sections, sess.frontend_dir, target_file)
        updated_section_id = _match_updated_section(
            section_label, section_heading, section_paragraph, sections,
        )

        sess.touch()
        return {
            "session_id": sess.id,
            "screenshot": screenshot_b64,
            "sections": sections,
            "document_size": document_size,
            "updated_code": revised_code,
            "summary": summary,
            "target_file": target_file,
            "updated_section_id": updated_section_id,
            "edit_id": edit_id,
        }
    except Exception as e:
        if is_anthropic_exception(e):
            info = log_and_classify(e)
            return {
                "session_id": sess.id,
                "error": info.user_message,
                "error_kind": info.kind,
            }
        logger.error("Edit Lab apply failed: %s", e, exc_info=True)
        return {"session_id": sess.id, "error": f"Apply failed: {e}"}
