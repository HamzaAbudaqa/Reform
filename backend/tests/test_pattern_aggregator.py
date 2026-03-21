"""Tests for pattern_aggregator.py and the aggregation prompt builder."""
import json
from unittest.mock import MagicMock, patch

import pytest

from app.prompts.competitor_analysis_prompt import build_aggregation_prompt
from app.schemas.competitors import CompetitorAnalysisResponse
from app.services.mock_competitors import MOCK_RESPONSE
from app.services.pattern_aggregator import aggregate_patterns

SITE_ANALYSES = [
    {
        "url": "https://github.com",
        "raw_analysis": {"page_type": "developer_platform", "layout": ["sticky_nav"]},
    },
    {
        "url": "https://railway.app",
        "raw_analysis": {"page_type": "devtool", "layout": ["hero_section"]},
    },
]


def _make_claude_mock(response_text: str):
    """Build a mock anthropic.Anthropic that returns the given text."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=response_text)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    mock_anthropic_class = MagicMock(return_value=mock_client)
    return mock_anthropic_class


# ─── aggregate_patterns ───────────────────────────────────────────────────────

class TestAggregatePatterns:
    def test_valid_claude_response_parsed_into_schema(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        mock_anthropic = _make_claude_mock(json.dumps(MOCK_RESPONSE))
        with patch("app.services.pattern_aggregator.anthropic.Anthropic", mock_anthropic):
            result = aggregate_patterns(SITE_ANALYSES, "railway_style")
        assert isinstance(result, CompetitorAnalysisResponse)
        assert result.meta.project_style_goal == "github_railway_hybrid"

    def test_fenced_json_response_parsed(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fenced = f"```json\n{json.dumps(MOCK_RESPONSE)}\n```"
        mock_anthropic = _make_claude_mock(fenced)
        with patch("app.services.pattern_aggregator.anthropic.Anthropic", mock_anthropic):
            result = aggregate_patterns(SITE_ANALYSES, "test")
        assert isinstance(result, CompetitorAnalysisResponse)

    def test_fenced_json_without_language_tag_parsed(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        fenced = f"```\n{json.dumps(MOCK_RESPONSE)}\n```"
        mock_anthropic = _make_claude_mock(fenced)
        with patch("app.services.pattern_aggregator.anthropic.Anthropic", mock_anthropic):
            result = aggregate_patterns(SITE_ANALYSES, "test")
        assert isinstance(result, CompetitorAnalysisResponse)

    def test_missing_anthropic_api_key_falls_back_to_mock(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = aggregate_patterns(SITE_ANALYSES, "any_goal")
        assert isinstance(result, CompetitorAnalysisResponse)
        # Returns the canonical MOCK_RESPONSE
        assert result.meta.project_style_goal == MOCK_RESPONSE["meta"]["project_style_goal"]

    def test_anthropic_exception_falls_back_to_mock(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("Connection error")
        mock_anthropic = MagicMock(return_value=mock_client)
        with patch("app.services.pattern_aggregator.anthropic.Anthropic", mock_anthropic):
            result = aggregate_patterns(SITE_ANALYSES, "")
        assert isinstance(result, CompetitorAnalysisResponse)
        assert result.meta.project_style_goal == MOCK_RESPONSE["meta"]["project_style_goal"]

    def test_malformed_json_response_falls_back(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        mock_anthropic = _make_claude_mock("This is not JSON at all, sorry!")
        with patch("app.services.pattern_aggregator.anthropic.Anthropic", mock_anthropic):
            result = aggregate_patterns(SITE_ANALYSES, "")
        assert isinstance(result, CompetitorAnalysisResponse)
        assert result.meta.project_style_goal == MOCK_RESPONSE["meta"]["project_style_goal"]

    def test_valid_json_but_invalid_schema_falls_back(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        # Valid JSON but wrong structure for CompetitorAnalysisResponse
        bad_data = {"unexpected_key": "unexpected_value", "no_meta": True}
        mock_anthropic = _make_claude_mock(json.dumps(bad_data))
        with patch("app.services.pattern_aggregator.anthropic.Anthropic", mock_anthropic):
            result = aggregate_patterns(SITE_ANALYSES, "")
        # Pydantic validation fails → fallback
        assert isinstance(result, CompetitorAnalysisResponse)
        assert result.meta.project_style_goal == MOCK_RESPONSE["meta"]["project_style_goal"]

    def test_fallback_response_conforms_to_schema(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        result = aggregate_patterns(SITE_ANALYSES, "")
        # Full schema validation — no AttributeError, correct types
        assert isinstance(result.meta.confidence.layout_patterns, float)
        assert isinstance(result.design_tokens.shadow.sm, str)
        assert isinstance(result.design_tokens.border.default, str)
        assert isinstance(result.design_tokens.motion.easing, str)
        assert isinstance(result.design_tokens.typography.font_family, str)

    def test_claude_called_with_correct_model(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        mock_anthropic = _make_claude_mock(json.dumps(MOCK_RESPONSE))
        with patch("app.services.pattern_aggregator.anthropic.Anthropic", mock_anthropic):
            aggregate_patterns(SITE_ANALYSES, "")
        create_call = mock_anthropic.return_value.messages.create
        assert create_call.call_args.kwargs["model"] == "claude-sonnet-4-6"


# ─── build_aggregation_prompt ─────────────────────────────────────────────────

class TestBuildAggregationPrompt:
    def test_prompt_contains_style_goal(self):
        prompt = build_aggregation_prompt(SITE_ANALYSES, "railway_style")
        assert "railway_style" in prompt

    def test_style_goal_section_present_when_goal_set(self):
        prompt = build_aggregation_prompt(SITE_ANALYSES, "github_hybrid")
        assert "STYLE GOAL" in prompt

    def test_style_goal_section_absent_when_goal_empty(self):
        prompt = build_aggregation_prompt(SITE_ANALYSES, "")
        assert "STYLE GOAL" not in prompt

    def test_prompt_contains_first_site_url(self):
        prompt = build_aggregation_prompt(SITE_ANALYSES, "")
        assert "https://github.com" in prompt

    def test_prompt_contains_second_site_url(self):
        prompt = build_aggregation_prompt(SITE_ANALYSES, "")
        assert "https://railway.app" in prompt

    def test_prompt_labels_sites_with_numbers(self):
        prompt = build_aggregation_prompt(SITE_ANALYSES, "")
        assert "Site 1:" in prompt
        assert "Site 2:" in prompt

    def test_prompt_contains_raw_analysis_data(self):
        prompt = build_aggregation_prompt(SITE_ANALYSES, "")
        assert "developer_platform" in prompt

    def test_single_site_prompt(self):
        single = [SITE_ANALYSES[0]]
        prompt = build_aggregation_prompt(single, "test")
        assert "Site 1:" in prompt
        assert "Site 2:" not in prompt

    def test_style_goal_in_meta_section_of_prompt(self):
        prompt = build_aggregation_prompt(SITE_ANALYSES, "my_goal")
        # The prompt template uses style_goal in the JSON template
        assert "my_goal" in prompt

    def test_empty_analyses_produces_valid_prompt_string(self):
        prompt = build_aggregation_prompt([], "some_goal")
        assert isinstance(prompt, str)
        assert len(prompt) > 0
