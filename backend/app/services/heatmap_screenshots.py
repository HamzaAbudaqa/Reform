"""Background capture of the live-URL screenshot for a HeatmapPage.

The ingest path (`/api/heatmap/collect`) schedules `run_capture` as a
FastAPI BackgroundTask when it sees a page with no screenshot yet. The
request returns immediately; Playwright runs after the response closes.

Concurrency & retry are enforced at the DB level, not in the scheduler:

  • Claim: a single UPDATE sets `screenshot_capture_started_at` iff the
    page still has no screenshot AND isn't already being captured (or the
    prior attempt is stale). `.rowcount == 1` means we own this capture;
    anything else means somebody else is on it or it's already done.

  • Retry: the claim also matches rows whose `started_at` is older than
    `_STALE_AFTER`, so a dead process or crashed capture is picked up by
    the next ingest without a separate job.

  • On success: the same row gets `screenshot_key` set and
    `started_at` cleared in one statement.

  • On failure: we clear `started_at` and leave `screenshot_key` null so
    the next inbound event triggers another attempt. We also do one
    in-process retry before giving up, so a transient Playwright hiccup
    doesn't force the user to wait for the next flush.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session
from app.models import HeatmapPage
from app.services.s3_client import upload_screenshot
from app.services.screenshot import take_screenshot_b64

logger = logging.getLogger(__name__)

# A capture that's been running longer than this is treated as dead and
# can be reclaimed by a fresh ingest. Playwright + S3 upload should
# comfortably finish in well under this; the window is wide enough that
# a slow CI-grade runner won't trip it.
_STALE_AFTER = timedelta(minutes=2)

# Slugify used for the S3 key segment, kept in sync with the path logic
# in the manual-capture endpoint so a re-capture overwrites rather than
# duplicates.
def _slug(path: str) -> str:
    import re
    return re.sub(r"[^a-zA-Z0-9_\-.]", "_", path or "home")


async def _claim(db: AsyncSession, page_id: UUID) -> HeatmapPage | None:
    """Atomically mark the page as being captured. Returns the row iff we won."""
    now = datetime.now(timezone.utc)
    stale_cutoff = now - _STALE_AFTER
    stmt = (
        update(HeatmapPage)
        .where(
            HeatmapPage.id == page_id,
            HeatmapPage.screenshot_key.is_(None),
            (
                HeatmapPage.screenshot_capture_started_at.is_(None)
                | (HeatmapPage.screenshot_capture_started_at < stale_cutoff)
            ),
        )
        .values(screenshot_capture_started_at=now)
        .returning(HeatmapPage)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    await db.commit()
    return row


async def _record_success(db: AsyncSession, page_id: UUID, key: str) -> None:
    await db.execute(
        update(HeatmapPage)
        .where(HeatmapPage.id == page_id)
        .values(screenshot_key=key, screenshot_capture_started_at=None)
    )
    await db.commit()


async def _record_failure(db: AsyncSession, page_id: UUID) -> None:
    # Clear the in-flight marker; leave screenshot_key null so the next
    # inbound event naturally retries via the normal ingest path.
    await db.execute(
        update(HeatmapPage)
        .where(HeatmapPage.id == page_id)
        .values(screenshot_capture_started_at=None)
    )
    await db.commit()


async def _attempt(url: str) -> str:
    """One Playwright capture. Returns base64 PNG; raises on failure."""
    b64 = await take_screenshot_b64(url)
    if not b64:
        raise RuntimeError("screenshot returned empty payload")
    return b64


async def run_capture(page_id: UUID, url: str) -> None:
    """Background entrypoint. Safe to call concurrently for the same page."""
    if async_session is None:
        # Happens in tests / local runs without DATABASE_URL. Bail cleanly
        # instead of raising from a BackgroundTask, where the traceback
        # never reaches the user.
        logger.warning("capture: no DB configured, skipping page=%s", page_id)
        return

    # Step 1 — claim in its own transaction so the lock is visible to
    # any concurrent ingest while Playwright runs.
    async with async_session() as claim_db:
        page = await _claim(claim_db, page_id)
    if page is None:
        logger.info("capture: already done or in flight, page=%s", page_id)
        return

    # Step 2 — run Playwright with one in-process retry for transient
    # network / page-load errors.
    b64: str | None = None
    last_exc: Exception | None = None
    for attempt in (1, 2):
        try:
            b64 = await _attempt(url)
            break
        except Exception as exc:  # noqa: BLE001 — Playwright surface is broad
            last_exc = exc
            logger.warning(
                "capture attempt %d failed page=%s url=%s err=%s",
                attempt, page_id, url, exc,
            )

    if b64 is None:
        async with async_session() as fail_db:
            await _record_failure(fail_db, page_id)
        logger.error("capture: giving up page=%s err=%s", page_id, last_exc)
        return

    # Step 3 — upload to S3 and persist the key.
    key = upload_screenshot(str(page.site_id), _slug(page.path), "heatmap", b64)
    if not key:
        async with async_session() as fail_db:
            await _record_failure(fail_db, page_id)
        logger.error("capture: S3 upload returned empty key page=%s", page_id)
        return

    async with async_session() as done_db:
        await _record_success(done_db, page_id, key)
    logger.info("capture: done page=%s key=%s", page_id, key)
