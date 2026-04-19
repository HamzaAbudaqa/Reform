"""Pydantic models for the heatmap endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Layer = Literal["click", "move", "scroll", "rage"]
ViewportClass = Literal["desktop", "tablet", "mobile"]
DeviceFilter = Literal["desktop", "tablet", "mobile", "all"]


# ─── Ingestion (public, from the tracker snippet) ──────────────────────

class ClickEvent(BaseModel):
    type: Literal["click"]
    x_pct: float = Field(..., ge=0, le=100)
    y_pct: float = Field(..., ge=0, le=100)         # relative to viewport
    page_y_pct: float = Field(..., ge=0, le=100)    # relative to full page
    tag: str = ""
    role: str = ""


class MoveEvent(BaseModel):
    type: Literal["move"]
    x_pct: float = Field(..., ge=0, le=100)
    page_y_pct: float = Field(..., ge=0, le=100)


class ScrollEvent(BaseModel):
    type: Literal["scroll"]
    max_y_pct: float = Field(..., ge=0, le=100)
    duration_ms: int = 0


class ViewEvent(BaseModel):
    type: Literal["view"]
    referrer: str = ""


class CollectRequest(BaseModel):
    site_key: str
    session_id: str
    path: str
    page_width_px: int = Field(..., gt=0, le=100_000)
    page_height_px: int = Field(..., gt=0, le=200_000)
    viewport_width: int = Field(..., gt=0, le=100_000)
    viewport_height: int = Field(..., gt=0, le=100_000)
    user_agent: str = ""
    events: list[dict] = Field(default_factory=list)  # loosely typed; validated in service


class CollectResponse(BaseModel):
    accepted: int
    rage_detected: int = 0


# ─── Admin endpoints (dashboard → backend) ─────────────────────────────

class CreateSiteRequest(BaseModel):
    github_user_id: str
    project_id: str
    domain: str       # https://example.com


class SiteOut(BaseModel):
    id: str
    project_id: str
    domain: str
    site_key: str
    snippet: str
    verified_at: str | None = None
    last_event_at: str | None = None
    created_at: str


class VerifySiteRequest(BaseModel):
    github_user_id: str


class VerifySiteResponse(BaseModel):
    reachable: bool
    snippet_detected: bool
    last_event_at: str | None = None
    error: str | None = None


class PageOut(BaseModel):
    id: str
    path: str
    viewport_class: ViewportClass
    session_count: int
    last_seen_at: str
    screenshot_url: str = ""          # presigned S3 URL (empty if not captured yet)
    page_height_px: int


class HeatmapBucket(BaseModel):
    x: int                              # 0..49
    y: int                              # 0..49
    count: int


class HeatmapDataResponse(BaseModel):
    page_id: str
    layer: Layer
    device: DeviceFilter
    buckets: list[HeatmapBucket]
    total_sessions: int
    total_events: int
    avg_scroll_depth_pct: float = 0.0
    rage_click_rate: float = 0.0


class CaptureScreenshotRequest(BaseModel):
    github_user_id: str
    path: str = "/"


class CaptureScreenshotResponse(BaseModel):
    screenshot_url: str
    page_height_px: int


# ─── Auto-install (GitHub PR) ──────────────────────────────────────────


class AutoInstallRequest(BaseModel):
    github_user_id: str
    access_token: str


class AutoInstallResponse(BaseModel):
    success: bool
    pr_url: str = ""
    pr_number: int = 0
    branch_name: str = ""
    branch_url: str = ""
    target_file: str = ""
    framework: str = ""
    error: str | None = None
    error_kind: str | None = None
