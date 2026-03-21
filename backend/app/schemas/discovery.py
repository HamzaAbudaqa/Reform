from pydantic import BaseModel, HttpUrl

from app.schemas.competitors import CompetitorAnalysisResponse


class DiscoverRequest(BaseModel):
    project_description: str
    style_goal: str = ""


class DiscoveredCompetitor(BaseModel):
    name: str
    url: str
    reason: str
    relevance: float


class DiscoveryResponse(BaseModel):
    project_category: str
    competitors: list[DiscoveredCompetitor]
    deduped_urls: list[str]
    selected_for_analysis: list[str]


class OnboardRequest(BaseModel):
    project_description: str
    style_goal: str = ""


class OnboardResponse(BaseModel):
    discovery: DiscoveryResponse
    analysis: CompetitorAnalysisResponse
