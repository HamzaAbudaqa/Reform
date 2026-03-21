import json
import logging
import os

import httpx

from app.prompts.competitor_analysis_prompt import SITE_EXTRACTION_GOAL

logger = logging.getLogger(__name__)

TINYFISH_SSE_URL = "https://agent.tinyfish.ai/v1/automation/run-sse"

# Fields we expect from TinyFish extraction, matching what the aggregator needs
EXPECTED_FIELDS = [
    "page_type", "layout", "visual_style", "components",
    "typography", "design_tokens", "ux_flow", "ux_quality",
]


def _get_api_key() -> str:
    api_key = os.environ.get("TINYFISH_API_KEY")
    if not api_key:
        raise RuntimeError("TINYFISH_API_KEY environment variable is not set")
    return api_key


def _parse_sse_events(text: str) -> list[dict]:
    """Parse raw SSE text into a list of event dicts."""
    events = []
    for line in text.strip().split("\n"):
        line = line.strip()
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                continue
    return events


def _normalize(raw: str, url: str) -> dict:
    """Parse TinyFish output into a consistent dict."""
    cleaned = raw.strip()

    # Strip markdown fences if present
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    # Try parsing as JSON
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            logger.info("TinyFish returned structured JSON for %s", url)
            return parsed
    except json.JSONDecodeError:
        pass

    # Fall back: wrap raw text in a known structure
    logger.info("TinyFish returned unstructured text for %s, wrapping", url)
    return {"page_type": "unknown", "raw_text": cleaned}


def extract_site_data(url: str) -> dict:
    """Use TinyFish to visit a URL and extract UI/UX design intelligence."""
    logger.info("TinyFish: navigating to %s", url)
    api_key = _get_api_key()

    with httpx.Client(timeout=180.0) as client:
        with client.stream(
            "POST",
            TINYFISH_SSE_URL,
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
            },
            json={"url": url, "goal": SITE_EXTRACTION_GOAL},
        ) as response:
            response.raise_for_status()
            raw_sse = response.read().decode("utf-8")

    events = _parse_sse_events(raw_sse)

    # Find the COMPLETE event with result
    result_data = None
    for event in events:
        if event.get("type") == "COMPLETE":
            if event.get("status") == "CANCELLED":
                raise RuntimeError(
                    f"TinyFish run cancelled: {event.get('error', 'unknown reason')}"
                )
            result_data = event.get("result")
            break

    if not result_data:
        raise RuntimeError(f"TinyFish returned no result for {url}")

    # result_data may be a dict (structured) or a string
    if isinstance(result_data, dict):
        raw_text = json.dumps(result_data)
    else:
        raw_text = str(result_data)

    logger.info("TinyFish: raw response from %s (%d chars)", url, len(raw_text))

    normalized = _normalize(raw_text, url)

    # Log which expected fields are present vs missing
    present = [f for f in EXPECTED_FIELDS if f in normalized]
    missing = [f for f in EXPECTED_FIELDS if f not in normalized]
    if missing:
        logger.warning("TinyFish output for %s missing fields: %s", url, missing)
    logger.info("TinyFish output for %s has fields: %s", url, present)

    return {"url": url, "raw_analysis": normalized}
