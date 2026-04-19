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

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    HeatmapAggregate,
    HeatmapPage,
    HeatmapSession,
    HeatmapSite,
    HeatmapSuggestionStatus,
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
    RegenerateSuggestionRequest,
    SiteOut,
    SuggestionStatusRequest,
    VerifySiteRequest,
    VerifySiteResponse,
)
from app.services.heatmap_ingest import process_events, viewport_class
from app.services.heatmap_insights import (
    MIN_SESSIONS_FOR_INSIGHTS,
    convert_insight_to_suggestion,
    gather_page_evidence,
    generate_insights,
    is_cache_fresh,
    regenerate_single_suggestion,
)
from app.services.heatmap_installer import install_tracking_via_github
from app.services.heatmap_snippet import api_base_from_request, build_snippet, default_api_base, serve_tracker
from app.services.s3_client import presign_screenshot_url, upload_screenshot
from app.services.screenshot import take_screenshot_b64_if_live

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
async def collect(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> Response:
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
        # Logged at warning so an avalanche from a stale snippet on a site
        # whose key was rotated is visible. Truncated to avoid log spam.
        logger.warning(
            "collect: unknown site_key=%s path=%s ua=%s",
            payload.site_key[:12], (payload.path or "/")[:80], (payload.user_agent or "")[:80],
        )
        return Response(
            status_code=403,
            content='{"detail":"Unknown site_key"}',
            media_type="application/json",
            headers=_PUBLIC_CORS,
        )

    accepted, rage, capture_task = await process_events(
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
    # Kick off auto-capture for a page we've never screenshotted. The
    # worker's UPDATE ... RETURNING claim is the concurrency gate, so
    # scheduling unconditionally here is safe even if two tabs land on
    # the same new page in the same 5-second flush window.
    if capture_task is not None:
        from app.services.heatmap_screenshots import run_capture
        background_tasks.add_task(run_capture, capture_task.page_id, capture_task.url)

    # Quiet info log so a working ingest is visible at INFO without flooding —
    # one line per flush (≤ once per 5s per session client-side).
    logger.info(
        "collect: site=%s path=%s accepted=%d rage=%d capture=%s",
        str(site.id)[:8], payload.path or "/", accepted, rage,
        bool(capture_task),
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
    """Load `domain` and check `window.__reformHeatmap__`.

    Returns (reachable, detected, err).

    Why the timing matters: Next.js `<Script strategy="afterInteractive">`
    only loads after hydration, which is itself after the JS bundle parses
    and runs. On real apps that's often 5-10s, longer than the old 5s
    timeout. We now wait on `networkidle` and give the marker check up to
    12s. If the marker still hasn't appeared, we do a DOM-level check for
    the script *tag* itself — tag-present-but-not-executed is a much
    better diagnostic than the user-facing "not detected" alone.
    """
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
                    # `networkidle` waits for ~500ms of no network requests.
                    # On a Next.js site this happens *after* hydration, so the
                    # afterInteractive Script will have started fetching by then.
                    resp = await page.goto(domain, wait_until="networkidle", timeout=25000)
                except Exception:
                    # networkidle can time out on chatty pages — fall back to a
                    # cheaper load condition so we don't block the user. The
                    # marker check below has its own wait.
                    try:
                        resp = await page.goto(domain, wait_until="domcontentloaded", timeout=15000)
                    except Exception as exc:  # noqa: BLE001
                        return False, False, f"Page did not load: {exc}"
                if resp is None:
                    return False, False, "No response from server"
                if resp.status >= 400:
                    return False, False, f"HTTP {resp.status}"
                # Primary check — the tracker sets this once it's bootstrapped.
                try:
                    await page.wait_for_function(
                        "() => !!(window.__reformHeatmap__ && window.__reformHeatmap__.loaded)",
                        timeout=12000,
                    )
                    return True, True, None
                except Exception:
                    pass
                # Fallback diagnosis — is the script *tag* present? If yes,
                # the tag is there but the script didn't run (CSP, network
                # block, etc.). If no, the injection isn't actually live yet
                # (deploy stale, wrong file, build pulled an old version).
                tag_present = False
                try:
                    tag_present = bool(await page.evaluate(
                        "() => !!document.querySelector('script[src*=\"/api/heatmap/h.js\"]')"
                    ))
                except Exception:
                    pass
                if tag_present:
                    return True, False, (
                        "Tracking code is on your site but didn't load — your "
                        "site may be blocking the script (check CSP / ad blocker)."
                    )
                return True, False, (
                    "We don't see the tracking code on your site yet. If you just "
                    "merged on GitHub, give your host a minute to redeploy."
                )
            finally:
                await browser.close()
    except Exception as exc:  # noqa: BLE001
        # Use the central humanizer so we never leak Playwright stack noise
        # (`Page.goto: net::ERR_NAME_NOT_RESOLVED at https://...`) into the
        # user-facing error pill.
        from app.services.error_messages import humanize_error
        return False, False, humanize_error(exc).message


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

    b64, status = await take_screenshot_b64_if_live(url)
    if not b64:
        # Surface the status code so the dashboard/UI can show something
        # better than a generic "capture failed" when the live URL itself
        # is broken (404, auth wall, etc.).
        detail = (
            f"Live URL returned HTTP {status} — nothing to capture"
            if status
            else "Browser could not reach the live URL"
        )
        raise HTTPException(status_code=502, detail=detail)

    key = upload_screenshot(str(site.id), _slug(page.path), "heatmap", b64)
    if not key:
        raise HTTPException(status_code=500, detail="Upload failed")
    page.screenshot_key = key
    return CaptureScreenshotResponse(
        screenshot_url=presign_screenshot_url(key),
        page_height_px=page.page_height_px or 0,
    )


@router.post("/pages/{page_id}/reset-screenshot")
async def reset_screenshot(
    page_id: str,
    req: CaptureScreenshotRequest,
    db: AsyncSession = Depends(get_db),
):
    """Clear a stale/broken screenshot so auto-capture re-runs on next ingest.

    Needed after a migration from the old capture code (which happily stored
    404 pages) and as a general recovery hook for any page whose stored
    screenshot no longer reflects the live site. The auto-capture claim
    condition is `screenshot_key IS NULL`, so nulling the key is enough to
    re-eligible the row — the next `/collect` for this path schedules a
    fresh background capture.
    """
    page, _site = await _load_page_scoped(db, page_id, req.github_user_id)
    page.screenshot_key = None
    page.screenshot_capture_started_at = None
    return {"ok": True}


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


# ─── Debug / triangulation endpoint ────────────────────────────────────


# ─── AI insights ───────────────────────────────────────────────────────


@router.post("/pages/{page_id}/insights")
async def page_insights(
    page_id: str,
    github_user_id: str,
    regenerate: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Generate (or return cached) AI UX recommendations for a page.

    Cache: results are persisted on the HeatmapPage row and returned
    without an AI call when fresher than `INSIGHTS_TTL_SECONDS`. Pass
    `?regenerate=true` to force a fresh call.

    Low-data gate: if the site has fewer than `MIN_SESSIONS_FOR_INSIGHTS`
    sessions, returns `{still_collecting: true}` immediately — no AI
    call, no fabricated suggestions.
    """
    page, site = await _load_page_scoped(db, page_id, github_user_id)

    # Site-wide session count — used as the gate. A page with zero
    # sessions of its own can still be analyzed if the site overall has
    # traffic, but if NOTHING is happening anywhere, don't bother.
    sess_count = (
        await db.execute(
            select(func.count()).select_from(HeatmapSession).where(
                HeatmapSession.site_id == site.id,
            )
        )
    ).scalar() or 0

    if sess_count < MIN_SESSIONS_FOR_INSIGHTS:
        return {
            "has_data": False,
            "still_collecting": True,
            "session_count": int(sess_count),
            "threshold": MIN_SESSIONS_FOR_INSIGHTS,
            "page_path": page.path,
            "generated_at": None,
            "cached": False,
            "insights": [],
            "suggestions": [],
            "note": (
                "We're still collecting enough visitor data to generate "
                "confident recommendations. Come back once a few more "
                "sessions have hit your site."
            ),
        }

    # Cache hit — save a Claude call.
    if not regenerate and is_cache_fresh(page.latest_insights_at) and page.latest_insights_json:
        cached = page.latest_insights_json
        suggestions = await _hydrate_suggestion_status(db, page.id, cached.get("suggestions", []))
        return {
            "has_data": True,
            "still_collecting": False,
            "session_count": int(sess_count),
            "threshold": MIN_SESSIONS_FOR_INSIGHTS,
            "page_path": page.path,
            "generated_at": page.latest_insights_at.isoformat() if page.latest_insights_at else None,
            "cached": True,
            "insights": cached.get("insights", []),
            "suggestions": suggestions,
            "note": cached.get("note", ""),
        }

    # Whole-panel regenerate: the IDs we're about to mint are new, so every
    # existing status row on this page is an orphan. Drop them so stale
    # "staged" badges don't bleed across regenerations.
    if regenerate:
        await db.execute(
            HeatmapSuggestionStatus.__table__.delete().where(
                HeatmapSuggestionStatus.page_id == page.id
            )
        )

    screenshot_url = (
        presign_screenshot_url(page.screenshot_key) if page.screenshot_key else None
    )
    evidence = await gather_page_evidence(db, page, site.id, screenshot_url=screenshot_url)
    result = await generate_insights(evidence)

    now = datetime.now(timezone.utc)
    page.latest_insights_json = {
        "insights": result.get("insights", []),
        "suggestions": result.get("suggestions", []),
        "note": result.get("note", ""),
    }
    page.latest_insights_at = now

    # Freshly generated suggestions have no stored status — _hydrate is a
    # no-op here but we route through it anyway so the shape is identical
    # between cache-hit and fresh paths.
    suggestions = await _hydrate_suggestion_status(db, page.id, result.get("suggestions", []))

    return {
        "has_data": True,
        "still_collecting": False,
        "session_count": int(sess_count),
        "threshold": MIN_SESSIONS_FOR_INSIGHTS,
        "page_path": page.path,
        "generated_at": now.isoformat(),
        "cached": False,
        "insights": result.get("insights", []),
        "suggestions": suggestions,
        "note": result.get("note", ""),
    }


async def _hydrate_suggestion_status(
    db: AsyncSession,
    page_id,
    suggestions: list[dict],
) -> list[dict]:
    """Merge persisted status rows into the suggestions list.

    Mutates a shallow copy of each dict — the cached JSON on HeatmapPage
    intentionally doesn't store status, so we overlay it on every read.
    Unknown suggestion IDs default to "none".
    """
    if not suggestions:
        return suggestions
    ids = [s.get("id") for s in suggestions if s.get("id")]
    if not ids:
        return [dict(s, status="none") for s in suggestions]
    rows = (
        await db.execute(
            select(HeatmapSuggestionStatus.suggestion_id, HeatmapSuggestionStatus.status)
            .where(
                HeatmapSuggestionStatus.page_id == page_id,
                HeatmapSuggestionStatus.suggestion_id.in_(ids),
            )
        )
    ).all()
    status_by_id = {r.suggestion_id: r.status for r in rows}
    return [
        dict(s, status=status_by_id.get(s.get("id"), "none"))
        for s in suggestions
    ]


@router.post("/pages/{page_id}/suggestions/{suggestion_id}/status")
async def set_suggestion_status(
    page_id: str,
    suggestion_id: str,
    req: SuggestionStatusRequest,
    db: AsyncSession = Depends(get_db),
):
    """Persist stage/reject for a single suggestion.

    Idempotent upsert keyed on (page_id, suggestion_id). "none" deletes the
    row so a user can revert a rejection without accumulating empty
    overlay records.
    """
    page, _site = await _load_page_scoped(db, page_id, req.github_user_id)

    # Sanity: ensure the suggestion_id actually appears in the latest cache.
    # Prevents status-for-orphans getting written, which would waste rows
    # and subtly mislead the hydrator on the next regenerate.
    cached = page.latest_insights_json or {}
    cached_ids = {s.get("id") for s in cached.get("suggestions", []) if s.get("id")}
    if suggestion_id not in cached_ids:
        raise HTTPException(status_code=404, detail="Unknown suggestion id for this page")

    if req.status == "none":
        await db.execute(
            HeatmapSuggestionStatus.__table__.delete().where(
                HeatmapSuggestionStatus.page_id == page.id,
                HeatmapSuggestionStatus.suggestion_id == suggestion_id,
            )
        )
        return {"ok": True, "status": "none"}

    now = datetime.now(timezone.utc)
    existing = (
        await db.execute(
            select(HeatmapSuggestionStatus).where(
                HeatmapSuggestionStatus.page_id == page.id,
                HeatmapSuggestionStatus.suggestion_id == suggestion_id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(HeatmapSuggestionStatus(
            page_id=page.id,
            suggestion_id=suggestion_id,
            status=req.status,
            created_at=now,
            updated_at=now,
        ))
    else:
        existing.status = req.status
        existing.updated_at = now
    return {"ok": True, "status": req.status}


@router.post("/pages/{page_id}/insights/{suggestion_id}/regenerate")
async def regenerate_suggestion(
    page_id: str,
    suggestion_id: str,
    req: RegenerateSuggestionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Per-card magic wand: ask Claude for an alternative strategy for one
    suggestion while leaving the rest of the cached panel intact.

    Evidence is re-gathered (same site/page) and fed to Claude alongside
    the previous suggestion so the model can diverge from it explicitly.
    The returned card gets a fresh `id` — any existing status row for the
    old id is dropped (the user never chose *this* suggestion; they chose
    the one that used to live here). Cache TTL is not reset; the panel as
    a whole stays whatever age it was.
    """
    page, site = await _load_page_scoped(db, page_id, req.github_user_id)

    cached = page.latest_insights_json or {}
    suggestions = list(cached.get("suggestions", []))
    idx = next(
        (i for i, s in enumerate(suggestions) if s.get("id") == suggestion_id),
        -1,
    )
    if idx < 0:
        raise HTTPException(status_code=404, detail="Unknown suggestion id for this page")

    previous = suggestions[idx]

    screenshot_url = (
        presign_screenshot_url(page.screenshot_key) if page.screenshot_key else None
    )
    evidence = await gather_page_evidence(db, page, site.id, screenshot_url=screenshot_url)
    new_sug = await regenerate_single_suggestion(evidence, previous)
    if new_sug is None:
        raise HTTPException(
            status_code=502,
            detail="Couldn't generate an alternative right now — try again in a moment.",
        )

    suggestions[idx] = new_sug
    # Persist the swapped panel. Not resetting latest_insights_at — the
    # rest of the panel hasn't changed, and refreshing TTL here would
    # silently extend the cache lifetime of stale insights.
    page.latest_insights_json = {
        **cached,
        "suggestions": suggestions,
    }

    # Old id is gone — drop its status row so it doesn't become an orphan.
    await db.execute(
        HeatmapSuggestionStatus.__table__.delete().where(
            HeatmapSuggestionStatus.page_id == page.id,
            HeatmapSuggestionStatus.suggestion_id == suggestion_id,
        )
    )

    # Return the fresh panel so the client can drop it in without a second
    # round-trip to /insights.
    hydrated = await _hydrate_suggestion_status(db, page.id, suggestions)
    return {
        "suggestion": next((s for s in hydrated if s.get("id") == new_sug["id"]), new_sug),
        "insights": cached.get("insights", []),
        "suggestions": hydrated,
        "note": cached.get("note", ""),
        "page_path": page.path,
        "generated_at": page.latest_insights_at.isoformat() if page.latest_insights_at else None,
        "cached": False,
    }


@router.post("/pages/{page_id}/insights/{insight_id}/propose-suggestion")
async def propose_suggestion_for_insight(
    page_id: str,
    insight_id: str,
    req: RegenerateSuggestionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Per-insight magic wand: ask Claude for a concrete fix that addresses
    a specific observation, append it to the suggestions list, and remove
    the now-resolved insight.

    Used when the main generation pass returned an insight but no matching
    suggestion — the user clicks "Propose a fix" on the insight card and
    gets back a stageable change with an id and transform_instruction.
    """
    page, site = await _load_page_scoped(db, page_id, req.github_user_id)

    cached = page.latest_insights_json or {}
    insights = list(cached.get("insights", []))
    suggestions = list(cached.get("suggestions", []))
    idx = next(
        (i for i, item in enumerate(insights) if item.get("id") == insight_id),
        -1,
    )
    if idx < 0:
        raise HTTPException(status_code=404, detail="Unknown insight id for this page")

    insight_item = insights[idx]

    screenshot_url = (
        presign_screenshot_url(page.screenshot_key) if page.screenshot_key else None
    )
    evidence = await gather_page_evidence(db, page, site.id, screenshot_url=screenshot_url)
    new_sug = await convert_insight_to_suggestion(evidence, insight_item)
    if new_sug is None:
        raise HTTPException(
            status_code=502,
            detail="Couldn't propose a fix right now — try again in a moment.",
        )

    # Replace the insight with its concrete fix. The insight goes away
    # because it's now represented by an actionable suggestion — keeping
    # both would double-count the same observation in the UI.
    insights.pop(idx)
    suggestions.append(new_sug)
    page.latest_insights_json = {
        **cached,
        "insights": insights,
        "suggestions": suggestions,
    }

    hydrated = await _hydrate_suggestion_status(db, page.id, suggestions)
    return {
        "suggestion": next((s for s in hydrated if s.get("id") == new_sug["id"]), new_sug),
        "insights": insights,
        "suggestions": hydrated,
        "note": cached.get("note", ""),
        "page_path": page.path,
        "generated_at": page.latest_insights_at.isoformat() if page.latest_insights_at else None,
        "cached": False,
    }


@router.get("/sites/{site_id}/debug")
async def site_debug(
    site_id: str,
    github_user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Surface the live state of a heatmap site for triangulation.

    Returns enough information for a developer to instantly answer:
      • is the site row present and which key does it expect?
      • have any events ever arrived (last_event_at, first_event_at)?
      • do session / page / aggregate rows exist?
      • which paths is ingest creating rows for? (catches dashboard ↔ tracker
        path mismatches like /dashboard vs /dashboard/)

    Read-only. Auth-scoped to the same github_user_id that owns the site.
    """
    site = await _load_site(db, site_id, github_user_id)

    sess_count = (
        await db.execute(
            select(func.count()).select_from(HeatmapSession).where(
                HeatmapSession.site_id == site.id,
            )
        )
    ).scalar() or 0
    page_count = (
        await db.execute(
            select(func.count()).select_from(HeatmapPage).where(
                HeatmapPage.site_id == site.id,
            )
        )
    ).scalar() or 0
    agg_count = (
        await db.execute(
            select(func.count()).select_from(HeatmapAggregate)
            .join(HeatmapPage, HeatmapPage.id == HeatmapAggregate.page_id)
            .where(HeatmapPage.site_id == site.id)
        )
    ).scalar() or 0

    pages = (
        await db.execute(
            select(HeatmapPage)
            .where(HeatmapPage.site_id == site.id)
            .order_by(HeatmapPage.last_seen_at.desc())
            .limit(20)
        )
    ).scalars().all()

    recent_sessions = (
        await db.execute(
            select(
                HeatmapSession.session_id,
                HeatmapSession.viewport_class,
                HeatmapSession.started_at,
                HeatmapSession.ended_at,
                HeatmapSession.user_agent,
            )
            .where(HeatmapSession.site_id == site.id)
            .order_by(HeatmapSession.ended_at.desc())
            .limit(5)
        )
    ).all()

    return {
        "site": {
            "id": str(site.id),
            "site_key": site.site_key,
            "site_key_short": site.site_key[:12] + "…" if len(site.site_key) > 12 else site.site_key,
            "domain": site.domain,
            "verified_at": site.verified_at.isoformat() if site.verified_at else None,
            "first_event_at": site.first_event_at.isoformat() if site.first_event_at else None,
            "last_event_at": site.last_event_at.isoformat() if site.last_event_at else None,
            "install_status": site.install_status,
        },
        # The URL the tracker JS will POST to. If the snippet on the deployed
        # site points elsewhere, that's a stale install — re-run auto-install
        # or refetch /h.js.
        "expected_collect_url": f"{api_base_from_request(request)}/api/heatmap/collect",
        "expected_tracker_url": (
            f"{api_base_from_request(request)}/api/heatmap/h.js?site={site.site_key}"
        ),
        "counts": {
            "sessions": int(sess_count),
            "pages": int(page_count),
            "aggregates": int(agg_count),
        },
        "pages": [
            {
                "id": str(p.id),
                "path": p.path,
                "viewport_class": p.viewport_class,
                "session_count": p.session_count or 0,
                "page_height_px": p.page_height_px or 0,
                "first_seen_at": p.first_seen_at.isoformat() if p.first_seen_at else None,
                "last_seen_at": p.last_seen_at.isoformat() if p.last_seen_at else None,
                "has_screenshot": bool(p.screenshot_key),
            }
            for p in pages
        ],
        "recent_sessions": [
            {
                "session_id_short": s.session_id[:12] + "…" if len(s.session_id) > 12 else s.session_id,
                "viewport_class": s.viewport_class,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "browser_label": _parse_browser_label(s.user_agent),
            }
            for s in recent_sessions
        ],
    }
