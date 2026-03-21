import logging

from fastapi import APIRouter, HTTPException

from app.schemas.competitors import CompetitorAnalysisResponse, CompetitorRequest
from app.services.competitor_analyzer import analyze_competitors
from app.services.tinyfish_client import EXPECTED_FIELDS, extract_site_data

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_URLS = 5


@router.post("/analyze-competitors", response_model=CompetitorAnalysisResponse)
async def analyze_competitors_endpoint(request: CompetitorRequest):
    if not request.urls:
        raise HTTPException(status_code=400, detail="At least one URL is required")

    if len(request.urls) > MAX_URLS:
        raise HTTPException(
            status_code=400, detail=f"Maximum {MAX_URLS} URLs allowed per request"
        )

    urls = [str(u) for u in request.urls]
    logger.info("Analyzing %d competitor URLs: %s", len(urls), urls)

    result = analyze_competitors(urls, request.style_goal)
    return result


@router.post("/extract-raw")
async def extract_raw_endpoint(request: CompetitorRequest):
    """TinyFish-only extraction. No Claude. Returns raw TinyFish output per URL."""
    if not request.urls:
        raise HTTPException(status_code=400, detail="At least one URL is required")

    if len(request.urls) > MAX_URLS:
        raise HTTPException(
            status_code=400, detail=f"Maximum {MAX_URLS} URLs allowed per request"
        )

    results = []
    for url in request.urls:
        url_str = str(url)
        try:
            data = extract_site_data(url_str)
            analysis = data["raw_analysis"]
            present = [f for f in EXPECTED_FIELDS if f in analysis]
            missing = [f for f in EXPECTED_FIELDS if f not in analysis]
            results.append({
                "url": url_str,
                "status": "ok",
                "data": analysis,
                "field_coverage": {
                    "present": present,
                    "missing": missing,
                    "coverage": f"{len(present)}/{len(EXPECTED_FIELDS)}",
                },
            })
        except Exception as e:
            results.append({"url": url_str, "status": "error", "error": str(e)})

    return {"results": results}
