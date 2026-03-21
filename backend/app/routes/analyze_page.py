import json
import logging
import re

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.screenshot import take_screenshot_b64, take_screenshot_with_css_b64
from app.prompts.ux_analysis_prompt import get_ux_analysis_prompt

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalyzePageRequest(BaseModel):
    url: str
    heatmap_type: str = "attention"


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if Claude wraps the JSON in them."""
    stripped = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    match = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", stripped)
    if match:
        return match.group(1).strip()
    return stripped


@router.post("/analyze-page")
def analyze_page(body: AnalyzePageRequest):
    try:
        screenshot_b64 = take_screenshot_b64(body.url)
    except Exception as exc:
        logger.exception("Screenshot failed for %s", body.url)
        raise HTTPException(status_code=500, detail=f"Screenshot failed: {exc}") from exc

    system_prompt, user_prompt = get_ux_analysis_prompt(body.heatmap_type)

    try:
        client = anthropic.Anthropic()
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": screenshot_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": user_prompt,
                        },
                    ],
                }
            ],
        )
    except Exception as exc:
        logger.exception("Claude API call failed")
        raise HTTPException(status_code=500, detail=f"Claude API error: {exc}") from exc

    raw_text = message.content[0].text
    cleaned = _strip_fences(raw_text)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Claude response as JSON: %s", raw_text[:500])
        raise HTTPException(status_code=500, detail=f"Claude returned invalid JSON: {exc}") from exc

    css_patch = data.get("css_patch", "")

    try:
        after_screenshot_b64 = take_screenshot_with_css_b64(body.url, css_patch) if css_patch else screenshot_b64
    except Exception as exc:
        logger.error("After screenshot failed: %s", exc)
        after_screenshot_b64 = screenshot_b64

    return {
        "screenshot_b64": screenshot_b64,
        "after_screenshot_b64": after_screenshot_b64,
        "before": data.get("before", {}),
        "after": data.get("after", {}),
        "analytics": data.get("analytics", {}),
    }
