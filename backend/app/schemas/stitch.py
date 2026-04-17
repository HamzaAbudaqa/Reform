"""Pydantic schemas for the Google Stitch design ingestion feature.

Stitch (stitch.withgoogle.com) is Google's AI UI design tool. We ingest a
Stitch share URL the same way we ingest competitor URLs via TinyFish:
fetch → screenshot → Claude vision extraction → structured design tokens
and patterns. The output slots into the existing DesignIntelligence
pipeline as another pattern source.
"""

from pydantic import BaseModel, Field, HttpUrl


class StitchIngestRequest(BaseModel):
    """Ingest one or more Stitch share URLs and return their extracted design patterns."""
    urls: list[HttpUrl] = Field(..., min_length=1, max_length=5)
    label: str = Field("", description="Optional label surfaced in UI for this batch")


class StitchDesignTokens(BaseModel):
    """Minimal design-token shape extracted from a Stitch design.

    Intentionally narrower than CompetitorAnalysisResponse.DesignTokens —
    Stitch designs are single-screen mockups, not real products, so we
    only trust the visible subset. Merged into the larger DesignIntelligence
    by the caller if desired.
    """
    theme: str = Field("", description='"light", "dark", or ""')
    palette: dict[str, str] = Field(default_factory=dict, description="Named color tokens (e.g. {primary: '#...', surface: '#...'})")
    typography_tone: str = Field("", description="One-line description of typographic feel")
    spacing_rhythm: str = Field("", description="One-line description of spacing / density")
    border_radius: str = Field("", description="Dominant corner radius (e.g. '12px', 'sharp')")


class StitchPatterns(BaseModel):
    """Structured design patterns extracted from a single Stitch design.

    Shape deliberately mirrors CompetitorPatterns so the transform pipeline
    can treat Stitch patterns and competitor patterns identically.
    """
    layout_patterns: list[str] = Field(default_factory=list)
    cta_hierarchy: str = ""
    spacing_rhythm: str = ""
    card_style: str = ""
    typography_tone: str = ""
    component_patterns: list[str] = Field(default_factory=list, description="Component-level observations (cards, nav, buttons)")


class StitchDesign(BaseModel):
    """One ingested Stitch design + its extracted signal."""
    url: str
    label: str = ""
    screenshot_key: str = Field("", description="S3 key of the uploaded screenshot; empty if upload failed")
    screenshot_url: str = Field("", description="Presigned GET URL for the screenshot; empty if upload failed")
    summary: str = Field("", description="Short human-readable summary of the design")
    design_tokens: StitchDesignTokens = Field(default_factory=StitchDesignTokens)
    patterns: StitchPatterns = Field(default_factory=StitchPatterns)
    error: str = Field("", description="Non-empty if this URL failed; design_tokens/patterns will be empty")
    cached: bool = False


class StitchIngestResponse(BaseModel):
    designs: list[StitchDesign]


class StitchDesignIntelligenceRequest(BaseModel):
    """Build a merged DesignIntelligence-compatible payload from one or more Stitch URLs.

    This is the higher-level endpoint the orchestrator would call to get a
    design intelligence blob ready to feed into the transform prompt.
    """
    urls: list[HttpUrl] = Field(..., min_length=1, max_length=5)
    style_goal: str = Field("", description="Optional style goal carried through to downstream transforms")


class StitchDesignIntelligenceResponse(BaseModel):
    """A DesignIntelligence-shaped payload sourced entirely from Stitch.

    Emitted in a shape that the transform pipeline's prompt templates can
    consume alongside (or in place of) competitor-derived intelligence.
    """
    style_goal: str = ""
    designs: list[StitchDesign]
    merged_patterns: StitchPatterns = Field(default_factory=StitchPatterns)
    merged_tokens: StitchDesignTokens = Field(default_factory=StitchDesignTokens)
    source_urls: list[str] = Field(default_factory=list)
