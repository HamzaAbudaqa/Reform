"""Page quality scoring.

A page candidate has passed readiness (it *is* transformable); this module
decides *how good a candidate* it is. Score feeds two downstream uses:
    1. Ranking — pick the top N pages when the pipeline caps work.
    2. Deterministic tie-breaking — identical score + lexicographic path.

The scoring is fully deterministic: pure function of (path, content), no
I/O, no randomness, no hashing. Every signal is bounded so one huge file
can't dominate.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field


# ── Signal patterns ────────────────────────────────────────────────────

# Semantic layout tags — strong positive signal that a file renders UI chrome.
_LAYOUT_TAGS = ("main", "section", "header", "nav", "article", "footer", "aside")

# Filename fragments that indicate a non-production page. Scored negatively;
# the readiness filter already drops the worst (test, spec) but things like
# 'demo', '404', 'example' can slip through.
_EDGE_PAGE_HINTS = (
    "demo", "example", "sample", "playground", "sandbox",
    "404", "500", "error", "offline", "maintenance",
)

# Layout classes used by Tailwind/Bootstrap that strongly imply a real page.
_LAYOUT_CLASS_HINTS = ("container", "grid", "flex", "max-w-", "mx-auto", "wrapper")


# ── Signal struct ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class ScoreSignals:
    """Per-page scoring breakdown. Kept for debugging + UI transparency.

    Values are the *points contributed* by each signal (after capping).
    Negative values represent penalties. The sum — before the final 0..100
    clamp — is approximately `score`, but the clamp is what callers use.
    """
    layout_tags: float = 0.0
    size: float = 0.0
    component_count: float = 0.0
    jsx_density: float = 0.0
    layout_classes: float = 0.0
    import_count: float = 0.0
    boilerplate_penalty: float = 0.0
    logic_heavy_penalty: float = 0.0
    edge_page_penalty: float = 0.0
    # Raw measurements, handy for debugging without re-parsing.
    raw: dict = field(default_factory=dict)

    def total(self) -> float:
        return (
            self.layout_tags
            + self.size
            + self.component_count
            + self.jsx_density
            + self.layout_classes
            + self.import_count
            + self.boilerplate_penalty
            + self.logic_heavy_penalty
            + self.edge_page_penalty
        )


# ── Public API ─────────────────────────────────────────────────────────

def score_page(path: str, content: str) -> tuple[int, ScoreSignals]:
    """Return (score 0..100, signals). Deterministic: same inputs → same output.

    The 0..100 scale is arbitrary but convenient: roughly,
      0..20   → boilerplate / stub
      20..50  → weak candidate (maybe a fragment or mostly logic)
      50..80  → solid page
      80..100 → rich, component-heavy page with clear layout structure
    """
    if not content:
        # Edge case: detector produced a candidate but we have no content.
        # Score zero, empty signals — callers can still rank it dead-last.
        return 0, ScoreSignals()

    signals = _compute_signals(path, content)
    raw_total = signals.total()
    # Clamp + round. int so downstream display doesn't carry noise.
    clamped = max(0, min(100, int(round(raw_total))))
    return clamped, signals


# ── Signal computation ─────────────────────────────────────────────────

def _compute_signals(path: str, content: str) -> ScoreSignals:
    raw: dict = {}

    # ── Positive: layout tags ─────────────────────────────────────────
    # Count UNIQUE semantic tags present — rewards variety, not repetition
    # (a page with <main><section><header> beats one with 10 <section>s).
    unique_layout = {
        tag for tag in _LAYOUT_TAGS
        if re.search(rf"<{tag}[\s>/]", content)
    }
    raw["unique_layout_tags"] = sorted(unique_layout)
    # Each unique layout tag worth 5 points, cap at 20.
    layout_tags = min(len(unique_layout) * 5, 20)

    # ── Positive: file size ───────────────────────────────────────────
    # Tiers to avoid linear reward for huge-but-junky files.
    size = len(content)
    raw["size_bytes"] = size
    if size >= 5000:
        size_score = 15.0
    elif size >= 2500:
        size_score = 10.0
    elif size >= 1000:
        size_score = 5.0
    elif size >= 500:
        size_score = 2.0
    else:
        size_score = 0.0

    # ── Positive: component count ────────────────────────────────────
    # Unique PascalCase JSX tags — a page that composes Header/Sidebar/Card
    # is structurally richer than one with raw <div>s.
    components = _unique_component_tags(content)
    raw["unique_components"] = components
    # 3 points per unique component, cap at 20 (to avoid component-list pages
    # dominating scoring purely by name-dropping).
    component_count = min(len(components) * 3, 20)

    # ── Positive: JSX density ────────────────────────────────────────
    # Total JSX opening tags as a proxy for "how much UI is here".
    jsx_tag_count = len(re.findall(r"<[A-Za-z][A-Za-z0-9]*[\s/>]", content))
    raw["jsx_tag_count"] = jsx_tag_count
    # 0.4 per tag, cap at 15 → needs ~38 tags to max out.
    jsx_density = min(jsx_tag_count * 0.4, 15.0)

    # ── Positive: layout classes ──────────────────────────────────────
    # Utility-class signals (container/grid/flex/max-w-/mx-auto/wrapper)
    # imply deliberate layout rather than a raw fragment.
    class_hit_count = sum(1 for hint in _LAYOUT_CLASS_HINTS if hint in content)
    raw["layout_class_hits"] = class_hit_count
    layout_classes = min(class_hit_count * 2, 10)

    # ── Positive: imports ─────────────────────────────────────────────
    # Relative/alias imports → pulls in project components. Node_modules
    # imports are excluded since 'import React' says nothing about structure.
    project_imports = len(re.findall(
        r"""^\s*import\s+[^;]*?from\s+['"](?:@/|\.\.?/|~/)""",
        content,
        re.MULTILINE,
    ))
    raw["project_imports"] = project_imports
    # 1 per import, cap at 10.
    import_count = min(project_imports, 10)

    # ── Negative: boilerplate ─────────────────────────────────────────
    # A file that returns a single element with no nesting is a stub.
    boilerplate_penalty = 0.0
    if size < 500:
        boilerplate_penalty -= 10.0
    if jsx_tag_count < 3 and size < 800:
        boilerplate_penalty -= 10.0

    # ── Negative: logic-heavy ────────────────────────────────────────
    # Ratio of JS logic lines to JSX elements. A page that is 90% hooks and
    # effects with two <div>s at the end is a logic shell, not a transform
    # target.
    logic_lines = len(re.findall(
        r"^\s*(?:const|let|var|function|async|if|for|while|switch|return\s[^<])",
        content,
        re.MULTILINE,
    ))
    raw["logic_lines"] = logic_lines
    logic_heavy_penalty = 0.0
    if jsx_tag_count > 0:
        logic_ratio = logic_lines / max(jsx_tag_count, 1)
        raw["logic_ratio"] = round(logic_ratio, 2)
        if logic_ratio > 3.0:
            logic_heavy_penalty = -10.0
        elif logic_ratio > 2.0:
            logic_heavy_penalty = -5.0

    # ── Negative: edge-page names ────────────────────────────────────
    # Scan every segment of the path (not just basename) — for Next.js
    # App Router every page is literally 'page.tsx', so the meaningful
    # segment is the parent directory (e.g. 'app/demo-page/page.tsx').
    # We exclude generic framework segments that always appear.
    segments = [
        seg.lower() for seg in path.split("/")
        if seg and seg.lower() not in ("app", "pages", "src", "page.tsx", "page.jsx", "page.ts", "page.js", "index.tsx", "index.jsx")
    ]
    edge_hit = next(
        (hint for seg in segments for hint in _EDGE_PAGE_HINTS if hint in seg),
        None,
    )
    raw["edge_hint"] = edge_hit
    edge_page_penalty = -15.0 if edge_hit else 0.0

    # ── Base score ────────────────────────────────────────────────────
    # Everything above sums near ~90 max; add a small base so any real page
    # with *some* content lands > 0 after a single penalty.
    return ScoreSignals(
        layout_tags=float(layout_tags),
        size=float(size_score),
        component_count=float(component_count),
        jsx_density=float(jsx_density),
        layout_classes=float(layout_classes),
        import_count=float(import_count),
        boilerplate_penalty=float(boilerplate_penalty),
        logic_heavy_penalty=float(logic_heavy_penalty),
        edge_page_penalty=float(edge_page_penalty),
        raw=raw,
    )


# ── Helpers ────────────────────────────────────────────────────────────

def _unique_component_tags(content: str) -> list[str]:
    """Return sorted unique PascalCase JSX tags (<Header>, <Sidebar>, etc.).

    Excludes React built-ins that are always present — 'Fragment', plus the
    common `React.Fragment` shorthand '<>' — to avoid rewarding trivial files.
    Returns sorted for determinism.
    """
    matches = set(re.findall(r"<([A-Z][A-Za-z0-9]*)[\s/>]", content))
    matches.discard("Fragment")
    matches.discard("React")  # rare '<React.Foo>' edge, harmless to drop
    return sorted(matches)


def signals_to_dict(signals: ScoreSignals) -> dict:
    """Serialize signals for schema/API output. Keys stable + ordered."""
    data = asdict(signals)
    # Ensure raw sub-dict keys are sorted too for deterministic JSON.
    if "raw" in data and isinstance(data["raw"], dict):
        data["raw"] = {k: data["raw"][k] for k in sorted(data["raw"])}
    return data
