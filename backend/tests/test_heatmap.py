"""Unit tests for heatmap ingestion, rage detection, and snippet service.

Scope is deliberately narrow: pure-function logic that carries real bug risk.
Route-level tests would require a live Postgres for the ON CONFLICT upserts
and are covered by the manual smoke test in the plan's Verification section.
"""

from __future__ import annotations

import pytest

from app.services.heatmap_ingest import (
    GRID,
    NormalizedClick,
    _bucket_idx,
    _detect_rage,
    viewport_class,
)
from app.services.heatmap_snippet import (
    _minify,
    _find_line_comment,
    build_snippet,
)


class TestViewportClass:
    @pytest.mark.parametrize("width,expected", [
        (360, "mobile"),
        (639, "mobile"),
        (640, "tablet"),
        (1023, "tablet"),
        (1024, "desktop"),
        (1920, "desktop"),
    ])
    def test_classifies(self, width: int, expected: str) -> None:
        assert viewport_class(width) == expected


class TestBucketIdx:
    def test_lower_bound(self) -> None:
        assert _bucket_idx(0) == 0
        assert _bucket_idx(-5) == 0

    def test_upper_bound(self) -> None:
        assert _bucket_idx(100) == GRID - 1
        assert _bucket_idx(150) == GRID - 1

    def test_midpoint(self) -> None:
        # 50% should fall inside the middle band, not the first or last.
        idx = _bucket_idx(50)
        assert 20 <= idx <= 30


class TestDetectRage:
    def _click(self, x_pct: float, y_pct: float, ts_ms: int) -> NormalizedClick:
        return NormalizedClick(x_pct=x_pct, y_pct=y_pct, page_y_pct=y_pct, ts_ms=ts_ms, tag="div", role="")

    def test_three_clusters_are_rage(self) -> None:
        clicks = [
            self._click(50, 50, 0),
            self._click(50.5, 50.5, 100),
            self._click(51, 51, 200),
        ]
        rage = _detect_rage(clicks, page_width_px=1000, page_height_px=1000)
        assert len(rage) == 3

    def test_two_clicks_not_rage(self) -> None:
        clicks = [
            self._click(50, 50, 0),
            self._click(50, 50, 100),
        ]
        rage = _detect_rage(clicks, page_width_px=1000, page_height_px=1000)
        assert rage == []

    def test_spread_out_not_rage(self) -> None:
        # 3 clicks > 50px apart on a 1000×1000 page.
        clicks = [
            self._click(10, 10, 0),
            self._click(90, 90, 100),
            self._click(50, 50, 200),
        ]
        rage = _detect_rage(clicks, page_width_px=1000, page_height_px=1000)
        assert rage == []

    def test_time_gap_breaks_cluster(self) -> None:
        # Tight spatial cluster but spread beyond the 1s window.
        clicks = [
            self._click(50, 50, 0),
            self._click(50, 50, 2000),
            self._click(50, 50, 4000),
        ]
        rage = _detect_rage(clicks, page_width_px=1000, page_height_px=1000)
        assert rage == []

    def test_zero_dimensions_empty(self) -> None:
        clicks = [self._click(50, 50, 0)]
        assert _detect_rage(clicks, page_width_px=0, page_height_px=0) == []


class TestSnippetMinify:
    def test_strips_line_comments(self) -> None:
        out = _minify("var x = 1; // a line comment\nvar y = 2;")
        assert "//" not in out
        assert "var x = 1" in out
        assert "var y = 2" in out

    def test_preserves_http_in_strings(self) -> None:
        out = _minify('var url = "https://example.com";')
        assert "https://example.com" in out

    def test_strips_block_comments(self) -> None:
        out = _minify("/* leading */ var x = 1; /* trailing */ var y = 2;")
        assert "/*" not in out
        assert "var x = 1" in out

    def test_collapses_whitespace(self) -> None:
        out = _minify("var\n  x =\n  1;")
        assert "\n" not in out

    def test_find_line_comment_inside_string(self) -> None:
        # `//` inside a string shouldn't be treated as a comment start.
        line = 'var s = "a // b"; var y = 1;'
        idx = _find_line_comment(line)
        # The outer `// b` is NOT a comment (it's in the string), so the first
        # `//` at column ~20 is inside quotes. Expect None — there's no trailing
        # comment on this line.
        assert idx is None


class TestBuildSnippet:
    def test_emits_script_tag(self) -> None:
        out = build_snippet("abc123", "http://localhost:8000")
        assert out == '<script async src="http://localhost:8000/api/heatmap/h.js?site=abc123"></script>'

    def test_strips_trailing_slash(self) -> None:
        out = build_snippet("abc123", "http://localhost:8000/")
        assert "localhost:8000/api/heatmap" in out
        assert "8000//api" not in out
