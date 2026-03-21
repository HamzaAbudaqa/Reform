from pydantic import BaseModel, HttpUrl


class CompetitorRequest(BaseModel):
    urls: list[HttpUrl]
    style_goal: str = ""


class SourceAnalysis(BaseModel):
    url: str
    page_type: str
    summary: str


class DesignPatterns(BaseModel):
    layout: list[str]
    visual_style: list[str]
    components: list[str]
    ux_observations: list[str]


class RecommendedDirection(BaseModel):
    theme: str
    guidelines: list[str]


class CompetitorAnalysisResponse(BaseModel):
    sources: list[SourceAnalysis]
    patterns: DesignPatterns
    recommended_direction: RecommendedDirection
