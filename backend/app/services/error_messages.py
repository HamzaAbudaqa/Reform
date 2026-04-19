"""Central error humanizer.

The contract: any exception that can bubble up to a user-facing response
goes through `humanize_error()` and comes out as `{message, kind}` where
`message` is a short, non-developer sentence the frontend can show
verbatim. The `kind` is a stable machine-readable category the frontend
can branch on (e.g. show a retry button vs. a sign-in button) without
parsing prose.

Add new mappings here, never sprinkle `try/except: return str(e)` blocks
around the codebase — those leak stack traces into the UI.

Categories used by `kind`:
    auth_failed         credentials missing/invalid (sign-in needed)
    not_found           resource the user is asking about doesn't exist
    rate_limited        too many requests; wait and retry
    payload_too_large   413; user sent something oversized
    bad_request         user input was malformed
    unreachable         we couldn't reach an external service we depend on
    timed_out           an operation took too long
    db_unavailable      database is down or saving failed
    ai_unavailable      Anthropic call failed (also see anthropic_errors)
    github_failed       generic GitHub API failure not classified above
    permission_denied   we don't have access to do that
    unknown             default — generic friendly fallback
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class HumanError:
    message: str
    kind: str
    status: int = 500   # HTTP status the route should respond with


_GENERIC = HumanError(
    "Something went wrong on our end. Please try again — and let us know if it keeps happening.",
    "unknown",
    500,
)


def humanize_error(exc: BaseException) -> HumanError:
    """Map any exception to a user-friendly HumanError.

    Order matters: more specific checks come first. Always returns a
    HumanError — never raises.
    """
    if exc is None:
        return _GENERIC

    # ── HTTP / FastAPI ──────────────────────────────────────────────
    try:
        from fastapi import HTTPException
        from starlette.exceptions import HTTPException as StarletteHTTPException
        if isinstance(exc, (HTTPException, StarletteHTTPException)):
            return _from_http_status(exc.status_code, getattr(exc, "detail", None))
    except Exception:  # noqa: BLE001 — defensive, never block the humanizer
        pass

    # ── Anthropic / AI ──────────────────────────────────────────────
    try:
        from app.services.anthropic_errors import classify_anthropic_error, is_anthropic_exception
        if is_anthropic_exception(exc):
            info = classify_anthropic_error(exc)
            return HumanError(
                info.user_message or "Our AI is having trouble right now. Please try again in a moment.",
                "ai_unavailable",
                503,
            )
    except Exception:  # noqa: BLE001
        pass

    # ── HTTP client transport (httpx) ───────────────────────────────
    try:
        import httpx
        if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout)):
            return HumanError(
                "We couldn't reach a service we depend on. Please try again in a moment.",
                "unreachable",
                503,
            )
        if isinstance(exc, httpx.ReadTimeout) or isinstance(exc, httpx.PoolTimeout):
            return HumanError(
                "That took longer than expected. Please try again.",
                "timed_out",
                504,
            )
        if isinstance(exc, httpx.HTTPStatusError):
            return _from_http_status(exc.response.status_code, str(exc))
        if isinstance(exc, httpx.HTTPError):
            return HumanError(
                "We had trouble talking to one of our services. Please try again.",
                "unreachable",
                502,
            )
    except Exception:  # noqa: BLE001
        pass

    # ── Database (SQLAlchemy / asyncpg) ─────────────────────────────
    try:
        from sqlalchemy.exc import (
            DBAPIError, IntegrityError, OperationalError, SQLAlchemyError,
        )
        if isinstance(exc, IntegrityError):
            return HumanError(
                "That looks like a duplicate. Please refresh and try again.",
                "bad_request",
                409,
            )
        if isinstance(exc, OperationalError):
            return HumanError(
                "We're having trouble saving right now. Please try again in a moment.",
                "db_unavailable",
                503,
            )
        if isinstance(exc, (DBAPIError, SQLAlchemyError)):
            return HumanError(
                "Something didn't save correctly. Please try again.",
                "db_unavailable",
                500,
            )
    except Exception:  # noqa: BLE001
        pass

    # ── Validation (pydantic) ───────────────────────────────────────
    try:
        from pydantic import ValidationError
        if isinstance(exc, ValidationError):
            return HumanError(
                "Some of the information looks off. Please refresh and try again.",
                "bad_request",
                400,
            )
    except Exception:  # noqa: BLE001
        pass

    # ── Playwright (heatmap verify, installer screenshots, etc.) ───
    try:
        from playwright.async_api import Error as PlaywrightError, TimeoutError as PlaywrightTimeout
        if isinstance(exc, PlaywrightTimeout):
            return HumanError(
                "We couldn't load your site in time. Make sure it's publicly reachable, then try again.",
                "timed_out",
                504,
            )
        if isinstance(exc, PlaywrightError):
            return HumanError(
                "We couldn't open your site. Double-check the URL and that the site is live.",
                "unreachable",
                502,
            )
    except Exception:  # noqa: BLE001
        pass

    # ── Built-in friends ────────────────────────────────────────────
    if isinstance(exc, PermissionError):
        return HumanError(
            "You don't have permission to do that. Try signing in again.",
            "permission_denied",
            403,
        )
    if isinstance(exc, FileNotFoundError):
        return HumanError("We couldn't find the file we needed. Please try again.", "not_found", 404)
    if isinstance(exc, TimeoutError):
        return HumanError("That took longer than expected. Please try again.", "timed_out", 504)
    if isinstance(exc, ConnectionError):
        return HumanError(
            "We had a connection problem. Please check your internet and try again.",
            "unreachable",
            503,
        )
    if isinstance(exc, ValueError):
        return HumanError(
            "Some of the information looks off. Please refresh and try again.",
            "bad_request",
            400,
        )

    # Last-resort fallback. Log the full exception so we can fix the
    # missing mapping later — but don't leak the message to the user.
    logger.warning(
        "humanize_error: unmapped exception %s — falling back to generic",
        type(exc).__name__,
    )
    return _GENERIC


def _from_http_status(status: int, detail: Optional[str | object]) -> HumanError:
    """Map an HTTP status (from HTTPException or upstream API) to a friendly
    response. If the detail string is already short and human-friendly,
    we surface it (handlers across the codebase use it for that purpose);
    otherwise we replace it with a generic per-status message.
    """
    detail_str = _short_detail(detail)
    if status == 401:
        return HumanError(
            detail_str or "Please sign in to continue.",
            "auth_failed",
            401,
        )
    if status == 403:
        return HumanError(
            detail_str or "You don't have permission to do that.",
            "permission_denied",
            403,
        )
    if status == 404:
        return HumanError(
            detail_str or "We couldn't find what you were looking for.",
            "not_found",
            404,
        )
    if status == 409:
        return HumanError(
            detail_str or "That looks like a duplicate. Please refresh and try again.",
            "bad_request",
            409,
        )
    if status == 413:
        return HumanError(
            detail_str or "That request was too large. Please try with a smaller payload.",
            "payload_too_large",
            413,
        )
    if status == 422 or status == 400:
        return HumanError(
            detail_str or "Some of the information looks off. Please refresh and try again.",
            "bad_request",
            status,
        )
    if status == 429:
        return HumanError(
            detail_str or "You're moving fast — please wait a moment and try again.",
            "rate_limited",
            429,
        )
    if status == 502 or status == 503 or status == 504:
        return HumanError(
            "We're having trouble reaching one of our services. Please try again in a moment.",
            "unreachable",
            status,
        )
    if 500 <= status < 600:
        return HumanError(
            detail_str or "Something went wrong on our end. Please try again.",
            "unknown",
            status,
        )
    return HumanError(
        detail_str or "Something didn't work as expected. Please try again.",
        "unknown",
        status,
    )


# Anything longer than this is almost certainly a stack trace or noisy
# library message. Drop it and use the per-status default instead.
_DETAIL_CAP = 180


def _short_detail(detail: Optional[str | object]) -> str:
    if detail is None:
        return ""
    text = str(detail).strip()
    if not text:
        return ""
    if len(text) > _DETAIL_CAP:
        return ""
    # Reject obvious dev/stack noise even when short.
    lowered = text.lower()
    noisy = ("traceback", "exception", "raise ", "<class '", "psycopg", "asyncpg",
             "sqlalchemy.exc", "playwright._impl", "httpx._")
    if any(n in lowered for n in noisy):
        return ""
    return text
