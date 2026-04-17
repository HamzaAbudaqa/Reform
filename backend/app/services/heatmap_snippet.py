"""Serve the heatmap tracker script and build the installation snippet."""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_TRACKER_PATH = Path(__file__).parent.parent / "static" / "heatmap_tracker.js"
_SITE_KEY_PLACEHOLDER = "__REFORM_SITE_KEY__"
_COLLECT_URL_PLACEHOLDER = "__REFORM_COLLECT_URL__"

_source_cache: str | None = None


def _load_source() -> str:
    global _source_cache
    if _source_cache is not None:
        return _source_cache
    try:
        raw = _TRACKER_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.error("heatmap tracker source missing at %s", _TRACKER_PATH)
        _source_cache = ""
        return _source_cache
    _source_cache = _minify(raw)
    return _source_cache


def _minify(js: str) -> str:
    """Strip // comments, /* … */ comments, and collapse whitespace.

    Intentionally conservative — we keep the tracker source readable in the
    repo and only apply the cheap wins on the way out. Preserves strings by
    operating line-by-line with a simple state machine.
    """
    # Strip /* … */ block comments first (spans lines).
    js = re.sub(r"/\*.*?\*/", "", js, flags=re.DOTALL)

    out_lines: list[str] = []
    for line in js.splitlines():
        # Drop // line comments — only when the `//` is not inside a string.
        # Cheap heuristic: count unescaped quotes to the left; if even, the
        # `//` is code and we truncate there. For this hand-written tracker
        # that doesn't mix strings and `//` on the same line, it's sufficient.
        idx = _find_line_comment(line)
        if idx is not None:
            line = line[:idx]
        line = line.rstrip()
        if line.strip():
            out_lines.append(line.strip())
    return " ".join(out_lines)


def _find_line_comment(line: str) -> int | None:
    in_s = False
    in_d = False
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "\\":
            i += 2
            continue
        if ch == "'" and not in_d:
            in_s = not in_s
        elif ch == '"' and not in_s:
            in_d = not in_d
        elif ch == "/" and i + 1 < len(line) and line[i + 1] == "/" and not in_s and not in_d:
            return i
        i += 1
    return None


def serve_tracker(site_key: str, collect_url: str) -> str:
    """Return the tracker JS with site_key + collect URL baked in."""
    src = _load_source()
    if not src:
        return "console.warn('[reform-heatmap] tracker source missing');"
    return (
        src
        .replace(_SITE_KEY_PLACEHOLDER, _escape_js(site_key))
        .replace(_COLLECT_URL_PLACEHOLDER, _escape_js(collect_url))
    )


def build_snippet(site_key: str, api_base: str) -> str:
    """Build the copy-pasteable <script> snippet for the setup UI."""
    base = api_base.rstrip("/")
    return (
        f'<script async src="{base}/api/heatmap/h.js?site={site_key}"></script>'
    )


def default_api_base() -> str:
    """Pick the API base URL used inside the served tracker."""
    return (
        os.environ.get("API_BASE_URL")
        or os.environ.get("BACKEND_URL")
        or "http://localhost:8000"
    ).rstrip("/")


def _escape_js(value: str) -> str:
    """Escape a string for safe inlining inside a JS string literal."""
    return (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("<", "\\u003c")
    )
