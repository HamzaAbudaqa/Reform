"""Google Stitch backend routes.

Two endpoints:
  POST /stitch/ingest                → ingest N Stitch URLs, return per-URL designs
  POST /stitch/design-intelligence   → same ingestion + an aggregated payload
                                       shaped like a design-intelligence blob so
                                       callers can drop it into the transform
                                       pipeline's existing inputs.

The routes are purely additive. They do not modify the transform pipeline
or any existing route behavior; a frontend opts in by calling them.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.stitch import (
    StitchDesignIntelligenceRequest,
    StitchDesignIntelligenceResponse,
    StitchIngestRequest,
    StitchIngestResponse,
)
from app.services.anthropic_errors import (
    is_anthropic_exception,
    log_and_classify,
)
from app.services.stitch_client import (
    STITCH_ENABLED,
    fetch_stitch_designs,
    is_allowed_stitch_url,
    merge_stitch_designs,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stitch", tags=["stitch"])


def _require_enabled() -> None:
    if not STITCH_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Stitch ingestion is disabled. Set STITCH_ENABLED=true to enable.",
        )


def _validate_urls(urls: list[str]) -> list[str]:
    """Return the validated URLs; raise 400 with specifics on the first bad one."""
    cleaned: list[str] = []
    for u in urls:
        u_str = str(u)
        if not is_allowed_stitch_url(u_str):
            raise HTTPException(
                status_code=400,
                detail=f"URL not on Stitch allowlist: {u_str}",
            )
        cleaned.append(u_str)
    return cleaned


@router.post("/ingest", response_model=StitchIngestResponse)
async def ingest_endpoint(request: StitchIngestRequest) -> StitchIngestResponse:
    _require_enabled()
    urls = _validate_urls([str(u) for u in request.urls])
    logger.info("Stitch ingest: %d urls (label=%r)", len(urls), request.label)

    try:
        designs = await fetch_stitch_designs(urls)
    except Exception as e:
        if is_anthropic_exception(e):
            info = log_and_classify(e)
            raise HTTPException(status_code=info.http_status, detail=info.user_message) from e
        logger.error("Stitch ingest failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}") from e

    # Carry the caller's label through to each design if provided.
    if request.label:
        for d in designs:
            if not d.label:
                d.label = request.label

    return StitchIngestResponse(designs=designs)


@router.post("/design-intelligence", response_model=StitchDesignIntelligenceResponse)
async def design_intelligence_endpoint(
    request: StitchDesignIntelligenceRequest,
) -> StitchDesignIntelligenceResponse:
    _require_enabled()
    urls = _validate_urls([str(u) for u in request.urls])
    logger.info(
        "Stitch design-intelligence: %d urls (style_goal=%r)",
        len(urls), request.style_goal,
    )

    try:
        designs = await fetch_stitch_designs(urls, context=request.style_goal or "")
    except Exception as e:
        if is_anthropic_exception(e):
            info = log_and_classify(e)
            raise HTTPException(status_code=info.http_status, detail=info.user_message) from e
        logger.error("Stitch design-intelligence failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Design-intelligence failed: {e}") from e

    merged_patterns, merged_tokens = merge_stitch_designs(designs)
    successful_urls = [d.url for d in designs if not d.error]

    return StitchDesignIntelligenceResponse(
        style_goal=request.style_goal,
        designs=designs,
        merged_patterns=merged_patterns,
        merged_tokens=merged_tokens,
        source_urls=successful_urls,
    )
