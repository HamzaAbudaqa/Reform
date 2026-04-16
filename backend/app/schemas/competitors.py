from pydantic import BaseModel, HttpUrl


class CompetitorRequest(BaseModel):
    urls: list[HttpUrl]
    style_goal: str = ""
    backup_urls: list[HttpUrl] = []


# --- Response schema ---


class ConfidenceScores(BaseModel):
    layout_patterns: float
    visual_style: float
    ux_flow: float


class Meta(BaseModel):
    project_style_goal: str
    description: str
    confidence: ConfidenceScores


class SourceAnalysis(BaseModel):
    url: str
    page_type: str
    summary: str


class GlobalPatterns(BaseModel):
    layout: list[str]
    visual_style: list[str]
    ux_principles: list[str]


class ComponentPatterns(BaseModel):
    patterns: list[str]


class Components(BaseModel):
    navbar: ComponentPatterns
    hero: ComponentPatterns
    cards: ComponentPatterns
    buttons: ComponentPatterns
    workspace: ComponentPatterns
    forms_controls: ComponentPatterns


class Typography(BaseModel):
    font_family: str
    font_mono: str
    scale: list[str]
    weight_normal: str
    weight_medium: str
    weight_bold: str


class ShadowTokens(BaseModel):
    sm: str
    md: str
    lg: str


class BorderTokens(BaseModel):
    default: str


class MotionTokens(BaseModel):
    duration_fast: str
    duration_normal: str
    easing: str


class DesignTokens(BaseModel):
    theme: str
    colors: dict[str, str]
    typography: Typography
    border_radius: str
    spacing_scale: list[str]
    shadow: ShadowTokens
    border: BorderTokens
    motion: MotionTokens
    density: str


class Flows(BaseModel):
    primary_user_flow: list[str]
    interaction_patterns: list[str]
    layout_flow_mapping: dict[str, str]


class CtaInsights(BaseModel):
    dominant_location: str = "unknown"
    dominant_prominence: str = "unknown"
    common_labels: list[str] = []
    best_practice_notes: str = ""


class StrongestFlow(BaseModel):
    flow_name: str
    seen_in_sites: int = 1
    avg_clarity: str = "unknown"
    avg_friction: str = "unknown"


class UxIntelligence(BaseModel):
    common_user_goals: list[str] = []
    effective_patterns: list[str] = []
    common_problems: list[str] = []
    cta_insights: CtaInsights = CtaInsights()
    post_click_quality: str = "unknown"
    strongest_flows: list[StrongestFlow] = []


class Recommendation(BaseModel):
    priority: str  # "high", "medium", "low"
    target: str
    action: str


class CompetitorPatterns(BaseModel):
    """Structured cross-site patterns the transform pipeline applies as hard constraints.

    These are distinct from `global_patterns` / `recommendations` because
    they're phrased as concrete, layout-level moves a transform prompt can
    execute (specific radii, spacing values, CTA treatment). Everything is
    optional so older aggregator runs still deserialize cleanly.
    """
    layout_patterns: list[str] = []
    cta_hierarchy: str = ""
    spacing_rhythm: str = ""
    card_style: str = ""
    typography_tone: str = ""
    source_competitors: list[str] = []


class CompetitorAnalysisResponse(BaseModel):
    meta: Meta
    sources: list[SourceAnalysis]
    global_patterns: GlobalPatterns
    components: Components
    design_tokens: DesignTokens
    flows: Flows
    ux_intelligence: UxIntelligence = UxIntelligence()
    recommendations: list[Recommendation]
    avoid: list[str]
    # Structured competitor constraints for the transform prompt. Empty on
    # legacy analyses; populated by the updated aggregation prompt.
    competitor_patterns: CompetitorPatterns = CompetitorPatterns()
