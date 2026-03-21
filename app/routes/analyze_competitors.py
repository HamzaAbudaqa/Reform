import logging

from fastapi import APIRouter, HTTPException

from app.schemas.competitors import CompetitorAnalysisResponse, CompetitorRequest
from app.services.competitor_analyzer import analyze_competitors

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
