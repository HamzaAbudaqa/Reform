"""Tests for all Pydantic schemas — valid inputs, invalid inputs, required fields."""
import pytest
from pydantic import ValidationError

from app.schemas.competitors import (
    BorderTokens,
    CompetitorAnalysisResponse,
    CompetitorRequest,
    Components,
    DesignTokens,
    Flows,
    GlobalPatterns,
    Meta,
    MotionTokens,
    Recommendation,
    ShadowTokens,
    SourceAnalysis,
    Typography,
)
from app.schemas.ui_transform import (
    ColorTokens,
    ComponentsBlock,
    ComponentSpec,
    ConfidenceScores,
    DesignIntelligence,
    DesignTokens as TransformDesignTokens,
    FlowMapping,
    Flows as TransformFlows,
    GlobalPatterns as TransformGlobalPatterns,
    MetaBlock,
    PanelConfig,
    Recommendation as TransformRecommendation,
    RefinedButtonSpec,
    RefinedCardSpec,
    RefinedComponents,
    RefinedHeroSpec,
    RefinedLayout,
    RefinedNavbarSpec,
    RefinedUI,
    RefinedWorkspaceSpec,
    SourceBlock,
    TailwindTokenMap,
    UITransformResponse,
)
from app.services.mock_competitors import MOCK_RESPONSE
from tests.conftest import VALID_INTELLIGENCE_BODY


# ─── CompetitorRequest ────────────────────────────────────────────────────────

class TestCompetitorRequest:
    def test_valid_single_url(self):
        req = CompetitorRequest(urls=["https://github.com"])
        assert len(req.urls) == 1

    def test_valid_multiple_urls(self):
        req = CompetitorRequest(urls=["https://github.com", "https://railway.app"])
        assert len(req.urls) == 2

    def test_default_style_goal_is_empty_string(self):
        req = CompetitorRequest(urls=["https://github.com"])
        assert req.style_goal == ""

    def test_explicit_style_goal(self):
        req = CompetitorRequest(urls=["https://github.com"], style_goal="railway_hybrid")
        assert req.style_goal == "railway_hybrid"

    def test_invalid_url_raises(self):
        with pytest.raises(ValidationError):
            CompetitorRequest(urls=["not-a-valid-url"])

    def test_plain_string_not_url_raises(self):
        with pytest.raises(ValidationError):
            CompetitorRequest(urls=["github"])

    def test_empty_urls_list_accepted_by_schema(self):
        # The schema does NOT enforce non-empty; that's the route's job
        req = CompetitorRequest(urls=[])
        assert req.urls == []

    def test_missing_urls_field_raises(self):
        with pytest.raises(ValidationError):
            CompetitorRequest()  # type: ignore[call-arg]

    def test_five_urls_accepted(self):
        urls = [f"https://example{i}.com" for i in range(5)]
        req = CompetitorRequest(urls=urls)
        assert len(req.urls) == 5


# ─── CompetitorAnalysisResponse ───────────────────────────────────────────────

class TestCompetitorAnalysisResponse:
    def test_mock_response_is_valid(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert response.meta.project_style_goal == "github_railway_hybrid"

    def test_meta_confidence_scores(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert 0.0 <= response.meta.confidence.layout_patterns <= 1.0
        assert 0.0 <= response.meta.confidence.visual_style <= 1.0
        assert 0.0 <= response.meta.confidence.ux_flow <= 1.0

    def test_sources_count(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert len(response.sources) == 2

    def test_sources_have_required_fields(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        for source in response.sources:
            assert source.url
            assert source.page_type
            assert source.summary

    def test_global_patterns_structure(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert isinstance(response.global_patterns.layout, list)
        assert isinstance(response.global_patterns.visual_style, list)
        assert isinstance(response.global_patterns.ux_principles, list)
        assert len(response.global_patterns.layout) > 0

    def test_components_all_present(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert isinstance(response.components.navbar.patterns, list)
        assert isinstance(response.components.hero.patterns, list)
        assert isinstance(response.components.cards.patterns, list)
        assert isinstance(response.components.buttons.patterns, list)
        assert isinstance(response.components.workspace.patterns, list)
        assert isinstance(response.components.forms_controls.patterns, list)

    def test_design_tokens_typography(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        typo = response.design_tokens.typography
        assert typo.font_family == "Inter, system-ui, sans-serif"
        assert typo.font_mono == "JetBrains Mono, monospace"
        assert typo.weight_normal == "400"
        assert typo.weight_medium == "500"
        assert typo.weight_bold == "700"
        assert isinstance(typo.scale, list)

    def test_design_tokens_shadow_structured(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        shadow = response.design_tokens.shadow
        assert shadow.sm
        assert shadow.md
        assert shadow.lg

    def test_design_tokens_border_structured(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert response.design_tokens.border.default

    def test_design_tokens_motion_structured(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        motion = response.design_tokens.motion
        assert motion.duration_fast == "150ms"
        assert motion.duration_normal == "200ms"
        assert motion.easing == "ease-out"

    def test_design_tokens_colors_dict(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert isinstance(response.design_tokens.colors, dict)
        assert "background" in response.design_tokens.colors
        assert "accent_primary" in response.design_tokens.colors

    def test_design_tokens_spacing_scale_strings(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert isinstance(response.design_tokens.spacing_scale, list)
        # In CompetitorAnalysisResponse, spacing_scale is list[str]
        assert all(isinstance(s, str) for s in response.design_tokens.spacing_scale)

    def test_flows_structure(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert isinstance(response.flows.primary_user_flow, list)
        assert isinstance(response.flows.interaction_patterns, list)
        assert isinstance(response.flows.layout_flow_mapping, dict)

    def test_recommendations_structure(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert len(response.recommendations) > 0
        for rec in response.recommendations:
            assert rec.priority in ("high", "medium", "low")
            assert rec.target
            assert rec.action

    def test_avoid_list(self):
        response = CompetitorAnalysisResponse(**MOCK_RESPONSE)
        assert isinstance(response.avoid, list)
        assert len(response.avoid) > 0

    def test_missing_meta_raises(self):
        data = {k: v for k, v in MOCK_RESPONSE.items() if k != "meta"}
        with pytest.raises(ValidationError):
            CompetitorAnalysisResponse(**data)

    def test_missing_design_tokens_raises(self):
        data = {k: v for k, v in MOCK_RESPONSE.items() if k != "design_tokens"}
        with pytest.raises(ValidationError):
            CompetitorAnalysisResponse(**data)

    def test_missing_flows_raises(self):
        data = {k: v for k, v in MOCK_RESPONSE.items() if k != "flows"}
        with pytest.raises(ValidationError):
            CompetitorAnalysisResponse(**data)


# ─── DesignIntelligence (ui_transform schema) ─────────────────────────────────

class TestDesignIntelligence:
    def test_valid_body_parses(self):
        intelligence = DesignIntelligence(**VALID_INTELLIGENCE_BODY)
        assert intelligence.meta.project_style_goal == "railway_style"

    def test_dark_theme_accepted(self):
        intelligence = DesignIntelligence(**VALID_INTELLIGENCE_BODY)
        assert intelligence.design_tokens.theme == "dark"

    def test_light_theme_accepted(self):
        import copy
        body = copy.deepcopy(VALID_INTELLIGENCE_BODY)
        body["design_tokens"]["theme"] = "light"
        intelligence = DesignIntelligence(**body)
        assert intelligence.design_tokens.theme == "light"

    def test_invalid_theme_raises(self):
        import copy
        body = copy.deepcopy(VALID_INTELLIGENCE_BODY)
        body["design_tokens"]["theme"] = "mixed"  # not allowed in ui_transform schema
        with pytest.raises(ValidationError):
            DesignIntelligence(**body)

    def test_spacing_scale_must_be_ints(self):
        import copy
        body = copy.deepcopy(VALID_INTELLIGENCE_BODY)
        body["design_tokens"]["spacing_scale"] = ["4px", "8px"]  # strings not ints
        with pytest.raises(ValidationError):
            DesignIntelligence(**body)

    def test_spacing_scale_is_list_of_ints(self):
        intelligence = DesignIntelligence(**VALID_INTELLIGENCE_BODY)
        assert all(isinstance(v, int) for v in intelligence.design_tokens.spacing_scale)

    def test_color_tokens_required_fields(self):
        intelligence = DesignIntelligence(**VALID_INTELLIGENCE_BODY)
        c = intelligence.design_tokens.colors
        assert c.background == "#0d1117"
        assert c.panel == "#161b22"
        assert c.border
        assert c.text_primary
        assert c.text_secondary
        assert c.accent

    def test_flow_mapping_required_fields(self):
        intelligence = DesignIntelligence(**VALID_INTELLIGENCE_BODY)
        fm = intelligence.flows.layout_flow_mapping
        assert fm.sidebar == "navigation_panel"
        assert fm.main_canvas == "visual_output_area"
        assert fm.right_panel == "controls_panel"

    def test_recommendations_priority_literal(self):
        intelligence = DesignIntelligence(**VALID_INTELLIGENCE_BODY)
        for rec in intelligence.recommendations:
            assert rec.priority in ("high", "medium", "low")

    def test_invalid_recommendation_priority_raises(self):
        import copy
        body = copy.deepcopy(VALID_INTELLIGENCE_BODY)
        body["recommendations"][0]["priority"] = "critical"  # not a valid literal
        with pytest.raises(ValidationError):
            DesignIntelligence(**body)

    def test_avoid_is_list_of_strings(self):
        intelligence = DesignIntelligence(**VALID_INTELLIGENCE_BODY)
        assert all(isinstance(s, str) for s in intelligence.avoid)

    def test_missing_meta_raises(self):
        import copy
        body = copy.deepcopy(VALID_INTELLIGENCE_BODY)
        del body["meta"]
        with pytest.raises(ValidationError):
            DesignIntelligence(**body)

    def test_missing_flows_raises(self):
        import copy
        body = copy.deepcopy(VALID_INTELLIGENCE_BODY)
        del body["flows"]
        with pytest.raises(ValidationError):
            DesignIntelligence(**body)

    def test_missing_color_field_raises(self):
        import copy
        body = copy.deepcopy(VALID_INTELLIGENCE_BODY)
        del body["design_tokens"]["colors"]["accent"]
        with pytest.raises(ValidationError):
            DesignIntelligence(**body)

    def test_missing_flow_mapping_field_raises(self):
        import copy
        body = copy.deepcopy(VALID_INTELLIGENCE_BODY)
        del body["flows"]["layout_flow_mapping"]["sidebar"]
        with pytest.raises(ValidationError):
            DesignIntelligence(**body)


# ─── Output schemas ───────────────────────────────────────────────────────────

class TestUITransformOutputSchemas:
    def test_tailwind_token_map_valid(self):
        token_map = TailwindTokenMap(
            bg_base="bg-[#0d1117]",
            bg_panel="bg-[#161b22]",
            border="border border-[rgba(240,246,252,0.1)]",
            text_primary="text-[#f0f6fc]",
            text_secondary="text-[#8b949e]",
            accent_bg="bg-[#58a6ff]",
            accent_text="text-[#58a6ff]",
            radius="rounded-xl",
            spacing=["p-1", "p-2", "p-3", "p-4", "p-6", "p-8"],
            gap=["gap-1", "gap-2", "gap-3", "gap-4", "gap-6", "gap-8"],
            shadow="shadow-sm",
        )
        assert token_map.radius == "rounded-xl"
        assert len(token_map.spacing) == 6

    def test_tailwind_token_map_missing_field_raises(self):
        with pytest.raises(ValidationError):
            TailwindTokenMap(
                bg_base="bg-[#0d1117]",
                # missing required fields
            )  # type: ignore[call-arg]

    def test_ui_transform_response_valid(self):
        panel = PanelConfig(role="nav", width="w-64", classes="flex flex-col")
        layout = RefinedLayout(
            type="three_panel_workspace",
            panels={"sidebar": panel},
            gap="gap-4",
            segmentation=["card_based"],
        )
        components = RefinedComponents(
            navbar=RefinedNavbarSpec(layout="logo_left", classes="flex"),
            hero=RefinedHeroSpec(layout="left_text", headline_size="text-4xl font-bold", classes="flex"),
            cards=RefinedCardSpec(radius="rounded-xl", border="border", padding="p-4", shadow="shadow-sm", classes="rounded-xl"),
            buttons=RefinedButtonSpec(primary_classes="bg-blue-500", secondary_classes="bg-gray-800", radius="rounded-md", height="h-9"),
            workspace=RefinedWorkspaceSpec(layout="three_panel", classes="flex"),
        )
        token_map = TailwindTokenMap(
            bg_base="bg-[#0d1117]", bg_panel="bg-[#161b22]",
            border="border", text_primary="text-[#fff]", text_secondary="text-[#888]",
            accent_bg="bg-[#5555ff]", accent_text="text-[#5555ff]",
            radius="rounded-xl", spacing=["p-1"], gap=["gap-1"], shadow="shadow-sm",
        )
        refined_ui = RefinedUI(layout=layout, components=components, design_tokens=token_map, applied_patterns=["[high] layout: use_three_panel"])
        response = UITransformResponse(refined_ui=refined_ui, code="// code here")
        assert response.code == "// code here"
        assert response.refined_ui.layout.type == "three_panel_workspace"
