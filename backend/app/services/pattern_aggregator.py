import json
import logging
import os

import anthropic

from app.prompts.competitor_analysis_prompt import build_aggregation_prompt
from app.schemas.competitors import CompetitorAnalysisResponse
from app.services.model_params import get_profile, STABLE

logger = logging.getLogger(__name__)


def aggregate_patterns(
    site_analyses: list[dict],
    style_goal: str,
    profile: str = STABLE,
) -> CompetitorAnalysisResponse:
    """Synthesize raw TinyFish outputs into unified design intelligence.

    The aggregator runs on the STABLE profile by default — callers that want
    to re-roll patterns (e.g. EXPLORE mode) pass the profile in explicitly.
    """
    prompt = build_aggregation_prompt(site_analyses, style_goal)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    params = get_profile(profile)

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        **params,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    data = json.loads(raw)

    # Backfill competitor_patterns.source_competitors from the input analyses
    # when the model forgets to include them — callers downstream rely on at
    # least *some* attribution to name-drop competitors in transformation_notes.
    cp = data.get("competitor_patterns") or {}
    if not cp.get("source_competitors"):
        cp["source_competitors"] = [
            s.get("url", "") for s in site_analyses if s.get("url")
        ]
        data["competitor_patterns"] = cp

    return CompetitorAnalysisResponse(**data)
