"""AI UX recommendations from heatmap data.

Pipeline:
  1. `gather_page_evidence` summarizes a HeatmapPage into the structured
     behavioral signals an LLM can reason about (top click hotspots, top
     rage hotspots, scroll-depth percentiles, session count, etc.).
  2. `generate_insights` calls Claude via tool use so the structured JSON
     is enforced by the API itself — no fragile prompt-and-pray parsing.
  3. The route handler caches the result on `HeatmapPage` to avoid
     re-billing the model on every page reopen.

Categories (v1, intentionally narrow):
  - rage_click       users repeatedly click a non-interactive element
  - scroll_depth     critical content lives below visitor reach
  - cta_prominence   primary action gets weak attention vs. its neighbors
  - navigation       header/nav frustration or label confusion
"""

from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HeatmapAggregate, HeatmapPage, HeatmapSession
from app.services.anthropic_errors import is_anthropic_exception, log_and_classify

logger = logging.getLogger(__name__)

# Cached results older than this are regenerated on the next request.
INSIGHTS_TTL_SECONDS = 60 * 60   # 1 hour

# Don't even ask the model below this many sessions — the signal is too
# thin to give a confident recommendation, and a fabricated one would
# erode trust faster than no recommendation at all.
MIN_SESSIONS_FOR_INSIGHTS = 10

# How many top buckets to surface in each evidence layer.
TOP_HOTSPOTS = 8

# Ceilings for what we ask the model to emit. The schema enforces these
# but we also include them in the prompt so the model knows the budget.
MAX_INSIGHTS = 4
MAX_SUGGESTIONS = 5


# ── Evidence ──────────────────────────────────────────────────────────


@dataclass
class Hotspot:
    bucket_x: int          # 0..49
    bucket_y: int          # 0..49
    count: int

    @property
    def x_pct(self) -> int:
        # Bucket center, expressed as "this far across the page" in human terms.
        return int((self.bucket_x + 0.5) * 2)

    @property
    def y_pct(self) -> int:
        return int((self.bucket_y + 0.5) * 2)

    def describe(self) -> str:
        return (
            f"x≈{self.x_pct}% y≈{self.y_pct}% "
            f"({_quadrant(self.x_pct, self.y_pct)}) — {self.count} events"
        )


@dataclass
class PageEvidence:
    page_path: str
    viewport_class: str
    session_count: int
    page_height_px: int
    click_total: int
    rage_total: int
    move_total: int
    click_hotspots: list[Hotspot] = field(default_factory=list)
    rage_hotspots: list[Hotspot] = field(default_factory=list)
    # Scroll: what fraction of sessions reached each band.
    # Each entry is (label, sessions_reaching). Computed from cumulative scroll
    # buckets, then converted to percentage of total sessions in the response.
    scroll_reach: dict[str, int] = field(default_factory=dict)
    screenshot_url: Optional[str] = None


def _quadrant(x_pct: int, y_pct: int) -> str:
    """Human-friendly description of a hotspot location on the page."""
    horiz = "left" if x_pct < 33 else ("right" if x_pct > 66 else "center")
    vert = (
        "top" if y_pct < 25
        else ("upper-middle" if y_pct < 50
              else ("lower-middle" if y_pct < 75 else "bottom"))
    )
    return f"{vert} {horiz}"


async def gather_page_evidence(
    db: AsyncSession,
    page: HeatmapPage,
    site_id,
    days: int = 30,
    screenshot_url: Optional[str] = None,
) -> PageEvidence:
    """Pull behavioral evidence for `page` over the last `days`.

    Aggregates query is bounded to keep the prompt small — top-K buckets
    per layer plus totals. Scroll-depth is bucketed into a coarse reach
    table the model can reason about quickly.
    """
    # Site-wide session count is the right denominator — sessions touch a
    # site, not just one page. Used for both the low-data gate and as
    # context for the model.
    sess_count = (
        await db.execute(
            select(func.count()).select_from(HeatmapSession).where(
                HeatmapSession.site_id == site_id,
            )
        )
    ).scalar() or 0

    async def _hotspots(layer: str) -> tuple[list[Hotspot], int]:
        rows = (
            await db.execute(
                select(
                    HeatmapAggregate.bucket_x,
                    HeatmapAggregate.bucket_y,
                    func.sum(HeatmapAggregate.count).label("count"),
                )
                .where(
                    HeatmapAggregate.page_id == page.id,
                    HeatmapAggregate.layer == layer,
                )
                .group_by(HeatmapAggregate.bucket_x, HeatmapAggregate.bucket_y)
                .order_by(func.sum(HeatmapAggregate.count).desc())
                .limit(TOP_HOTSPOTS)
            )
        ).all()
        spots = [Hotspot(r.bucket_x, r.bucket_y, int(r.count or 0)) for r in rows]
        total_row = (
            await db.execute(
                select(func.sum(HeatmapAggregate.count)).where(
                    HeatmapAggregate.page_id == page.id,
                    HeatmapAggregate.layer == layer,
                )
            )
        ).scalar()
        return spots, int(total_row or 0)

    click_hotspots, click_total = await _hotspots("click")
    rage_hotspots, rage_total = await _hotspots("rage")
    _, move_total = await _hotspots("move")

    # Scroll reach: for each milestone (25/50/75/90% page depth), how many
    # cumulative scroll events surpassed that bucket. The scroll layer
    # stores max_y_pct in bucket_y, so we sum counts where bucket_y is at
    # or beyond the milestone bucket.
    scroll_reach: dict[str, int] = {}
    for label, milestone_pct in (("25%", 25), ("50%", 50), ("75%", 75), ("90%", 90)):
        milestone_bucket = int(milestone_pct / 2)  # bucket index (0-49 maps to 0-100%)
        reached = (
            await db.execute(
                select(func.sum(HeatmapAggregate.count)).where(
                    HeatmapAggregate.page_id == page.id,
                    HeatmapAggregate.layer == "scroll",
                    HeatmapAggregate.bucket_y >= milestone_bucket,
                )
            )
        ).scalar()
        scroll_reach[label] = int(reached or 0)

    return PageEvidence(
        page_path=page.path,
        viewport_class=page.viewport_class,
        session_count=int(sess_count),
        page_height_px=page.page_height_px or 0,
        click_total=click_total,
        rage_total=rage_total,
        move_total=move_total,
        click_hotspots=click_hotspots,
        rage_hotspots=rage_hotspots,
        scroll_reach=scroll_reach,
        screenshot_url=screenshot_url,
    )


# ── Prompt assembly ───────────────────────────────────────────────────


def _evidence_to_text(ev: PageEvidence) -> str:
    """Format the structured evidence into a tight prompt block."""
    lines = [
        f"Page path: {ev.page_path}",
        f"Viewport class: {ev.viewport_class}",
        f"Sessions recorded: {ev.session_count}",
        f"Page height: {ev.page_height_px}px",
        "",
        f"Total clicks: {ev.click_total}",
        f"Total rage-click events: {ev.rage_total}",
        f"Total pointer-move events: {ev.move_total}",
        "",
    ]

    if ev.click_hotspots:
        lines.append("Top click hotspots (most engaged areas):")
        for h in ev.click_hotspots:
            lines.append(f"  • {h.describe()}")
        lines.append("")

    if ev.rage_hotspots:
        lines.append("RAGE click hotspots (visitor frustration — repeated clicks in same spot):")
        for h in ev.rage_hotspots:
            lines.append(f"  • {h.describe()}")
        lines.append("")
    else:
        lines.append("No rage-click hotspots detected.")
        lines.append("")

    if ev.scroll_reach:
        sess = max(ev.session_count, 1)
        lines.append("Scroll depth reach (events that scrolled at least this far):")
        for label, count in ev.scroll_reach.items():
            pct_of_sessions = round(100 * count / sess) if sess else 0
            lines.append(f"  • {label} of page: {count} scroll events (~{pct_of_sessions}% of sessions)")
        lines.append("")

    return "\n".join(lines)


_SYSTEM_PROMPT = (
    "You are a senior UX designer analyzing real visitor behavior data for a single web page. "
    "Your goal is to produce 1-4 high-confidence INSIGHTS and 1-5 actionable SUGGESTIONS, "
    "each tied to specific evidence in the data and (when provided) the page screenshot. "
    "Avoid generic advice — every recommendation must reference concrete numbers, locations, "
    "or visible elements. If the evidence is thin, return fewer items with low confidence "
    "rather than fabricating strong claims."
)


_USER_PROMPT_TEMPLATE = """Analyze the visitor behavior for this page and report the most impactful UX problems and concrete fixes.

CATEGORIES (only these — do not invent others):
  • rage_click — visitors repeatedly click something that isn't interactive (use rage hotspots)
  • scroll_depth — important content sits below where most visitors reach (use scroll depth)
  • cta_prominence — primary action is getting weak attention vs. surrounding elements
  • navigation — header/nav is attracting confused or frustrated clicks

EVIDENCE
--------
{evidence}

CONSTRAINTS
-----------
1. Each `evidence` field must cite a specific number, percentage, or location from the data above.
2. Each `transform_instruction` must be a single self-contained sentence an AI code transformer can act on without seeing this page — name the element ("the pricing cards in the lower-middle of the page"), the change ("make the entire card clickable so it navigates to the plan detail"), and any constraint ("preserve current styling").
3. Cap: at most {max_insights} insights and {max_suggestions} suggestions. Quality over quantity.
4. `confidence` = how sure you are the pattern is real. "high" requires both rage/click data AND a clear screenshot affordance you can point to. "medium" requires a clear pattern in one of those. "low" otherwise.
5. `severity` = how harmful the issue is IF the pattern is real. "high" = users are likely bouncing, blocked, or failing a primary goal. "medium" = friction on an important flow but not a blocker. "low" = polish / nice-to-have. Confidence and severity are orthogonal — do NOT assume they move together.
6. `target_region` (optional, suggestions only): if the screenshot makes the target area visually obvious, emit normalized [0,1] coordinates ({{x, y, width, height}}) where (0,0) is the top-left of the full page. Omit for page-wide or non-spatial changes.
7. **Pairing rule (critical):** every insight you emit MUST come with at least one concrete suggestion in the suggestions array that addresses it. Users act on suggestions, not observations — an insight with no paired fix is dead UI. If you truly cannot propose a concrete, code-level fix for an observation, omit the insight entirely. It is better to return one insight + one suggestion than four insights + zero suggestions.
8. If the evidence genuinely doesn't support a category, omit it — do NOT fabricate.

Return your output by calling the `report_recommendations` tool exactly once."""


# Two axes on every insight + suggestion:
#   confidence — how sure the model is that the pattern is real
#   severity   — how harmful the underlying issue is if true
# These are orthogonal: high-confidence + low-severity ("we're sure nobody
# reads the footer — that's probably fine") is a real shape and deserves
# different UI treatment than high-confidence + high-severity.
_SEVERITY_ENUM = {"type": "string", "enum": ["low", "medium", "high"]}
_CONFIDENCE_ENUM = {"type": "string", "enum": ["low", "medium", "high"]}

_TARGET_REGION_SCHEMA = {
    "type": "object",
    "description": (
        "Optional normalized bounding box identifying the page area this "
        "suggestion applies to. Use when the screenshot makes the target "
        "region visually obvious (a CTA, a nav bar, a card). Omit when the "
        "change is page-wide or the target can't be pinned spatially."
    ),
    "properties": {
        "x":      {"type": "number", "minimum": 0, "maximum": 1},
        "y":      {"type": "number", "minimum": 0, "maximum": 1},
        "width":  {"type": "number", "minimum": 0, "maximum": 1},
        "height": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["x", "y", "width", "height"],
}

_TOOL_DEFINITION = {
    "name": "report_recommendations",
    "description": (
        "Report evidence-based UX insights and concrete suggestions for this page. "
        "Call this tool exactly once with the structured analysis."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "insights": {
                "type": "array",
                "maxItems": MAX_INSIGHTS,
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": [
                            "rage_click", "scroll_depth", "cta_prominence", "navigation",
                        ]},
                        "title": {"type": "string", "maxLength": 80},
                        "summary": {"type": "string", "maxLength": 240},
                        "evidence": {"type": "string", "maxLength": 240},
                        "confidence": _CONFIDENCE_ENUM,
                        "severity": _SEVERITY_ENUM,
                    },
                    "required": ["type", "title", "summary", "evidence", "confidence", "severity"],
                },
            },
            "suggestions": {
                "type": "array",
                "maxItems": MAX_SUGGESTIONS,
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "maxLength": 80},
                        "description": {"type": "string", "maxLength": 200},
                        "rationale": {"type": "string", "maxLength": 240},
                        "confidence": _CONFIDENCE_ENUM,
                        "severity": _SEVERITY_ENUM,
                        "target_area": {"type": "string", "maxLength": 60},
                        "target_region": _TARGET_REGION_SCHEMA,
                        "suggested_change_type": {"type": "string", "enum": [
                            "make_clickable", "move_higher", "increase_contrast",
                            "enlarge", "reposition", "simplify", "clarify_label",
                            "shorten", "add_cta", "add_affordance",
                        ]},
                        "transform_instruction": {"type": "string", "maxLength": 280},
                    },
                    "required": [
                        "title", "description", "rationale", "confidence", "severity",
                        "target_area", "suggested_change_type", "transform_instruction",
                    ],
                },
            },
        },
        "required": ["insights", "suggestions"],
    },
}


# ── Generation ────────────────────────────────────────────────────────


def _build_message_content(ev: PageEvidence) -> list[dict]:
    """Assemble the user message content. Includes the screenshot URL as
    a vision input when one is available — Claude grounds recommendations
    much better when it can actually see the page."""
    text_block = {
        "type": "text",
        "text": _USER_PROMPT_TEMPLATE.format(
            evidence=_evidence_to_text(ev),
            max_insights=MAX_INSIGHTS,
            max_suggestions=MAX_SUGGESTIONS,
        ),
    }
    if ev.screenshot_url:
        return [
            {"type": "image", "source": {"type": "url", "url": ev.screenshot_url}},
            text_block,
        ]
    return [text_block]


async def generate_insights(ev: PageEvidence) -> dict[str, Any]:
    """Call Claude with tool use, return the parsed structured payload.

    On any model/transport error returns an empty result with `note` set
    so the caller can render a graceful fallback rather than a 500.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"insights": [], "suggestions": [], "note": "AI not configured."}

    client = anthropic.Anthropic(api_key=api_key)
    try:
        # Run the sync SDK call in a worker thread so we don't block the
        # event loop. This matches the pattern used elsewhere in Reform
        # (edit_lab_service, transform pipeline).
        import asyncio
        message = await asyncio.to_thread(
            client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=_SYSTEM_PROMPT,
            tools=[_TOOL_DEFINITION],
            tool_choice={"type": "tool", "name": "report_recommendations"},
            messages=[{"role": "user", "content": _build_message_content(ev)}],
        )
    except Exception as exc:  # noqa: BLE001 — boundary error
        if is_anthropic_exception(exc):
            info = log_and_classify(exc)
            return {"insights": [], "suggestions": [], "note": info.user_message}
        logger.error("heatmap insights: model call failed: %s", exc, exc_info=True)
        return {
            "insights": [], "suggestions": [],
            "note": "We couldn't generate recommendations right now. Try again in a moment.",
        }

    # Find the tool_use block — with `tool_choice` forcing the call, this
    # should always be present, but defend against malformed responses.
    payload: dict[str, Any] | None = None
    for block in message.content:
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == "report_recommendations":
            payload = block.input  # type: ignore[assignment]
            break
    if not payload or not isinstance(payload, dict):
        logger.warning("heatmap insights: model returned no tool_use block")
        return {
            "insights": [], "suggestions": [],
            "note": "The AI didn't return a usable response. Try again.",
        }

    insights = payload.get("insights") or []
    suggestions = payload.get("suggestions") or []

    # IDs are minted server-side so the frontend can use them as React keys
    # and so they survive serialization without the model needing to invent
    # uniqueness. Short hex is plenty for in-flight selection state.
    for item in insights:
        item["id"] = "ins_" + secrets.token_hex(4)
    for item in suggestions:
        item["id"] = "sug_" + secrets.token_hex(4)

    return {"insights": insights, "suggestions": suggestions, "note": ""}


def is_cache_fresh(generated_at: Optional[datetime]) -> bool:
    if not generated_at:
        return False
    age = datetime.now(timezone.utc) - generated_at
    return age.total_seconds() < INSIGHTS_TTL_SECONDS


# ── Insight → Suggestion (per-card "Propose a fix") ───────────────────


_INSIGHT_TO_SUG_SYSTEM_PROMPT = (
    "You are a senior UX designer. The user is looking at a behavioral "
    "INSIGHT (an observation about how visitors use their page) and wants "
    "a concrete, code-level fix they can ship. Your job is to propose "
    "exactly one actionable suggestion that addresses the insight, "
    "grounded in the same evidence. Do not restate the insight — prescribe "
    "the change."
)


_INSIGHT_TO_SUG_USER_PROMPT_TEMPLATE = """Turn this behavioral insight into ONE concrete UI suggestion an AI code transformer can act on.

INSIGHT
-------
Category: {insight_type}
Title: {insight_title}
Summary: {insight_summary}
Evidence cited: {insight_evidence}

EVIDENCE
--------
{evidence}

CONSTRAINTS
-----------
1. `evidence` field cites a specific number, percentage, or location from above.
2. `transform_instruction` is a single self-contained sentence that names the element, the change, and any constraint — actionable without further context.
3. `confidence` = how sure the pattern is real; `severity` = how harmful if true (orthogonal).
4. `target_region` (optional): normalized [0,1] coords if the screenshot makes it visually obvious.
5. Propose a suggestion that directly addresses the insight. Do not pivot to a tangential fix.

Return your output by calling the `report_suggestion_for_insight` tool exactly once."""


_INSIGHT_TO_SUG_TOOL_DEFINITION = {
    "name": "report_suggestion_for_insight",
    "description": (
        "Report a single concrete UX suggestion that addresses a specific "
        "behavioral insight. Call this tool exactly once."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "suggestion": _TOOL_DEFINITION["input_schema"]["properties"]["suggestions"]["items"],
        },
        "required": ["suggestion"],
    },
}


async def convert_insight_to_suggestion(
    ev: PageEvidence,
    insight: dict,
) -> dict | None:
    """Generate a concrete suggestion that addresses `insight`.

    Used by the per-insight "Propose a fix" wand in the frontend — gives
    users an out when the main generation pass returned an observation
    without a matching actionable change. Returns the new suggestion
    (with freshly minted id) or None on model/transport failure.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    client = anthropic.Anthropic(api_key=api_key)
    prompt_text = _INSIGHT_TO_SUG_USER_PROMPT_TEMPLATE.format(
        evidence=_evidence_to_text(ev),
        insight_type=insight.get("type", ""),
        insight_title=insight.get("title", ""),
        insight_summary=insight.get("summary", ""),
        insight_evidence=insight.get("evidence", ""),
    )
    content: list[dict] = []
    if ev.screenshot_url:
        content.append({"type": "image", "source": {"type": "url", "url": ev.screenshot_url}})
    content.append({"type": "text", "text": prompt_text})

    try:
        import asyncio
        message = await asyncio.to_thread(
            client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=800,
            system=_INSIGHT_TO_SUG_SYSTEM_PROMPT,
            tools=[_INSIGHT_TO_SUG_TOOL_DEFINITION],
            tool_choice={"type": "tool", "name": "report_suggestion_for_insight"},
            messages=[{"role": "user", "content": content}],
        )
    except Exception as exc:  # noqa: BLE001
        if is_anthropic_exception(exc):
            log_and_classify(exc)
        else:
            logger.error("convert_insight_to_suggestion: model call failed: %s", exc, exc_info=True)
        return None

    for block in message.content:
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == "report_suggestion_for_insight":
            payload = block.input or {}
            if isinstance(payload, dict) and isinstance(payload.get("suggestion"), dict):
                new_sug = dict(payload["suggestion"])
                new_sug["id"] = "sug_" + secrets.token_hex(4)
                return new_sug
            break

    logger.warning("convert_insight_to_suggestion: model returned no tool_use block")
    return None
