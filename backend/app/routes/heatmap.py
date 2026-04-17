"""Heatmap API routes.

Public (CORS *):
  POST /api/heatmap/collect            — ingestion from the tracker snippet
  OPTIONS /api/heatmap/collect         — CORS preflight
  GET  /api/heatmap/h.js               — the tracker JS with site_key inlined

Dashboard (explicit github_user_id, mirrors ux_lab + projects routes):
  POST /api/heatmap/sites              — create a site for a project
  GET  /api/heatmap/sites              — list sites for {github_user_id, project_id}
  POST /api/heatmap/sites/{id}/verify  — Playwright-load the site, check for snippet
  GET  /api/heatmap/pages              — list tracked pages for a site
  GET  /api/heatmap/pages/{id}/heatmap — aggregated buckets
  POST /api/heatmap/pages/{id}/screenshot — re-capture the live-URL screenshot
"""

from __future__ import annotations

import logging
import secrets
import time
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    HeatmapAggregate,
    HeatmapPage,
    HeatmapSession,
    HeatmapSite,
    Project,
)
from app.schemas.heatmap import (
    CaptureScreenshotRequest,
    CaptureScreenshotResponse,
    CollectRequest,
    CollectResponse,
    CreateSiteRequest,
    HeatmapBucket,
    HeatmapDataResponse,
    PageOut,
    SiteOut,
    VerifySiteRequest,
    VerifySiteResponse,
)
from app.services.heatmap_ingest import process_events, viewport_class
from app.services.heatmap_snippet import build_snippet, default_api_base, serve_tracker
from app.services.s3_client import presign_screenshot_url, upload_screenshot
from app.services.screenshot import take_screenshot_b64

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/heatmap", tags=["heatmap"])

_PUBLIC_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}

_MAX_BODY_BYTES = 64 * 1024
_RATE_LIMIT_WINDOW_S = 60
_RATE_LIMIT_MAX = 60
# keyed by site_key → deque of request timestamps (monotonic seconds)
_rate_buckets: dict[str, deque] = {}


def _rate_limit(site_key: str) -> None:
    now = time.monotonic()
    bucket = _rate_buckets.get(site_key)
    if bucket is None:
        bucket = deque()
        _rate_buckets[site_key] = bucket
    cutoff = now - _RATE_LIMIT_WINDOW_S
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Too many requests")
    bucket.append(now)


def _slug(value: str) -> str:
    import re
    return re.sub(r"[^a-zA-Z0-9_\-.]", "_", value or "home")


# ─── Public: tracker JS ───────────────────────────────────────────────

@router.options("/collect")
async def collect_preflight() -> Response:
    return Response(status_code=204, headers=_PUBLIC_CORS)


@router.get("/h.js")
async def tracker_js(site: str = Query(..., min_length=8, max_length=64)) -> Response:
    api_base = default_api_base()
    js = serve_tracker(site, f"{api_base}/api/heatmap/collect")
    headers = dict(_PUBLIC_CORS)
    headers["Content-Type"] = "application/javascript; charset=utf-8"
    headers["Cache-Control"] = "public, max-age=300"
    return Response(content=js, headers=headers)


# ─── Public: ingestion ─────────────────────────────────────────────────

@router.post("/collect", response_model=CollectResponse)
async def collect(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    # Body cap — check raw length before pydantic parsing so we reject cheaply.
    raw = await request.body()
    if len(raw) > _MAX_BODY_BYTES:
        return Response(
            status_code=413,
            content='{"detail":"Payload too large"}',
            media_type="application/json",
            headers=_PUBLIC_CORS,
        )

    try:
        import json
        payload = CollectRequest.model_validate(json.loads(raw or b"{}"))
    except Exception as exc:  # noqa: BLE001 — boundary validation
        return Response(
            status_code=400,
            content=f'{{"detail":"Invalid payload: {exc}"}}',
            media_type="application/json",
            headers=_PUBLIC_CORS,
        )

    if not payload.site_key:
        return Response(
            status_code=400,
            content='{"detail":"Missing site_key"}',
            media_type="application/json",
            headers=_PUBLIC_CORS,
        )

    _rate_limit(payload.site_key)

    site = (
        await db.execute(select(HeatmapSite).where(HeatmapSite.site_key == payload.site_key))
    ).scalar_one_or_none()
    if site is None:
        return Response(
            status_code=403,
            content='{"detail":"Unknown site_key"}',
            media_type="application/json",
            headers=_PUBLIC_CORS,
        )

    accepted, rage = await process_events(
        db,
        site,
        session_id=payload.session_id,
        path=payload.path or "/",
        page_width_px=payload.page_width_px,
        page_height_px=payload.page_height_px,
        viewport_width=payload.viewport_width,
        viewport_height=payload.viewport_height,
        user_agent=payload.user_agent,
        events=payload.events,
    )
    body = CollectResponse(accepted=accepted, rage_detected=rage).model_dump_json()
    return Response(content=body, media_type="application/json", headers=_PUBLIC_CORS)


# ─── Dashboard: sites ──────────────────────────────────────────────────

async def _load_project(db: AsyncSession, project_id: str, github_user_id: str) -> Project:
    try:
        pid = uuid.UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid project_id") from exc
    project = (
        await db.execute(
            select(Project).where(
                Project.id == pid, Project.github_user_id == github_user_id
            )
        )
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _site_to_out(site: HeatmapSite) -> SiteOut:
    snippet = build_snippet(site.site_key, default_api_base())
    return SiteOut(
        id=str(site.id),
        project_id=str(site.project_id),
        domain=site.domain,
        site_key=site.site_key,
        snippet=snippet,
        verified_at=site.verified_at.isoformat() if site.verified_at else None,
        last_event_at=site.last_event_at.isoformat() if site.last_event_at else None,
        created_at=site.created_at.isoformat() if site.created_at else "",
    )


@router.post("/sites", response_model=SiteOut)
async def create_site(req: CreateSiteRequest, db: AsyncSession = Depends(get_db)) -> SiteOut:
    project = await _load_project(db, req.project_id, req.github_user_id)

    domain = req.domain.strip()
    if not (domain.startswith("http://") or domain.startswith("https://")):
        raise HTTPException(status_code=400, detail="Domain must start with http:// or https://")
    # Normalize: drop trailing slash so path matching is stable.
    domain = domain.rstrip("/")

    # Reuse existing site if it exists for this (project, domain).
    existing = (
        await db.execute(
            select(HeatmapSite).where(
                HeatmapSite.project_id == project.id, HeatmapSite.domain == domain
            )
        )
    ).scalar_one_or_none()
    if existing:
        return _site_to_out(existing)

    site = HeatmapSite(
        project_id=project.id,
        github_user_id=req.github_user_id,
        site_key=secrets.token_urlsafe(16),
        domain=domain,
    )
    db.add(site)
    await db.flush()
    return _site_to_out(site)


@router.get("/sites", response_model=list[SiteOut])
async def list_sites(
    github_user_id: str,
    project_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[SiteOut]:
    project = await _load_project(db, project_id, github_user_id)
    rows = (
        await db.execute(
            select(HeatmapSite)
            .where(HeatmapSite.project_id == project.id)
            .order_by(HeatmapSite.created_at.desc())
        )
    ).scalars().all()
    return [_site_to_out(r) for r in rows]


async def _load_site(db: AsyncSession, site_id: str, github_user_id: str) -> HeatmapSite:
    try:
        sid = uuid.UUID(site_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid site id") from exc
    site = (
        await db.execute(select(HeatmapSite).where(HeatmapSite.id == sid))
    ).scalar_one_or_none()
    if site is None or site.github_user_id != github_user_id:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.post("/sites/{site_id}/verify", response_model=VerifySiteResponse)
async def verify_site(
    site_id: str, req: VerifySiteRequest, db: AsyncSession = Depends(get_db)
) -> VerifySiteResponse:
    site = await _load_site(db, site_id, req.github_user_id)
    reachable, snippet_detected, err = await _verify_snippet(site.domain)
    if snippet_detected:
        site.verified_at = datetime.now(timezone.utc)
    return VerifySiteResponse(
        reachable=reachable,
        snippet_detected=snippet_detected,
        last_event_at=site.last_event_at.isoformat() if site.last_event_at else None,
        error=err,
    )


async def _verify_snippet(domain: str) -> tuple[bool, bool, str | None]:
    """Load `domain` and check `window.__reformHeatmap__`. Returns (reachable, detected, err)."""
    try:
        from playwright.async_api import async_playwright
    except Exception as exc:  # noqa: BLE001
        return False, False, f"Playwright unavailable: {exc}"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page(viewport={"width": 1280, "height": 800})
                try:
                    resp = await page.goto(domain, wait_until="domcontentloaded", timeout=15000)
                except Exception as exc:  # noqa: BLE001
                    return False, False, f"Page did not load: {exc}"
                if resp is None:
                    return False, False, "No response from server"
                if resp.status >= 400:
                    return False, False, f"HTTP {resp.status}"
                # Wait up to 5s for the tracker to initialize.
                try:
                    await page.wait_for_function(
                        "() => !!(window.__reformHeatmap__ && window.__reformHeatmap__.loaded)",
                        timeout=5000,
                    )
                    return True, True, None
                except Exception:
                    return True, False, "Snippet not detected within 5s"
            finally:
                await browser.close()
    except Exception as exc:  # noqa: BLE001
        return False, False, str(exc)


# ─── Dashboard: pages & heatmap data ───────────────────────────────────

async def _load_page_scoped(db: AsyncSession, page_id: str, github_user_id: str) -> tuple[HeatmapPage, HeatmapSite]:
    try:
        pid = uuid.UUID(page_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid page id") from exc
    row = (
        await db.execute(
            select(HeatmapPage, HeatmapSite)
            .join(HeatmapSite, HeatmapSite.id == HeatmapPage.site_id)
            .where(HeatmapPage.id == pid)
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Page not found")
    page, site = row
    if site.github_user_id != github_user_id:
        raise HTTPException(status_code=404, detail="Page not found")
    return page, site


@router.get("/pages", response_model=list[PageOut])
async def list_pages(
    github_user_id: str,
    site_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[PageOut]:
    site = await _load_site(db, site_id, github_user_id)
    rows = (
        await db.execute(
            select(HeatmapPage)
            .where(HeatmapPage.site_id == site.id)
            .order_by(HeatmapPage.last_seen_at.desc())
        )
    ).scalars().all()
    return [
        PageOut(
            id=str(p.id),
            path=p.path,
            viewport_class=p.viewport_class,  # type: ignore[arg-type]
            session_count=p.session_count or 0,
            last_seen_at=p.last_seen_at.isoformat() if p.last_seen_at else "",
            screenshot_url=presign_screenshot_url(p.screenshot_key) if p.screenshot_key else "",
            page_height_px=p.page_height_px or 0,
        )
        for p in rows
    ]


@router.get("/pages/{page_id}/heatmap", response_model=HeatmapDataResponse)
async def get_heatmap(
    page_id: str,
    github_user_id: str,
    layer: str = Query("click"),
    device: str = Query("all"),
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
) -> HeatmapDataResponse:
    if layer not in ("click", "move", "scroll", "rage"):
        raise HTTPException(status_code=400, detail="Invalid layer")
    if device not in ("desktop", "tablet", "mobile", "all"):
        raise HTTPException(status_code=400, detail="Invalid device filter")

    page, _site = await _load_page_scoped(db, page_id, github_user_id)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date()

    stmt = select(
        HeatmapAggregate.bucket_x,
        HeatmapAggregate.bucket_y,
        func.sum(HeatmapAggregate.count).label("count"),
    ).where(
        HeatmapAggregate.page_id == page.id,
        HeatmapAggregate.layer == layer,
        HeatmapAggregate.date_bucket >= since,
    )
    if device != "all":
        stmt = stmt.where(HeatmapAggregate.viewport_class == device)
    stmt = stmt.group_by(HeatmapAggregate.bucket_x, HeatmapAggregate.bucket_y)

    rows = (await db.execute(stmt)).all()
    buckets = [HeatmapBucket(x=r.bucket_x, y=r.bucket_y, count=int(r.count or 0)) for r in rows]

    total_events = sum(b.count for b in buckets)
    sess_stmt = select(func.count()).select_from(HeatmapSession).where(
        HeatmapSession.site_id == page.site_id,
    )
    if device != "all":
        sess_stmt = sess_stmt.where(HeatmapSession.viewport_class == device)
    total_sessions = (await db.execute(sess_stmt)).scalar() or 0

    # Average scroll depth from the scroll layer (for the header stat).
    scroll_row = (
        await db.execute(
            select(
                func.sum(HeatmapAggregate.count * HeatmapAggregate.bucket_y).label("numerator"),
                func.sum(HeatmapAggregate.count).label("denominator"),
            ).where(
                HeatmapAggregate.page_id == page.id,
                HeatmapAggregate.layer == "scroll",
                HeatmapAggregate.date_bucket >= since,
            )
        )
    ).first()
    avg_scroll = 0.0
    if scroll_row and scroll_row.denominator:
        avg_scroll = float(scroll_row.numerator or 0) / float(scroll_row.denominator) * 2.0

    rage_rate = 0.0
    if total_sessions:
        rage_sessions = (
            await db.execute(
                select(func.count()).select_from(HeatmapSession).where(
                    HeatmapSession.site_id == page.site_id,
                    HeatmapSession.rage_click_count > 0,
                )
            )
        ).scalar() or 0
        rage_rate = float(rage_sessions) / float(total_sessions)

    return HeatmapDataResponse(
        page_id=str(page.id),
        layer=layer,  # type: ignore[arg-type]
        device=device,  # type: ignore[arg-type]
        buckets=buckets,
        total_sessions=int(total_sessions),
        total_events=int(total_events),
        avg_scroll_depth_pct=round(avg_scroll, 1),
        rage_click_rate=round(rage_rate, 3),
    )


@router.post("/pages/{page_id}/screenshot", response_model=CaptureScreenshotResponse)
async def capture_screenshot(
    page_id: str,
    req: CaptureScreenshotRequest,
    db: AsyncSession = Depends(get_db),
) -> CaptureScreenshotResponse:
    page, site = await _load_page_scoped(db, page_id, req.github_user_id)
    url = site.domain + (page.path if page.path.startswith("/") else f"/{page.path}")

    b64 = await take_screenshot_b64(url)
    if not b64:
        raise HTTPException(status_code=500, detail="Screenshot capture failed")

    key = upload_screenshot(str(site.id), _slug(page.path), "heatmap", b64)
    if not key:
        raise HTTPException(status_code=500, detail="Upload failed")
    page.screenshot_key = key
    return CaptureScreenshotResponse(
        screenshot_url=presign_screenshot_url(key),
        page_height_px=page.page_height_px or 0,
    )
