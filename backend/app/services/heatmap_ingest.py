"""Heatmap event validation, bucketing, and aggregate upserts.

This module is the hot path for `/api/heatmap/collect`. Every request from
the tracker snippet flows through `process_events`. Raw events are *never*
persisted — we immediately bucket into a 50x50 grid keyed by
(page_id, layer, bucket_x, bucket_y, viewport_class, date_bucket) and upsert
an integer count per bucket.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HeatmapAggregate, HeatmapPage, HeatmapSession, HeatmapSite

logger = logging.getLogger(__name__)

GRID = 50                       # 50x50 buckets
RAGE_WINDOW_MS = 1000
RAGE_RADIUS_PX = 50
MAX_EVENTS_PER_REQUEST = 100


@dataclass
class CaptureTask:
    """Signal from ingest that a page needs a background screenshot.

    Held to a minimum — the background worker reloads the row to make the
    capture-claim atomic, so we only need the identity and the URL to hit.
    """
    page_id: UUID
    url: str


def normalize_path(p: str | None) -> str:
    """Collapse a tracker-reported path to its canonical form.

    Rule: strip trailing slash except on the root, leave query strings
    alone. Without this, `/dashboard` and `/dashboard/` create two
    HeatmapPage rows that would otherwise be the same page.
    """
    if not p:
        return "/"
    if len(p) > 1 and p.endswith("/"):
        trimmed = p.rstrip("/")
        return trimmed or "/"
    return p


@dataclass
class NormalizedClick:
    x_pct: float
    y_pct: float          # viewport-relative, used for rage px-distance
    page_y_pct: float
    ts_ms: int
    tag: str
    role: str


def viewport_class(width: int) -> str:
    if width >= 1024:
        return "desktop"
    if width >= 640:
        return "tablet"
    return "mobile"


def _bucket_idx(pct: float) -> int:
    if pct < 0:
        pct = 0
    if pct > 100:
        pct = 100
    idx = int(pct / 100 * GRID)
    if idx >= GRID:
        idx = GRID - 1
    return idx


def _detect_rage(clicks: list[NormalizedClick], page_width_px: int, page_height_px: int) -> list[NormalizedClick]:
    """Return the subset of clicks that form a rage cluster.

    A click is 'rage' if there are ≥2 other clicks within RAGE_WINDOW_MS and
    RAGE_RADIUS_PX (total cluster of 3+). We emit *all* cluster members as
    rage — the cluster is the user-visible pattern, not any individual click.
    """
    if not clicks or page_width_px <= 0 or page_height_px <= 0:
        return []

    # Convert percents back to approximate pixels so the radius is uniform
    # regardless of page dimensions.
    def to_px(c: NormalizedClick) -> tuple[float, float, int]:
        return (
            c.x_pct / 100 * page_width_px,
            c.page_y_pct / 100 * page_height_px,
            c.ts_ms,
        )

    pxy = [to_px(c) for c in clicks]
    rage: list[NormalizedClick] = []
    r2 = RAGE_RADIUS_PX * RAGE_RADIUS_PX
    for i, ci in enumerate(clicks):
        xi, yi, ti = pxy[i]
        neighbors = 0
        for j, _cj in enumerate(clicks):
            if j == i:
                continue
            xj, yj, tj = pxy[j]
            if abs(tj - ti) > RAGE_WINDOW_MS:
                continue
            dx = xj - xi
            dy = yj - yi
            if dx * dx + dy * dy <= r2:
                neighbors += 1
                if neighbors >= 2:
                    rage.append(ci)
                    break
    return rage


async def _get_or_create_page(
    db: AsyncSession,
    site_id,
    path: str,
    viewport_cls: str,
    page_height_px: int,
) -> HeatmapPage:
    row = (
        await db.execute(
            select(HeatmapPage).where(
                HeatmapPage.site_id == site_id,
                HeatmapPage.path == path,
                HeatmapPage.viewport_class == viewport_cls,
            )
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        row = HeatmapPage(
            site_id=site_id,
            path=path,
            viewport_class=viewport_cls,
            page_height_px=page_height_px,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(row)
        await db.flush()
    else:
        row.last_seen_at = now
        if page_height_px > row.page_height_px:
            row.page_height_px = page_height_px
    return row


async def _upsert_session(
    db: AsyncSession,
    site_id,
    session_id: str,
    viewport_cls: str,
    user_agent: str,
    rage_delta: int,
) -> bool:
    """Return True iff this is a first-time session (created the row)."""
    existing = (
        await db.execute(
            select(HeatmapSession).where(HeatmapSession.session_id == session_id)
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if existing is None:
        db.add(
            HeatmapSession(
                site_id=site_id,
                session_id=session_id,
                viewport_class=viewport_cls,
                user_agent=user_agent[:256],
                started_at=now,
                ended_at=now,
                rage_click_count=rage_delta,
            )
        )
        await db.flush()
        return True
    existing.ended_at = now
    existing.rage_click_count = (existing.rage_click_count or 0) + rage_delta
    return False


async def _upsert_aggregates(
    db: AsyncSession,
    rows: list[dict],
) -> None:
    if not rows:
        return
    stmt = pg_insert(HeatmapAggregate).values(rows)
    # index_elements — works with either a unique constraint or a unique index,
    # so we don't need to care which one create_all / the migration block made.
    stmt = stmt.on_conflict_do_update(
        index_elements=["page_id", "layer", "bucket_x", "bucket_y", "viewport_class", "date_bucket"],
        set_={
            "count": HeatmapAggregate.count + stmt.excluded.count,
            "session_count": HeatmapAggregate.session_count + stmt.excluded.session_count,
        },
    )
    await db.execute(stmt)


async def process_events(
    db: AsyncSession,
    site: HeatmapSite,
    *,
    session_id: str,
    path: str,
    page_width_px: int,
    page_height_px: int,
    viewport_width: int,
    viewport_height: int,
    user_agent: str,
    events: Iterable[dict],
) -> tuple[int, int, CaptureTask | None]:
    """Ingest one batch. Returns (accepted_count, rage_count, capture_task).

    `capture_task` is non-None when the page this batch targets has no
    screenshot yet — the route schedules a BackgroundTask to capture one.
    Scheduling is idempotent: the worker's UPDATE ... RETURNING claim
    deduplicates concurrent ingests for the same new page.
    """
    raw = list(events)[:MAX_EVENTS_PER_REQUEST]
    if not raw:
        return 0, 0, None

    path = normalize_path(path)
    viewport_cls = viewport_class(viewport_width)
    page = await _get_or_create_page(db, site.id, path, viewport_cls, page_height_px)

    now = datetime.now(timezone.utc)
    date_bucket = now.date()

    clicks: list[NormalizedClick] = []
    moves: list[tuple[int, int]] = []       # (bx, by)
    scrolls: list[int] = []                  # max_y_pct (integer band)
    accepted = 0

    for idx, ev in enumerate(raw):
        if not isinstance(ev, dict):
            continue
        kind = ev.get("type")
        try:
            if kind == "click":
                clicks.append(
                    NormalizedClick(
                        x_pct=float(ev.get("x_pct", 50)),
                        y_pct=float(ev.get("y_pct", 50)),
                        page_y_pct=float(ev.get("page_y_pct", 50)),
                        ts_ms=idx * 10,            # ordering proxy; real ms on the client jitters
                        tag=str(ev.get("tag", ""))[:32],
                        role=str(ev.get("role", ""))[:32],
                    )
                )
                accepted += 1
            elif kind == "move":
                moves.append((
                    _bucket_idx(float(ev.get("x_pct", 50))),
                    _bucket_idx(float(ev.get("page_y_pct", 50))),
                ))
                accepted += 1
            elif kind == "scroll":
                scrolls.append(int(max(0, min(100, float(ev.get("max_y_pct", 0))))))
                accepted += 1
            elif kind == "view":
                accepted += 1
        except (TypeError, ValueError):
            continue

    # Rage detection, then emit aggregates.
    rage = _detect_rage(clicks, page_width_px, page_height_px)

    agg_rows: dict[tuple, dict] = {}

    def bump(layer: str, bx: int, by: int) -> None:
        key = (page.id, layer, bx, by, viewport_cls, date_bucket)
        row = agg_rows.get(key)
        if row is None:
            agg_rows[key] = {
                "page_id": page.id,
                "layer": layer,
                "bucket_x": bx,
                "bucket_y": by,
                "viewport_class": viewport_cls,
                "date_bucket": date_bucket,
                "count": 1,
                "session_count": 0,
            }
        else:
            row["count"] += 1

    for c in clicks:
        bump("click", _bucket_idx(c.x_pct), _bucket_idx(c.page_y_pct))
    for c in rage:
        bump("rage", _bucket_idx(c.x_pct), _bucket_idx(c.page_y_pct))
    for bx, by in moves:
        bump("move", bx, by)
    for max_y in scrolls:
        # Scroll is a 1D retention curve — store it in bucket_y only, x=0.
        bump("scroll", 0, _bucket_idx(float(max_y)))

    # Mark sessions seen: first event of a new session bumps session_count
    # across every bucket it touched today.
    first_time = await _upsert_session(
        db, site.id, session_id, viewport_cls, user_agent, rage_delta=len(rage)
    )
    if first_time:
        for row in agg_rows.values():
            row["session_count"] = 1
        page.session_count = (page.session_count or 0) + 1

    await _upsert_aggregates(db, list(agg_rows.values()))

    site.last_event_at = now
    # Stamp the first ever event so the post-install celebration card has a
    # reliable timestamp without a separate COUNT(*) on the sessions table.
    if site.first_event_at is None:
        site.first_event_at = now

    # Debug-trace at INFO so we can confirm end-to-end ingest from logs alone.
    # One line per accepted batch — the same cadence as the route-level log.
    logger.info(
        "process_events: site=%s page=%s path=%s vp=%s clicks=%d moves=%d scrolls=%d "
        "agg_rows=%d session_first_time=%s",
        str(site.id)[:8], str(page.id)[:8], path, viewport_cls,
        len(clicks), len(moves), len(scrolls), len(agg_rows), first_time,
    )

    capture_task: CaptureTask | None = None
    if page.screenshot_key is None:
        # Build the live URL the worker will load. site.domain is stored
        # without a trailing slash (see create_site), and path always
        # starts with a leading /.
        capture_url = site.domain.rstrip("/") + path
        capture_task = CaptureTask(page_id=page.id, url=capture_url)

    return accepted, len(rage), capture_task
