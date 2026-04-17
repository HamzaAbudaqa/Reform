"""Unit tests for the Stitch ingestion client.

Focused on pure logic we can test without network / Playwright / Anthropic:
URL allowlisting, JSON parsing, merge semantics, and response schema.
The network + vision paths are covered by the smoke test that asserts
routes register and the service imports cleanly under the FastAPI app.
"""

import pytest

from app.schemas.stitch import StitchDesign, StitchDesignTokens, StitchPatterns
from app.services import stitch_client
from app.services.stitch_client import (
    _parse_extraction_json,
    clear_cache,
    is_allowed_stitch_url,
    merge_stitch_designs,
)


@pytest.fixture(autouse=True)
def _reset_stitch_cache():
    clear_cache()
    yield
    clear_cache()


# ─── URL allowlist ──────────────────────────────────────────────────────────

def test_allowlist_accepts_stitch_domain():
    assert is_allowed_stitch_url("https://stitch.withgoogle.com/abc123")
    assert is_allowed_stitch_url("https://stitch.withgoogle.com/share/xyz")


def test_allowlist_accepts_configured_subdomains():
    assert is_allowed_stitch_url("https://stitchui.withgoogle.com/demo")


def test_allowlist_rejects_arbitrary_hosts():
    assert not is_allowed_stitch_url("https://evil.example.com/fake-stitch")
    assert not is_allowed_stitch_url("https://google.com/search?q=stitch")
    assert not is_allowed_stitch_url("https://withgoogle.com/attacker")


def test_allowlist_rejects_invalid_schemes():
    assert not is_allowed_stitch_url("file:///etc/passwd")
    assert not is_allowed_stitch_url("javascript:alert(1)")
    assert not is_allowed_stitch_url("not-a-url")


# ─── JSON extraction parser ─────────────────────────────────────────────────

def test_parse_extraction_json_plain():
    raw = '{"summary": "x", "design_tokens": {}, "patterns": {}}'
    parsed = _parse_extraction_json(raw)
    assert parsed is not None
    assert parsed["summary"] == "x"


def test_parse_extraction_json_fenced():
    raw = '```json\n{"summary": "fenced"}\n```'
    parsed = _parse_extraction_json(raw)
    assert parsed == {"summary": "fenced"}


def test_parse_extraction_json_with_preamble():
    # Claude sometimes emits explanatory text before / after the JSON.
    raw = 'Sure, here is the spec:\n{"summary": "ok"}\nThat is my analysis.'
    parsed = _parse_extraction_json(raw)
    assert parsed == {"summary": "ok"}


def test_parse_extraction_json_malformed_returns_none():
    assert _parse_extraction_json("not json at all") is None
    assert _parse_extraction_json("{unclosed") is None
    assert _parse_extraction_json("") is None


# ─── Merge semantics ────────────────────────────────────────────────────────

def _mk_design(url: str, **overrides) -> StitchDesign:
    d = StitchDesign(
        url=url,
        design_tokens=StitchDesignTokens(
            theme=overrides.get("theme", ""),
            palette=overrides.get("palette", {}),
            typography_tone=overrides.get("typography_tone", ""),
            spacing_rhythm=overrides.get("spacing_rhythm", ""),
            border_radius=overrides.get("border_radius", ""),
        ),
        patterns=StitchPatterns(
            layout_patterns=overrides.get("layout_patterns", []),
            cta_hierarchy=overrides.get("cta_hierarchy", ""),
            spacing_rhythm=overrides.get("pattern_spacing", ""),
            card_style=overrides.get("card_style", ""),
            typography_tone=overrides.get("pattern_typography", ""),
            component_patterns=overrides.get("component_patterns", []),
        ),
        error=overrides.get("error", ""),
    )
    return d


def test_merge_first_wins_for_scalars():
    d1 = _mk_design("a", theme="dark", cta_hierarchy="primary + ghost")
    d2 = _mk_design("b", theme="light", cta_hierarchy="gradient CTA")
    merged_p, merged_t = merge_stitch_designs([d1, d2])
    assert merged_t.theme == "dark"
    assert merged_p.cta_hierarchy == "primary + ghost"


def test_merge_dedups_list_patterns():
    d1 = _mk_design("a", layout_patterns=["3-col grid", "hero + proof"])
    d2 = _mk_design("b", layout_patterns=["3-col grid", "sticky nav"])
    merged_p, _ = merge_stitch_designs([d1, d2])
    assert merged_p.layout_patterns == ["3-col grid", "hero + proof", "sticky nav"]


def test_merge_palette_first_wins_per_key():
    d1 = _mk_design("a", palette={"primary": "#7c8cff", "bg": "#000"})
    d2 = _mk_design("b", palette={"primary": "#ff0000", "surface": "#111"})
    _, merged_t = merge_stitch_designs([d1, d2])
    assert merged_t.palette == {"primary": "#7c8cff", "bg": "#000", "surface": "#111"}


def test_merge_skips_errored_designs():
    d1 = _mk_design("a", error="timeout")  # should be ignored
    d2 = _mk_design("b", theme="dark", layout_patterns=["grid"])
    merged_p, merged_t = merge_stitch_designs([d1, d2])
    assert merged_t.theme == "dark"
    assert merged_p.layout_patterns == ["grid"]


def test_merge_empty_input_returns_empty_defaults():
    merged_p, merged_t = merge_stitch_designs([])
    assert merged_p.layout_patterns == []
    assert merged_t.palette == {}


# ─── Disabled kill switch ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_returns_error_when_disabled(monkeypatch):
    monkeypatch.setattr(stitch_client, "STITCH_ENABLED", False)
    design = await stitch_client.fetch_stitch_design("https://stitch.withgoogle.com/x")
    assert design.error == "Stitch ingestion is disabled"


@pytest.mark.asyncio
async def test_fetch_rejects_non_allowlisted_url():
    design = await stitch_client.fetch_stitch_design("https://example.com/fake")
    assert "allowlist" in design.error.lower()
