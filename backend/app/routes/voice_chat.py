import logging
import os

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class VoiceChatRequest(BaseModel):
    user_message: str
    conversation_history: list[dict] = []
    analysis_context: dict | None = None


class VoiceChatResponse(BaseModel):
    response: str
    final_prompt: str | None = None


SYSTEM_PROMPT = """You are Reform Voice, a concise AI assistant that helps users describe what UI changes they want. Your job is to gather enough information to create a clear, actionable edit prompt — like a user would type in a text box.

Rules:
- Ask 1-2 SHORT clarifying questions max (one sentence each)
- Once you understand what the user wants, respond with EXACTLY this format:
  GOT IT: [one paragraph describing the full change request in detail, as if the user typed it themselves]
- The GOT IT paragraph should be specific enough for a code-generation AI to implement it
- Keep all responses under 2 sentences since they are spoken aloud
- Be warm but brief

Examples of GOT IT prompts:
- "GOT IT: Change the primary accent color from purple to emerald green across all buttons, links, and highlighted elements while keeping the dark background unchanged."
- "GOT IT: Add a collapsible sidebar with navigation items for Dashboard, Settings, and Profile, using the existing dark theme with subtle border separators."
- "GOT IT: Redesign the hero section to use a split layout with headline text on the left and a product screenshot on the right, maintaining the current color scheme."

If the user's first message is already clear and specific enough, skip questions and go straight to GOT IT."""


@router.post("/voice-chat", response_model=VoiceChatResponse)
async def voice_chat_endpoint(req: VoiceChatRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    messages = []
    for msg in req.conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    context_note = ""
    if req.analysis_context:
        meta = req.analysis_context.get("meta", {})
        context_note = f"\n\nContext: The user is working on a {meta.get('description', 'web application')} with style goal: {meta.get('project_style_goal', 'modern')}."

    messages.append({
        "role": "user",
        "content": req.user_message + context_note if not req.conversation_history else req.user_message,
    })

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        response_text = message.content[0].text.strip()

        # Check if AI produced a final prompt
        final_prompt = None
        if "GOT IT:" in response_text:
            final_prompt = response_text.split("GOT IT:", 1)[1].strip()
            response_text = "Got it! I'll apply that change now."

        return VoiceChatResponse(response=response_text, final_prompt=final_prompt)

    except Exception as e:
        logger.error("Voice chat failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Voice chat failed: {e}") from e
