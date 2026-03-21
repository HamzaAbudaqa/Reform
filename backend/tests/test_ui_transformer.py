"""Tests for ui_transformer.py — all helper functions, the transform pipeline,
and the code generation prompt builder."""
import json
from unittest.mock import MagicMock, patch

import pytest

from app.prompts.ui_transform_prompt import build_code_generation_prompt
from app.schemas.ui_transform import (
    DesignIntelligence,
    RefinedComponents,
    RefinedLayout,
    TailwindTokenMap,
    UITransformResponse,
)
from app.services.ui_transformer import (
    _PRIORITY_ORDER,
    _build_components,
    _build_layout,
    _build_token_map,
    _collect_applied_patterns,
    _generate_code,
    _spacing_classes,
    transform_ui,
)
from tests.conftest import make_design_intelligence


# ─── _spacing_classes ─────────────────────────────────────────────────────────

class TestSpacingClasses:
    @pytest.mark.parametrize("value,expected_suffix", [
        (4, "1"), (8, "2"), (12, "3"), (16, "4"), (24, "6"), (32, "8"),
    ])
    def test_known_values_map_correctly(self, value, expected_suffix):
        result = _spacing_classes([value], "p")
        assert result == [f"p-{expected_suffix}"]

    def test_unknown_value_uses_floor_division(self):
        # 20 not in map → 20 // 4 = 5
        result = _spacing_classes([20], "p")
        assert result == ["p-5"]

    def test_unknown_value_10_uses_floor_division(self):
        # 10 // 4 = 2
        result = _spacing_classes([10], "p")
        assert result == ["p-2"]

    def test_gap_prefix(self):
        result = _spacing_classes([4, 8], "gap")
        assert result == ["gap-1", "gap-2"]

    def test_full_scale(self):
        result = _spacing_classes([4, 8, 12, 16, 24, 32], "p")
        assert result == ["p-1", "p-2", "p-3", "p-4", "p-6", "p-8"]

    def test_empty_scale_returns_empty_list(self):
        assert _spacing_classes([], "p") == []


# ─── _build_token_map ─────────────────────────────────────────────────────────

class TestBuildTokenMap:
    @pytest.mark.parametrize("radius,expected", [
        ("4px", "rounded"),
        ("6px", "rounded-md"),
        ("8px", "rounded-lg"),
        ("12px", "rounded-xl"),
        ("16px", "rounded-2xl"),
        ("24px", "rounded-3xl"),
    ])
    def test_border_radius_mapping(self, radius, expected):
        intelligence = make_design_intelligence()
        intelligence.design_tokens.border_radius = radius
        token_map = _build_token_map(intelligence)
        assert token_map.radius == expected

    def test_unknown_border_radius_defaults_to_rounded_xl(self):
        intelligence = make_design_intelligence()
        intelligence.design_tokens.border_radius = "99px"
        token_map = _build_token_map(intelligence)
        assert token_map.radius == "rounded-xl"

    @pytest.mark.parametrize("shadow_style,expected", [
        ("subtle_soft", "shadow-sm"),
        ("none", "shadow-none"),
        ("medium", "shadow-md"),
        ("strong", "shadow-lg"),
    ])
    def test_shadow_style_mapping(self, shadow_style, expected):
        intelligence = make_design_intelligence()
        intelligence.design_tokens.shadow_style = shadow_style
        token_map = _build_token_map(intelligence)
        assert token_map.shadow == expected

    def test_unknown_shadow_style_defaults_to_shadow_sm(self):
        intelligence = make_design_intelligence()
        intelligence.design_tokens.shadow_style = "unknown_style"
        token_map = _build_token_map(intelligence)
        assert token_map.shadow == "shadow-sm"

    def test_bg_base_uses_background_color(self):
        intelligence = make_design_intelligence()
        token_map = _build_token_map(intelligence)
        assert "#0d1117" in token_map.bg_base
        assert token_map.bg_base.startswith("bg-[")

    def test_bg_panel_uses_panel_color(self):
        intelligence = make_design_intelligence()
        token_map = _build_token_map(intelligence)
        assert "#161b22" in token_map.bg_panel

    def test_border_uses_border_color(self):
        intelligence = make_design_intelligence()
        token_map = _build_token_map(intelligence)
        assert "rgba(240,246,252,0.1)" in token_map.border

    def test_text_primary_uses_color(self):
        intelligence = make_design_intelligence()
        token_map = _build_token_map(intelligence)
        assert "#f0f6fc" in token_map.text_primary

    def test_text_secondary_uses_color(self):
        intelligence = make_design_intelligence()
        token_map = _build_token_map(intelligence)
        assert "#8b949e" in token_map.text_secondary

    def test_accent_bg_and_text_use_accent_color(self):
        intelligence = make_design_intelligence()
        token_map = _build_token_map(intelligence)
        assert "#58a6ff" in token_map.accent_bg
        assert "#58a6ff" in token_map.accent_text

    def test_spacing_and_gap_lists_same_length_as_scale(self):
        intelligence = make_design_intelligence()
        token_map = _build_token_map(intelligence)
        assert len(token_map.spacing) == len(intelligence.design_tokens.spacing_scale)
        assert len(token_map.gap) == len(intelligence.design_tokens.spacing_scale)

    def test_returns_tailwind_token_map_instance(self):
        intelligence = make_design_intelligence()
        result = _build_token_map(intelligence)
        assert isinstance(result, TailwindTokenMap)


# ─── _build_layout ────────────────────────────────────────────────────────────

class TestBuildLayout:
    def test_layout_type_is_three_panel_workspace(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert layout.type == "three_panel_workspace"

    def test_sidebar_panel_uses_flow_map_role(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert layout.panels["sidebar"].role == "navigation_panel"

    def test_canvas_panel_uses_flow_map_role(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert layout.panels["canvas"].role == "visual_output_area"

    def test_controls_panel_uses_flow_map_role(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert layout.panels["controls"].role == "controls_panel"

    def test_sidebar_has_correct_width(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert layout.panels["sidebar"].width == "w-64"

    def test_canvas_has_flex1_width(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert layout.panels["canvas"].width == "flex-1"

    def test_controls_has_correct_width(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert layout.panels["controls"].width == "w-72"

    def test_gap_class_is_gap4(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert layout.gap == "gap-4"

    def test_segmentation_extracted_from_matching_patterns(self):
        intelligence = make_design_intelligence()
        # The factory includes "card_based_section_segmentation" which has "section"
        layout = _build_layout(intelligence)
        assert "card_based_section_segmentation" in layout.segmentation

    def test_default_segmentation_used_when_no_matching_patterns(self):
        intelligence = make_design_intelligence()
        # Override layout patterns with none that contain section/segmentation/grouping
        intelligence.global_patterns.layout = ["three_panel_workspace"]
        layout = _build_layout(intelligence)
        assert "card_based_content_grouping" in layout.segmentation
        assert "clear_section_segmentation" in layout.segmentation

    def test_panel_classes_embed_colors(self):
        intelligence = make_design_intelligence()
        layout = _build_layout(intelligence)
        assert "#161b22" in layout.panels["sidebar"].classes
        assert "#0d1117" in layout.panels["canvas"].classes

    def test_returns_refined_layout_instance(self):
        intelligence = make_design_intelligence()
        assert isinstance(_build_layout(intelligence), RefinedLayout)


# ─── _build_components ────────────────────────────────────────────────────────

class TestBuildComponents:
    def test_returns_refined_components_instance(self):
        intelligence = make_design_intelligence()
        assert isinstance(_build_components(intelligence), RefinedComponents)

    def test_cards_radius_is_rounded_xl(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert components.cards.radius == "rounded-xl"

    def test_cards_shadow_is_shadow_sm(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert components.cards.shadow == "shadow-sm"

    def test_cards_padding(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert "p-4" in components.cards.padding

    def test_cards_classes_embed_border_color(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert "rgba(240,246,252,0.1)" in components.cards.classes

    def test_buttons_primary_uses_accent_color(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert "#58a6ff" in components.buttons.primary_classes

    def test_buttons_radius_is_rounded_md(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert components.buttons.radius == "rounded-md"

    def test_buttons_height_is_h9(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert components.buttons.height == "h-9"

    def test_navbar_layout(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert components.navbar.layout == "logo_left_links_center_cta_right"

    def test_hero_layout(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert components.hero.layout == "left_text_right_visual"

    def test_hero_headline_size(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert "text-4xl" in components.hero.headline_size

    def test_workspace_layout_is_three_panel(self):
        intelligence = make_design_intelligence()
        components = _build_components(intelligence)
        assert components.workspace.layout == "three_panel_flex"


# ─── _collect_applied_patterns ────────────────────────────────────────────────

class TestCollectAppliedPatterns:
    def test_high_priority_appears_before_medium(self):
        intelligence = make_design_intelligence()
        patterns = _collect_applied_patterns(intelligence)
        high_indices = [i for i, p in enumerate(patterns) if "[high]" in p]
        medium_indices = [i for i, p in enumerate(patterns) if "[medium]" in p]
        low_indices = [i for i, p in enumerate(patterns) if "[low]" in p]
        assert max(high_indices) < min(medium_indices)
        assert max(medium_indices) < min(low_indices)

    def test_pattern_format_is_correct(self):
        intelligence = make_design_intelligence()
        patterns = _collect_applied_patterns(intelligence)
        # All recommendation entries must match "[priority] target: action"
        rec_patterns = [p for p in patterns if p.startswith("[high]") or p.startswith("[medium]") or p.startswith("[low]")]
        assert len(rec_patterns) == len(intelligence.recommendations)
        for p in rec_patterns:
            assert ":" in p

    def test_global_layout_patterns_appended(self):
        intelligence = make_design_intelligence()
        patterns = _collect_applied_patterns(intelligence)
        for layout_p in intelligence.global_patterns.layout:
            assert any(layout_p in p for p in patterns)

    def test_global_visual_patterns_appended(self):
        intelligence = make_design_intelligence()
        patterns = _collect_applied_patterns(intelligence)
        for vis_p in intelligence.global_patterns.visual_style:
            assert any(vis_p in p for p in patterns)

    def test_ux_principles_appended(self):
        intelligence = make_design_intelligence()
        patterns = _collect_applied_patterns(intelligence)
        for ux_p in intelligence.global_patterns.ux_principles:
            assert any(ux_p in p for p in patterns)

    def test_returns_nonempty_list(self):
        intelligence = make_design_intelligence()
        patterns = _collect_applied_patterns(intelligence)
        assert len(patterns) > 0


# ─── _generate_code ───────────────────────────────────────────────────────────

class TestGenerateCode:
    def test_missing_api_key_returns_placeholder(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        intelligence = valid_intelligence
        token_map = _build_token_map(intelligence)
        layout = _build_layout(intelligence)
        components = _build_components(intelligence)
        from app.schemas.ui_transform import RefinedUI
        refined_ui = RefinedUI(
            layout=layout,
            components=components,
            design_tokens=token_map,
            applied_patterns=["test"],
        )
        code = _generate_code(intelligence, refined_ui)
        assert code == "// ANTHROPIC_API_KEY not configured"

    def test_claude_success_returns_code(self, monkeypatch, valid_intelligence):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="const App = () => <div />;")]
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_message

        intelligence = valid_intelligence
        token_map = _build_token_map(intelligence)
        layout = _build_layout(intelligence)
        components = _build_components(intelligence)
        from app.schemas.ui_transform import RefinedUI
        refined_ui = RefinedUI(
            layout=layout, components=components,
            design_tokens=token_map, applied_patterns=["test"],
        )

        with patch("app.services.ui_transformer.anthropic.Anthropic", return_value=mock_client):
            code = _generate_code(intelligence, refined_ui)
        assert code == "const App = () => <div />;"

    def test_fenced_code_response_strips_fences(self, monkeypatch, valid_intelligence):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        raw_code = "const App = () => <div />;"
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=f"```tsx\n{raw_code}\n```")]
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_message

        intelligence = valid_intelligence
        token_map = _build_token_map(intelligence)
        layout = _build_layout(intelligence)
        components = _build_components(intelligence)
        from app.schemas.ui_transform import RefinedUI
        refined_ui = RefinedUI(
            layout=layout, components=components,
            design_tokens=token_map, applied_patterns=["test"],
        )

        with patch("app.services.ui_transformer.anthropic.Anthropic", return_value=mock_client):
            code = _generate_code(intelligence, refined_ui)
        assert "```" not in code
        assert raw_code in code

    def test_claude_exception_returns_error_comment(self, monkeypatch, valid_intelligence):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("rate limited")

        intelligence = valid_intelligence
        token_map = _build_token_map(intelligence)
        layout = _build_layout(intelligence)
        components = _build_components(intelligence)
        from app.schemas.ui_transform import RefinedUI
        refined_ui = RefinedUI(
            layout=layout, components=components,
            design_tokens=token_map, applied_patterns=["test"],
        )

        with patch("app.services.ui_transformer.anthropic.Anthropic", return_value=mock_client):
            code = _generate_code(intelligence, refined_ui)
        assert code.startswith("// Code generation error:")


# ─── transform_ui (full pipeline) ────────────────────────────────────────────

class TestTransformUI:
    def test_returns_ui_transform_response(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        assert isinstance(result, UITransformResponse)

    def test_layout_type_is_three_panel_workspace(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        assert result.refined_ui.layout.type == "three_panel_workspace"

    def test_three_panels_present(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        panels = result.refined_ui.layout.panels
        assert "sidebar" in panels
        assert "canvas" in panels
        assert "controls" in panels

    def test_code_field_present(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        assert isinstance(result.code, str)
        assert len(result.code) > 0

    def test_code_is_placeholder_without_api_key(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        assert result.code == "// ANTHROPIC_API_KEY not configured"

    def test_applied_patterns_nonempty(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        assert len(result.refined_ui.applied_patterns) > 0

    def test_applied_patterns_contain_recommendations(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        rec_patterns = [p for p in result.refined_ui.applied_patterns if "[high]" in p or "[medium]" in p or "[low]" in p]
        assert len(rec_patterns) == len(valid_intelligence.recommendations)

    def test_design_tokens_present(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        tokens = result.refined_ui.design_tokens
        assert tokens.bg_base
        assert tokens.border
        assert tokens.radius
        assert tokens.shadow

    def test_all_five_components_present(self, monkeypatch, valid_intelligence):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        c = result.refined_ui.components
        assert c.navbar
        assert c.hero
        assert c.cards
        assert c.buttons
        assert c.workspace

    def test_priority_order_high_first_in_patterns(self, monkeypatch, valid_intelligence):
        """Verify the deterministic priority ordering is respected in applied_patterns."""
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = transform_ui(valid_intelligence)
        patterns = result.refined_ui.applied_patterns
        high_pos = next(i for i, p in enumerate(patterns) if "[high]" in p)
        med_pos = next(i for i, p in enumerate(patterns) if "[medium]" in p)
        low_pos = next(i for i, p in enumerate(patterns) if "[low]" in p)
        assert high_pos < med_pos < low_pos

    def test_avoid_set_does_not_corrupt_output(self, monkeypatch, valid_intelligence):
        """Avoid list is consumed without crashing and output is valid."""
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        valid_intelligence.avoid = ["pill_buttons", "light_theme", "excessive_whitespace"]
        result = transform_ui(valid_intelligence)
        assert isinstance(result, UITransformResponse)


# ─── build_code_generation_prompt ─────────────────────────────────────────────

class TestBuildCodeGenerationPrompt:
    def test_contains_design_intelligence_section(self):
        prompt = build_code_generation_prompt({"goal": "test"}, {}, {})
        assert "Design Intelligence" in prompt

    def test_contains_refined_ui_section(self):
        prompt = build_code_generation_prompt({}, {"layout": "three_panel"}, {})
        assert "Refined UI Structure" in prompt

    def test_contains_tailwind_token_section(self):
        prompt = build_code_generation_prompt({}, {}, {"radius": "rounded-xl"})
        assert "Tailwind Token Map" in prompt

    def test_intelligence_data_serialized_as_json(self):
        intelligence = {"project_style_goal": "railway_style"}
        prompt = build_code_generation_prompt(intelligence, {}, {})
        assert "railway_style" in prompt

    def test_refined_ui_data_in_prompt(self):
        refined_ui = {"layout_type": "three_panel_workspace"}
        prompt = build_code_generation_prompt({}, refined_ui, {})
        assert "three_panel_workspace" in prompt

    def test_token_data_in_prompt(self):
        tokens = {"radius": "rounded-xl", "shadow": "shadow-sm"}
        prompt = build_code_generation_prompt({}, {}, tokens)
        assert "rounded-xl" in prompt

    def test_prompt_instructs_no_markdown_fences(self):
        prompt = build_code_generation_prompt({}, {}, {})
        assert "no markdown" in prompt.lower()
