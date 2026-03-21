import logging
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Stream ElevenLabs TTS audio."""
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{req.voice_id}/stream"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url,
                headers={
                    "xi-api-key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "text": req.text,
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
                timeout=30.0,
            )
            if response.status_code != 200:
                logger.error("ElevenLabs error: %s %s", response.status_code, response.text)
                raise HTTPException(status_code=502, detail="TTS generation failed")

            return StreamingResponse(
                iter([response.content]),
                media_type="audio/mpeg",
                headers={"Content-Disposition": "inline"},
            )
        except httpx.RequestError as e:
            logger.error("ElevenLabs request failed: %s", e)
            raise HTTPException(status_code=502, detail=f"TTS request failed: {e}") from e
