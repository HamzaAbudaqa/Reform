import logging
import os

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class SuggestEditRequest(BaseModel):
    suggestion: str
    current_code: str
    analysis_context: dict | None = None


class SuggestEditResponse(BaseModel):
    revised_code: str
    summary: str


@router.post("/suggest-edit", response_model=SuggestEditResponse)
async def suggest_edit_endpoint(req: SuggestEditRequest):
    """
    Takes a user suggestion prompt and the current generated code,
    sends it to Claude to produce a revised version.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    prompt = f"""You are a senior React + Tailwind engineer. The user has a generated UI component and wants to make a specific edit.

## Current Code
{req.current_code}

## User's Requested Edit
{req.suggestion}

## Analysis Context
{req.analysis_context if req.analysis_context else "No additional context."}

---

## Instructions
1. Apply the user's requested edit to the current code.
2. Keep all existing functionality intact unless the edit explicitly changes it.
3. Maintain the same dark theme, Tailwind classes, and code style.
4. Return ONLY the revised code — no markdown fences, no explanation.

Start directly with the import line or component definitions."""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:])
            if raw.endswith("```"):
                raw = raw[: raw.rfind("```")].strip()

        # Generate a short summary of the change
        summary_msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            messages=[
                {
                    "role": "user",
                    "content": f"""Generate a Git commit title for this UI change. RULES: 3-7 words only, no punctuation, no code terms (no className, div, Tailwind, etc.), focus on user-level impact, action-oriented. Examples: "Improve layout spacing consistency", "Fix background height issues", "Enhance CTA visibility". Change: {req.suggestion}""",
                }
            ],
        )
        summary = summary_msg.content[0].text.strip()

        return SuggestEditResponse(revised_code=raw, summary=summary)

    except Exception as e:
        logger.error("Suggest edit failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Edit suggestion failed: {e}") from e
