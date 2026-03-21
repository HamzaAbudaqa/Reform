"""
Minimal adapter: converts CompetitorAnalysisResponse (Hamza's output)
into DesignIntelligence (Alan's input).

Exists because the two schemas were designed independently:
- Hamza's colors use accent_primary/accent_secondary/success/warning/error + surface
- Alan's colors use accent + panel
- Hamza's spacing_scale is list[str] ("4px"), Alan's is list[int] (4)
- Hamza's shadow/border are structured objects, Alan's are strings
- Hamza's flows.layout_flow_mapping is dict[str, str], Alan's is a fixed 3-field model
- Hamza's theme is open str, Alan's is Literal["dark", "light"]

This adapter bridges the gap without changing either schema.
"""

import logging

from app.schemas.competitors import CompetitorAnalysisResponse
from app.schemas.ui_transform import DesignIntelligence

logger = logging.getLogger(__name__)


def analysis_to_transform_input(analysis: CompetitorAnalysisResponse) -> DesignIntelligence:
    """Convert Hamza's analysis response to Alan's transform input."""
    data = analysis.model_dump()

    # --- Fix colors ---
    colors = data["design_tokens"]["colors"]
    adapted_colors = {
        "background": colors.get("background", "#0d1117"),
        "panel": colors.get("surface", colors.get("background", "#161b22")),
        "border": colors.get("border", "rgba(255,255,255,0.1)"),
        "text_primary": colors.get("text_primary", "#f0f6fc"),
        "text_secondary": colors.get("text_secondary", "#8b949e"),
        "accent": colors.get("accent_primary", colors.get("accent", "#58a6ff")),
    }

    # --- Fix spacing_scale: list[str] -> list[int] ---
    raw_spacing = data["design_tokens"].get("spacing_scale", [])
    adapted_spacing = []
    for val in raw_spacing:
        if isinstance(val, int):
            adapted_spacing.append(val)
        elif isinstance(val, str):
            adapted_spacing.append(int(val.replace("px", "")))
        else:
            adapted_spacing.append(16)

    # --- Fix shadow: ShadowTokens -> str ---
    shadow = data["design_tokens"].get("shadow", {})
    if isinstance(shadow, dict):
        adapted_shadow = shadow.get("md", "shadow-sm")
    else:
        adapted_shadow = str(shadow)

    # --- Fix border: BorderTokens -> str ---
    border_obj = data["design_tokens"].get("border", {})
    if isinstance(border_obj, dict):
        adapted_border = border_obj.get("default", "1px solid rgba(255,255,255,0.1)")
    else:
        adapted_border = str(border_obj)

    # --- Fix theme: open str -> "dark" | "light" ---
    theme = data["design_tokens"].get("theme", "dark")
    if theme not in ("dark", "light"):
        theme = "dark"

    # --- Fix flows.layout_flow_mapping: dict -> fixed 3 fields ---
    flow_map = data.get("flows", {}).get("layout_flow_mapping", {})
    adapted_flow_map = {
        "sidebar": flow_map.get("sidebar", flow_map.get("navbar", "navigation")),
        "main_canvas": flow_map.get("main_canvas", flow_map.get("hero", flow_map.get("workspace", "primary_content"))),
        "right_panel": flow_map.get("right_panel", flow_map.get("footer", flow_map.get("feature_grid", "controls"))),
    }

    # --- Reassemble design_tokens ---
    data["design_tokens"] = {
        "theme": theme,
        "colors": adapted_colors,
        "border_radius": data["design_tokens"].get("border_radius", "8px"),
        "spacing_scale": adapted_spacing,
        "shadow_style": adapted_shadow,
        "border_style": adapted_border,
        "density": data["design_tokens"].get("density", "comfortable"),
    }

    # --- Fix flows ---
    data["flows"]["layout_flow_mapping"] = adapted_flow_map

    # --- Remove fields Alan doesn't expect ---
    data["design_tokens"].pop("typography", None)
    data["design_tokens"].pop("motion", None)
    data["design_tokens"].pop("shadow", None)
    data["design_tokens"].pop("border", None)

    logger.info("Adapted analysis output to transform input format")
    return DesignIntelligence(**data)
