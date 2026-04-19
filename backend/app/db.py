"""
Database connection setup for Reform.

Uses SQLAlchemy async engine with asyncpg driver for Postgres.
The get_db dependency provides a session per request.
"""

import logging
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Railway provides DATABASE_URL with postgresql:// scheme.
# SQLAlchemy async needs postgresql+asyncpg:// instead.
_raw_url = os.environ.get("DATABASE_URL", "")
if not _raw_url:
    logging.getLogger(__name__).warning(
        "DATABASE_URL not set — all database operations will fail. "
        "Set this in your Railway environment."
    )
if _raw_url.startswith("postgresql://"):
    DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgres://"):
    DATABASE_URL = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = _raw_url

engine = create_async_engine(DATABASE_URL, echo=False, pool_size=5, max_overflow=10) if DATABASE_URL else None
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False) if engine else None


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db():
    """FastAPI dependency that yields a database session per request."""
    if not async_session:
        raise RuntimeError("DATABASE_URL not configured")
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_optional_db():
    """Yield a database session when configured, otherwise yield None."""
    if not async_session:
        yield None
        return

    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def create_tables():
    """Create all tables. Called once on startup."""
    if not engine:
        return
    from sqlalchemy import text
    _log = logging.getLogger(__name__)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Lightweight in-place migrations for columns added after initial deploy.
        # `create_all` never alters existing tables, so add columns idempotently.
        # Postgres supports ADD COLUMN IF NOT EXISTS since 9.6, so these are
        # safe to run on every startup.
        _migrations = [
            # Pre-existing column (kept so fresh DBs stay consistent with old ones).
            ("source_commit_sha", "VARCHAR"),
            # Problem 1 / 4 — run metadata for deterministic mode + progress.
            ("mode", "VARCHAR"),
            ("current_stage", "VARCHAR"),
            ("progress_percent", "INTEGER"),
            ("design_intelligence_snapshot", "JSONB"),
            ("transform_plan_snapshot", "JSONB"),
            ("model_params", "JSONB"),
            ("transformation_notes", "JSONB"),
            ("error_message", "TEXT"),
            ("updated_at", "TIMESTAMPTZ"),
        ]
        for col_name, col_type in _migrations:
            await conn.execute(text(
                f"ALTER TABLE transform_runs ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
            ))
            _log.info("Ensured column transform_runs.%s (%s)", col_name, col_type)

        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_transform_runs_source_commit_sha "
            "ON transform_runs (source_commit_sha)"
        ))
        # Active-run lookup filters on status + updated_at. Keep it cheap.
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_transform_runs_status_updated "
            "ON transform_runs (status, updated_at DESC)"
        ))

        # Heatmap — the unique composite index backing the upsert is created
        # by create_all via the UniqueConstraint on HeatmapAggregate. Add a
        # non-unique index to speed up the common read path (by page+layer+date).
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_heatmap_agg_page_layer_date "
            "ON heatmap_aggregates (page_id, layer, date_bucket DESC)"
        ))

        # Heatmap install state + first-event tracking. Added after the initial
        # heatmap deploy, so existing rows need backfill via ALTER TABLE. Default
        # for install_status is set in the model; existing rows pick it up here.
        _heatmap_site_migrations = [
            ("first_event_at", "TIMESTAMPTZ"),
            ("install_status", "VARCHAR NOT NULL DEFAULT 'not_started'"),
            ("install_mode", "VARCHAR"),
            ("install_framework", "VARCHAR"),
            ("install_target_file", "VARCHAR"),
            ("install_pr_url", "VARCHAR"),
            ("install_pr_number", "INTEGER"),
            ("install_branch_name", "VARCHAR"),
            ("install_error", "TEXT"),
            ("install_attempted_at", "TIMESTAMPTZ"),
        ]
        for col_name, col_type in _heatmap_site_migrations:
            await conn.execute(text(
                f"ALTER TABLE heatmap_sites ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
            ))
            _log.info("Ensured column heatmap_sites.%s (%s)", col_name, col_type)

        # Heatmap page insights cache — added when the AI recommendations
        # surface shipped. Existing rows pick up NULL which the service
        # treats as "no cached result, generate fresh".
        _heatmap_page_migrations = [
            ("latest_insights_json", "JSONB"),
            ("latest_insights_at", "TIMESTAMPTZ"),
        ]
        for col_name, col_type in _heatmap_page_migrations:
            await conn.execute(text(
                f"ALTER TABLE heatmap_pages ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
            ))
            _log.info("Ensured column heatmap_pages.%s (%s)", col_name, col_type)
