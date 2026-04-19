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
    AutoInstallRequest,
    AutoInstallResponse,
    CaptureScreenshotRequest,
    CaptureScreenshotResponse,
    CollectRequest,
    CollectResponse,
    CreateSiteRequest,
    HeatmapBucket,
    HeatmapDataResponse,
    InstallModeRequest,
    PageOut,
    SiteOut,
    VerifySiteRequest,
    VerifySiteResponse,
)
from app.services.heatmap_ingest import process_events, viewport_class
from app.services.heatmap_installer import install_tracking_via_github
from app.services.heatmap_snippet import api_base_from_request, build_snippet, default_api_base, serve_tracker
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
async def tracker_js(request: Request, site: str = Query(..., min_length=8, max_length=64)) -> Response:
    api_base = api_base_from_request(request)
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
        first_event_at=site.first_event_at.isoformat() if site.first_event_at else None,
        created_at=site.created_at.isoformat() if site.created_at else "",
        install_status=site.install_status or "not_started",
        install_mode=site.install_mode,
        install_framework=site.install_framework,
        install_target_file=site.install_target_file,
        install_pr_url=site.install_pr_url,
        install_pr_number=site.install_pr_number,
        install_branch_name=site.install_branch_name,
        install_error=site.install_error,
        install_attempted_at=(
            site.install_attempted_at.isoformat() if site.install_attempted_at else None
        ),
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
        # Setup is complete — persist so a refresh skips the setup card.
        site.install_status = "tracking_live"
        site.install_error = None
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


# ─── Dashboard: auto-install via GitHub PR ─────────────────────────────


@router.post("/sites/{site_id}/auto-install", response_model=AutoInstallResponse)
async def auto_install(
    site_id: str,
    req: AutoInstallRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AutoInstallResponse:
    """Inject the tracking script into the project's GitHub repo via a PR.

    Resolves the site → project → repo_url, derives the snippet URL from the
    incoming request (so the served PR contains a real prod URL, not
    localhost), then delegates to `install_tracking_via_github`.
    """
    site = await _load_site(db, site_id, req.github_user_id)
    project = (
        await db.execute(select(Project).where(Project.id == site.project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found for this site")
    if not project.repo_url:
        raise HTTPException(status_code=400, detail="Project has no repo URL set")

    api_base = api_base_from_request(request)
    snippet_url = f"{api_base}/api/heatmap/h.js?site={site.site_key}"

    result = await install_tracking_via_github(
        repo_url=project.repo_url,
        branch=project.branch or "main",
        access_token=req.access_token,
        snippet_url=snippet_url,
    )

    # Persist install state so a refresh / revisit restores the right view.
    site.install_attempted_at = datetime.now(timezone.utc)
    site.install_mode = "automatic"
    if result.success:
        # already_installed is reported as success with a flagged error_kind;
        # we still treat it as awaiting the GitHub merge unless verify already
        # marked the site live elsewhere.
        site.install_status = (
            site.install_status if site.install_status == "tracking_live"
            else "awaiting_github_action"
        )
        site.install_pr_url = result.pr_url or site.install_pr_url
        site.install_pr_number = result.pr_number or site.install_pr_number
        site.install_branch_name = result.branch_name or site.install_branch_name
        site.install_target_file = result.target_file or site.install_target_file
        site.install_framework = result.framework or site.install_framework
        site.install_error = None
    else:
        # Soft-failure modes (unsupported_framework / injection_failed) leave
        # the user on the choice card — record the error so we can show a
        # friendly recovery state on next visit.
        site.install_status = "failed"
        site.install_error = result.error
        if result.framework:
            site.install_framework = result.framework

    return AutoInstallResponse(
        success=result.success,
        pr_url=result.pr_url,
        pr_number=result.pr_number,
        branch_name=result.branch_name,
        branch_url=result.branch_url,
        target_file=result.target_file,
        framework=result.framework,
        error=result.error,
        error_kind=result.error_kind,
    )


@router.post("/sites/{site_id}/install-mode", response_model=SiteOut)
async def set_install_mode(
    site_id: str,
    req: InstallModeRequest,
    db: AsyncSession = Depends(get_db),
) -> SiteOut:
    """Record which install path the user is on.

    Lets the manual-fallback flow restore correctly after a refresh.
    Also clears stale errors when the user explicitly switches mode.
    """
    site = await _load_site(db, site_id, req.github_user_id)
    mode = (req.mode or "").strip().lower()
    if mode not in ("manual", "automatic", "not_started"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    if mode == "manual":
        site.install_mode = "manual"
        # Don't downgrade tracking_live → manual_fallback if the site is
        # already verified (an over-zealous click shouldn't undo setup).
        if site.install_status != "tracking_live":
            site.install_status = "manual_fallback"
            site.install_error = None
    elif mode == "automatic":
        site.install_mode = "automatic"
        if site.install_status not in ("tracking_live", "awaiting_github_action"):
            site.install_status = "not_started"
    else:
        site.install_mode = None
        if site.install_status != "tracking_live":
            site.install_status = "not_started"
            site.install_error = None

    return _site_to_out(site)


# ─── First-event signal ────────────────────────────────────────────────


@router.get("/sites/{site_id}/event-summary")
async def event_summary(
    site_id: str,
    github_user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Cheap proof-of-life payload for the post-install celebration.

    Reads aggregate session data only — no raw events, no PII beyond a
    coarse browser/OS label parsed from the stored UA string.
    """
    site = await _load_site(db, site_id, github_user_id)
    sess_count = (
        await db.execute(
            select(func.count()).select_from(HeatmapSession).where(
                HeatmapSession.site_id == site.id,
            )
        )
    ).scalar() or 0

    if not sess_count:
        return {
            "has_events": False,
            "session_count": 0,
            "first_event_at": None,
            "latest_event_at": None,
            "latest_viewport_class": None,
            "latest_browser_label": None,
        }

    first_at = (
        await db.execute(
            select(func.min(HeatmapSession.started_at)).where(
                HeatmapSession.site_id == site.id,
            )
        )
    ).scalar()

    latest = (
        await db.execute(
            select(
                HeatmapSession.viewport_class,
                HeatmapSession.user_agent,
                HeatmapSession.ended_at,
            )
            .where(HeatmapSession.site_id == site.id)
            .order_by(HeatmapSession.ended_at.desc())
            .limit(1)
        )
    ).first()

    return {
        "has_events": True,
        "session_count": int(sess_count),
        "first_event_at": first_at.isoformat() if first_at else None,
        "latest_event_at": latest.ended_at.isoformat() if latest and latest.ended_at else None,
        "latest_viewport_class": latest.viewport_class if latest else None,
        "latest_browser_label": _parse_browser_label(latest.user_agent if latest else None),
    }


_BROWSER_PATTERNS = [
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("Firefox/", "Firefox"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
]
_OS_PATTERNS = [
    ("Windows NT", "Windows"),
    ("Mac OS X", "macOS"),
    ("Macintosh", "macOS"),
    ("Android", "Android"),
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("Linux", "Linux"),
]


def _parse_browser_label(ua: str | None) -> str | None:
    """Return a friendly "Chrome on macOS" label from a UA string.

    Best-effort and intentionally coarse — we only surface this in the
    proof-of-life card, never in analytics. Returns None if the string is
    missing or unrecognized.
    """
    if not ua:
        return None
    browser = next((label for needle, label in _BROWSER_PATTERNS if needle in ua), None)
    os_label = next((label for needle, label in _OS_PATTERNS if needle in ua), None)
    if browser and os_label:
        return f"{browser} on {os_label}"
    return browser or os_label
