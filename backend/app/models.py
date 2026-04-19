"""
Database models for Reform.

Project → RepoSnapshot → TransformRun → PageResult

Screenshots and large blobs are stored in S3.
Metadata, code, and results are stored in Postgres.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


def _uuid():
    return uuid.uuid4()


class UserSubscription(Base):
    """Tracks a user's subscription plan, Stripe IDs, and monthly usage."""
    __tablename__ = "user_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    github_user_id = Column(String, nullable=False, unique=True, index=True)
    plan = Column(String, nullable=False, default="free")  # free | pro | max
    stripe_customer_id = Column(String, nullable=True, unique=True)
    stripe_subscription_id = Column(String, nullable=True, unique=True)
    subscription_status = Column(String, nullable=False, default="active")  # active | canceled | past_due | incomplete
    scans_used_this_month = Column(Integer, nullable=False, default=0)
    repos_connected = Column(Integer, nullable=False, default=0)
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class Project(Base):
    """A user's project — one per repo."""
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    github_user_id = Column(String, nullable=False, index=True)
    github_username = Column(String, nullable=False)
    repo_name = Column(String, nullable=False)          # "owner/repo"
    repo_url = Column(String, nullable=False)            # "https://github.com/owner/repo"
    branch = Column(String, nullable=False, default="main")
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    snapshots = relationship("RepoSnapshot", back_populates="project", cascade="all, delete-orphan")
    runs = relationship("TransformRun", back_populates="project", cascade="all, delete-orphan")


class RepoSnapshot(Base):
    """A snapshot of the repo's ingested files at a point in time."""
    __tablename__ = "repo_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    file_tree = Column(JSON, nullable=False)              # list of file paths
    framework = Column(String, default="unknown")
    s3_key = Column(String, nullable=True)                # S3 key for compressed file contents
    file_count = Column(Integer, default=0)
    snapshot_at = Column(DateTime(timezone=True), default=_utcnow)

    project = relationship("Project", back_populates="snapshots")
    runs = relationship("TransformRun", back_populates="snapshot")


class TransformRun(Base):
    """A single run of the transformation pipeline."""
    __tablename__ = "transform_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey("repo_snapshots.id"), nullable=True)
    # Status values used across the codebase:
    #   running / in_progress — pipeline still executing
    #   complete / completed  — finished successfully
    #   failed                — pipeline raised or reported unrecoverable errors
    # We accept both `complete` and `completed` for backwards compat with
    # pre-existing rows; new code writes `completed`.
    status = Column(String, nullable=False, default="running")
    design_intelligence = Column(JSON, nullable=True)
    user_intent = Column(String, default="")
    source_commit_sha = Column(String, nullable=True, index=True)   # GitHub HEAD SHA the run was built against
    total_pages_found = Column(Integer, default=0)
    total_transformed = Column(Integer, default=0)
    total_skipped = Column(Integer, default=0)
    global_summary = Column(JSON, default=list)
    pipeline_errors = Column(JSON, default=list)
    # Problem 1 / 2 / 4 additions. All nullable so existing rows stay valid.
    mode = Column(String, nullable=True, default="stable")           # "stable" | "explore"
    current_stage = Column(String, nullable=True)                    # e.g. "evaluating"
    progress_percent = Column(Integer, nullable=True)                # 0..100
    design_intelligence_snapshot = Column(JSON, nullable=True)       # full DI used this run
    transform_plan_snapshot = Column(JSON, nullable=True)            # planner output reused on stable re-runs
    model_params = Column(JSON, nullable=True)                       # {"profile", "temperature", "model"}
    transformation_notes = Column(JSON, nullable=True, default=list) # competitor-inspiration bullets
    error_message = Column(Text, nullable=True)                      # set when status=failed
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="runs")
    snapshot = relationship("RepoSnapshot", back_populates="runs")
    page_results = relationship("PageResult", back_populates="run", cascade="all, delete-orphan")


class PageResult(Base):
    """Transform result for a single page within a run."""
    __tablename__ = "page_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    run_id = Column(UUID(as_uuid=True), ForeignKey("transform_runs.id"), nullable=False)
    page_path = Column(String, nullable=False)
    page_name = Column(String, nullable=False)
    route = Column(String, default="/")
    score = Column(Integer, default=0)
    status = Column(String, nullable=False)               # transformed / high_quality / error
    original_code = Column(Text, default="")
    updated_code = Column(Text, default="")
    diff_summary = Column(Text, default="")
    change_annotations = Column(JSON, default=list)
    change_summary = Column(JSON, default=list)
    before_screenshot_key = Column(String, nullable=True)  # S3 key
    after_screenshot_key = Column(String, nullable=True)   # S3 key
    error = Column(Text, default="")
    retries_used = Column(Integer, default=0)

    run = relationship("TransformRun", back_populates="page_results")


class UXLabSession(Base):
    """A UX analysis session: screenshot a URL, identify issues, generate CSS patches."""
    __tablename__ = "ux_lab_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    workspace_id = Column(String, nullable=False, index=True)  # github_user_id
    url = Column(String, nullable=False)
    page = Column(String, nullable=False, default="home")
    before_screenshot_key = Column(String, nullable=True)   # S3 key
    after_screenshot_key = Column(String, nullable=True)    # S3 key
    findings_json = Column(JSON, nullable=False, default=list)
    status = Column(String, nullable=False, default="pending")  # pending / complete / error
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class SiteVisit(Base):
    """Tracks individual page visit durations for analytics."""
    __tablename__ = "site_visits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    github_user_id = Column(String, nullable=True, index=True)
    path = Column(String, nullable=False, default="/")
    duration_seconds = Column(Integer, nullable=False, default=0)
    visited_at = Column(DateTime(timezone=True), default=_utcnow)


# ── Heatmap ────────────────────────────────────────────────────────────
# One HeatmapSite per deployed URL per project. Events from the tracker
# snippet ingest into aggregate buckets (never raw events); background
# screenshots of the live URL live in S3.

class HeatmapSite(Base):
    __tablename__ = "heatmap_sites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    github_user_id = Column(String, nullable=False, index=True)
    site_key = Column(String, nullable=False, unique=True, index=True)
    domain = Column(String, nullable=False)                     # "https://example.com"
    verified_at = Column(DateTime(timezone=True), nullable=True)
    last_event_at = Column(DateTime(timezone=True), nullable=True)
    first_event_at = Column(DateTime(timezone=True), nullable=True)   # set on first ingest after activation
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Install state — persisted so the user can refresh / leave / come back
    # and resume in the right place.
    #
    # install_status values (the only ones the frontend checks):
    #   not_started             — fresh site, show the choice card
    #   awaiting_github_action  — auto-install opened a PR; "Almost done" card
    #   manual_fallback         — user picked manual install; restore that flow
    #   tracking_live           — verified once; setup is complete
    #   failed                  — last install attempt failed; choice card + notice
    install_status = Column(String, nullable=False, default="not_started")
    install_mode = Column(String, nullable=True)                # "automatic" | "manual"
    install_framework = Column(String, nullable=True)            # "Next.js (App Router)" etc.
    install_target_file = Column(String, nullable=True)          # repo-relative path that was modified
    install_pr_url = Column(String, nullable=True)
    install_pr_number = Column(Integer, nullable=True)
    install_branch_name = Column(String, nullable=True)
    install_error = Column(Text, nullable=True)
    install_attempted_at = Column(DateTime(timezone=True), nullable=True)


class HeatmapPage(Base):
    __tablename__ = "heatmap_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    site_id = Column(UUID(as_uuid=True), ForeignKey("heatmap_sites.id"), nullable=False, index=True)
    path = Column(String, nullable=False)
    viewport_class = Column(String, nullable=False, default="desktop")  # desktop|tablet|mobile
    screenshot_key = Column(String, nullable=True)                       # S3 key for live-URL screenshot
    page_height_px = Column(Integer, nullable=False, default=0)
    first_seen_at = Column(DateTime(timezone=True), default=_utcnow)
    last_seen_at = Column(DateTime(timezone=True), default=_utcnow)
    session_count = Column(Integer, nullable=False, default=0)
    # Cached AI insights — populated by POST /api/heatmap/pages/{id}/insights.
    # Persisted so a refresh / page reopen doesn't re-bill Claude. Bypassed
    # by `?regenerate=true` and considered stale after INSIGHTS_TTL_SECONDS.
    latest_insights_json = Column(JSON, nullable=True)
    latest_insights_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("site_id", "path", "viewport_class", name="uq_heatmap_pages_site_path_vp"),
    )


class HeatmapAggregate(Base):
    __tablename__ = "heatmap_aggregates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    page_id = Column(UUID(as_uuid=True), ForeignKey("heatmap_pages.id"), nullable=False, index=True)
    layer = Column(String, nullable=False)                # click|move|scroll|rage
    bucket_x = Column(Integer, nullable=False)            # 0..49
    bucket_y = Column(Integer, nullable=False)            # 0..49
    viewport_class = Column(String, nullable=False)
    date_bucket = Column(Date, nullable=False)            # UTC date rollup
    count = Column(Integer, nullable=False, default=0)
    session_count = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint(
            "page_id", "layer", "bucket_x", "bucket_y", "viewport_class", "date_bucket",
            name="uq_heatmap_agg_bucket",
        ),
    )


class HeatmapSession(Base):
    __tablename__ = "heatmap_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    site_id = Column(UUID(as_uuid=True), ForeignKey("heatmap_sites.id"), nullable=False, index=True)
    session_id = Column(String, nullable=False, unique=True, index=True)
    user_agent = Column(String, nullable=True)
    viewport_class = Column(String, nullable=False, default="desktop")
    started_at = Column(DateTime(timezone=True), default=_utcnow)
    ended_at = Column(DateTime(timezone=True), default=_utcnow)
    rage_click_count = Column(Integer, nullable=False, default=0)
