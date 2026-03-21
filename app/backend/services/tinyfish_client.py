import logging
import os

from tinyfish import TinyFish

from app.backend.prompts.competitor_analysis_prompt import SITE_EXTRACTION_GOAL

logger = logging.getLogger(__name__)


def _get_client() -> TinyFish:
    api_key = os.environ.get("TINYFISH_API_KEY")
    if not api_key:
        raise RuntimeError("TINYFISH_API_KEY environment variable is not set")
    return TinyFish(api_key=api_key)


def extract_site_data(url: str) -> dict:
    """Use TinyFish to visit a URL and extract UI/UX design data."""
    logger.info("TinyFish: visiting %s", url)
    client = _get_client()

    result_text = ""
    with client.agent.stream(url=url, goal=SITE_EXTRACTION_GOAL) as stream:
        for event in stream:
            if hasattr(event, "result"):
                result_text = event.result
            elif hasattr(event, "data"):
                result_text = event.data

    logger.info("TinyFish: completed analysis for %s (%d chars)", url, len(result_text))
    return {"url": url, "raw_analysis": result_text}
