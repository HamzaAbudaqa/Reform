import json
import logging
import os
import subprocess
import tempfile

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Receive audio from browser MediaRecorder (webm/ogg/mp4),
    convert to 16-bit wav via ffmpeg, send to Google Speech API directly.
    No speech_recognition library needed — avoids the flac-mac issue on Apple Silicon.
    """
    contents = await audio.read()
    if len(contents) < 100:
        return {"transcript": "", "error": None}

    content_type = audio.content_type or ""
    filename = audio.filename or "audio.webm"
    logger.info("Transcribe: %s, %s, %d bytes", filename, content_type, len(contents))

    if "webm" in content_type or filename.endswith(".webm"):
        ext = "webm"
    elif "ogg" in content_type:
        ext = "ogg"
    elif "mp4" in content_type or "m4a" in content_type:
        ext = "mp4"
    else:
        ext = "webm"

    tmp_in = None
    tmp_out = None
    try:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
            f.write(contents)
            tmp_in = f.name

        # Convert to 16-bit 16kHz mono wav using ffmpeg
        tmp_out = tmp_in + ".wav"
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_in, "-ar", "16000", "-ac", "1",
             "-sample_fmt", "s16", "-f", "wav", tmp_out],
            capture_output=True, text=True, timeout=10,
        )

        if result.returncode != 0:
            logger.error("ffmpeg stderr: %s", result.stderr[-300:] if result.stderr else "")
            return {"transcript": "", "error": "Audio conversion failed"}

        # Read wav data
        with open(tmp_out, "rb") as f:
            wav_data = f.read()

        # Send directly to Google Speech API (same endpoint speech_recognition uses)
        url = (
            "http://www.google.com/speech-api/v2/recognize"
            "?client=chromium&lang=en-US&key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw"
        )

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                content=wav_data,
                headers={"Content-Type": "audio/l16; rate=16000;"},
                timeout=10.0,
            )

        if resp.status_code != 200:
            logger.error("Google API returned %d: %s", resp.status_code, resp.text[:200])
            return {"transcript": "", "error": f"Google API error: {resp.status_code}"}

        # Parse response — Google returns multiple JSON lines
        transcript = ""
        for line in resp.text.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                results = data.get("result", [])
                for r in results:
                    alts = r.get("alternative", [])
                    if alts:
                        transcript = alts[0].get("transcript", "")
                        if transcript:
                            break
            except json.JSONDecodeError:
                continue

        logger.info("Transcribed: '%s'", transcript)
        return {"transcript": transcript, "error": None}

    except Exception as e:
        logger.error("Transcription error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        if tmp_in and os.path.exists(tmp_in):
            os.unlink(tmp_in)
        if tmp_out and os.path.exists(tmp_out):
            os.unlink(tmp_out)
