from typing import Literal

from pydantic import BaseModel


# ─── Input: Design Intelligence ──────────────────────────────────────────────

class ConfidenceScores(BaseModel):
    layout_patterns: float
    visual_style: float
    ux_flow: float


class MetaBlock(BaseModel):
    project_style_goal: str
    description: str
    confidence: ConfidenceScores


class SourceBlock(BaseModel):
    url: str
    page_type: str
    summary: str


class GlobalPatterns(BaseModel):
    layout: list[str]
    visual_style: list[str]
    ux_principles: list[str]


class ComponentSpec(BaseModel):
    patterns: list[str]


class ComponentsBlock(BaseModel):
    navbar: ComponentSpec
    hero: ComponentSpec
    cards: ComponentSpec
    buttons: ComponentSpec
    workspace: ComponentSpec
    forms_controls: ComponentSpec


class ColorTokens(BaseModel):
    background: str
    panel: str
    border: str
    text_primary: str
    text_secondary: str
    accent: str


class DesignTokens(BaseModel):
    theme: Literal["dark", "light"]
    colors: ColorTokens
    border_radius: str
    spacing_scale: list[int]
    shadow_style: str
    border_style: str
    density: str


class FlowMapping(BaseModel):
    sidebar: str
    main_canvas: str
    right_panel: str


class Flows(BaseModel):
    primary_user_flow: list[str]
    interaction_patterns: list[str]
    layout_flow_mapping: FlowMapping


class Recommendation(BaseModel):
    priority: Literal["high", "medium", "low"]
    target: str
    action: str


class DesignIntelligence(BaseModel):
    meta: MetaBlock
    sources: list[SourceBlock]
    global_patterns: GlobalPatterns
    components: ComponentsBlock
    design_tokens: DesignTokens
    flows: Flows
    recommendations: list[Recommendation]
    avoid: list[str]


# ─── Output: Refined UI ───────────────────────────────────────────────────────

class PanelConfig(BaseModel):
    role: str
    width: str
    classes: str


class RefinedLayout(BaseModel):
    type: str
    panels: dict[str, PanelConfig]
    gap: str
    segmentation: list[str]


class RefinedCardSpec(BaseModel):
    radius: str
    border: str
    padding: str
    shadow: str
    classes: str


class RefinedButtonSpec(BaseModel):
    primary_classes: str
    secondary_classes: str
    radius: str
    height: str


class RefinedNavbarSpec(BaseModel):
    layout: str
    classes: str


class RefinedHeroSpec(BaseModel):
    layout: str
    headline_size: str
    classes: str


class RefinedWorkspaceSpec(BaseModel):
    layout: str
    classes: str


class RefinedComponents(BaseModel):
    navbar: RefinedNavbarSpec
    hero: RefinedHeroSpec
    cards: RefinedCardSpec
    buttons: RefinedButtonSpec
    workspace: RefinedWorkspaceSpec


class TailwindTokenMap(BaseModel):
    bg_base: str
    bg_panel: str
    border: str
    text_primary: str
    text_secondary: str
    accent_bg: str
    accent_text: str
    radius: str
    spacing: list[str]
    gap: list[str]
    shadow: str


class RefinedUI(BaseModel):
    layout: RefinedLayout
    components: RefinedComponents
    design_tokens: TailwindTokenMap
    applied_patterns: list[str]


class UITransformResponse(BaseModel):
    refined_ui: RefinedUI
    code: str
