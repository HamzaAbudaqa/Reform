"""Fallback detection — used when primary detectors return nothing.

Layered strategy, each layer cheaper and less opinionated than the last:

  1. Entry point scan: App.*, main.*, index.* that look like React entries.
  2. Large JSX/TSX scan: prefer files with rich layout/section content,
     ranked by size as a proxy for "this is a page, not a helper".
  3. Give up: return an empty list. The caller decides whether to error.

Every page produced by fallback is tagged framework='spa' and route='/'.
"""
from __future__ import annotations

import logging
import re

from .detectors import PageCandidate

logger = logging.getLogger(__name__)


# Signals that a file is a real React entry (not a utility sharing the name).
_REACT_ENTRY_SIGNALS = (
    "ReactDOM",
    "createRoot",
    "hydrateRoot",
    "render(",
)

_ENTRY_TIERS: tuple[tuple[str, ...], ...] = (
    ("App.tsx", "App.jsx", "App.ts", "App.js"),
    ("main.tsx", "main.jsx", "main.ts", "main.js"),
    ("index.tsx", "index.jsx", "index.ts", "index.js"),
)


def find_entry_page(files: list[dict]) -> PageCandidate | None:
    """Locate the best SPA entry file and return it as a Home page.

    Preference order matches Vite/CRA conventions. Tiers 2+3 require a React
    entry signal so utility `main.ts`/`index.ts` files are skipped.
    """
    def _base(f: dict) -> str:
        return (f.get("path") or "").split("/")[-1]

    def _size(f: dict) -> int:
        return f.get("size") or len(f.get("content") or "")

    for tier_idx, names in enumerate(_ENTRY_TIERS):
        requires_signal = tier_idx > 0  # App.* trusted by name alone.
        matches = [
            f for f in files
            if _base(f) in names
            and (not requires_signal or _looks_like_react_entry(f.get("content") or ""))
        ]
        if matches:
            # Largest first; break size ties by path asc so shuffled input
            # produces the same winner every time.
            matches.sort(key=lambda f: (-_size(f), f.get("path", "")))
            best = matches[0]
            return PageCandidate(
                name="Home",
                path=best["path"],
                route="/",
                framework="spa",
                detector="fallback_entry",
            )
    return None


def _looks_like_react_entry(content: str) -> bool:
    """Lightweight heuristic: does this file mount a React tree?"""
    if not content:
        return False
    if any(sig in content for sig in _REACT_ENTRY_SIGNALS):
        return True
    # A component file that returns JSX counts too — some projects use
    # main.ts to re-export App.
    return "export default" in content and "<" in content


# ── Large-file fallback ────────────────────────────────────────────────
# When there's no conventional entry and no framework-style pages (rare but
# possible: experimental projects, partial snippets), we still want to
# return *something* transformable. We surface large JSX/TSX files that
# have layout-shaped content.

_LAYOUT_SIGNALS = (
    "<main",
    "<section",
    "<header",
    "<nav",
    "<article",
    "<footer",
    "className=\"container",
    "className=\"flex",
    "className=\"grid",
)

_MIN_LAYOUT_SIZE = 2_000  # bytes — below this is almost never a page.


def find_large_jsx_pages(files: list[dict], limit: int = 3) -> list[PageCandidate]:
    """Return up to `limit` large JSX/TSX files that look page-shaped.

    Used as a last resort when both the detectors and the entry-point
    fallback fail. Better to transform *something* than nothing — an empty
    result is hard to act on, a mediocre candidate is a starting point.
    """
    scored: list[tuple[int, dict]] = []
    for f in files:
        path = f.get("path") or ""
        if not re.search(r"\.[jt]sx$", path):
            continue
        content = f.get("content") or ""
        size = f.get("size") or len(content)
        if size < _MIN_LAYOUT_SIZE:
            continue
        layout_hits = sum(1 for sig in _LAYOUT_SIGNALS if sig in content)
        if layout_hits < 2:
            continue
        # Score = layout density × raw size. Biased toward pages over helpers.
        scored.append((layout_hits * size, f))

    # Highest score first; tiebreak by path asc so two equally-shaped files
    # always produce the same ranking regardless of input order.
    scored.sort(key=lambda x: (-x[0], x[1].get("path", "")))
    results: list[PageCandidate] = []
    for _, f in scored[:limit]:
        basename = (f["path"].split("/")[-1]).rsplit(".", 1)[0]
        # Split PascalCase for a readable label.
        spaced = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", basename)
        label = spaced.replace("-", " ").replace("_", " ").title()
        results.append(PageCandidate(
            name=label or "Home",
            path=f["path"],
            route="/",
            framework="spa",
            detector="fallback_large_jsx",
        ))
    return results


# ── Public API ─────────────────────────────────────────────────────────

def fallback_pages(files: list[dict]) -> list[PageCandidate]:
    """Run the fallback chain and return whatever pages we can salvage.

    Callers should only invoke this when primary detection yielded zero
    pages. Returns [] if even the last-resort scan finds nothing — caller
    decides whether to error out or proceed.
    """
    entry = find_entry_page(files)
    if entry:
        logger.info("Fallback: using entry file %s as single Home page", entry.path)
        return [entry]

    large = find_large_jsx_pages(files)
    if large:
        logger.info(
            "Fallback: no entry point — surfacing %d large JSX file(s): %s",
            len(large), [p.path for p in large],
        )
        return large

    logger.warning("Fallback: no entry point and no layout-shaped JSX files found")
    return []
