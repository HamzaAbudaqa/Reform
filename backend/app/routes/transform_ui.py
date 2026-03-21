import logging

from fastapi import APIRouter, HTTPException

from app.schemas.ui_transform import DesignIntelligence, UITransformResponse
from app.services.ui_transformer import transform_ui

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/transform-ui", response_model=UITransformResponse)
async def transform_ui_endpoint(intelligence: DesignIntelligence):
    """
    Transform structured design intelligence into a refined UI structure
    and React + Tailwind component code.

    Input: the full JSON output from the TinyFish analysis pipeline.
    Output: refined_ui (structured) + code (React + Tailwind TSX).
    """
    logger.info(
        "POST /transform-ui — style_goal=%s sources=%d",
        intelligence.meta.project_style_goal,
        len(intelligence.sources),
    )

    try:
        result = transform_ui(intelligence)
    except Exception as e:
        logger.error("Transform failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transform error: {e}") from e

    logger.info(
        "Transform complete — patterns_applied=%d code_chars=%d",
        len(result.refined_ui.applied_patterns),
        len(result.code),
    )
    return result
