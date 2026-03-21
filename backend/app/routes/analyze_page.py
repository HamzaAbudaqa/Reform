import json
import logging
import re

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.screenshot import take_screenshot_b64
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


def _generate_html_preview(client: anthropic.Anthropic, screenshot_b64: str, after_annotations: list, url: str) -> str:
    """Generate a standalone Tailwind HTML preview of the improved UI."""
    improvements = "\n".join(
        f"- {ann.get('label', '')}: {ann.get('detail', '')}"
        for ann in after_annotations
    )
    try:
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/png", "data": screenshot_b64},
                    },
                    {
                        "type": "text",
                        "text": f"""You are a UI designer. Based on this screenshot and the UX improvements below, generate a standalone HTML page that visually shows what the IMPROVED version would look like.

URL being improved: {url}

UX improvements to apply:
{improvements}

Rules:
- Output ONLY valid HTML, no markdown, no explanation
- Include <script src="https://cdn.tailwindcss.com"></script> in the <head>
- Recreate the page's approximate content and structure from the screenshot
- Apply ALL improvements listed (e.g. convert text links to proper buttons, add card containers, fill empty space with supporting content)
- Match the original color scheme but with improvements applied
- Make it look like a real rendered page, not a wireframe
- Start with <!DOCTYPE html>""",
                    },
                ],
            }],
        )
        raw = msg.content[0].text.strip()
        # Strip fences if model wraps output
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:])
            if raw.endswith("```"):
                raw = raw[:raw.rfind("```")].strip()
        return raw
    except Exception as exc:
        logger.error("HTML preview generation failed: %s", exc)
        return f"<html><body style='background:#0d0c16;color:white;padding:2rem;font-family:sans-serif'><p>Preview generation failed: {exc}</p></body></html>"


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

    after_annotations = data.get("after", {}).get("annotations", [])
    html_preview = _generate_html_preview(client, screenshot_b64, after_annotations, body.url)

    return {
        "screenshot_b64": screenshot_b64,
        "before": data.get("before", {}),
        "after": data.get("after", {}),
        "analytics": data.get("analytics", {}),
        "html_preview": html_preview,
    }
