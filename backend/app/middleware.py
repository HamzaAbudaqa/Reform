"""Custom ASGI middleware for Reform.

`PublicCORSBypass` exists because Starlette's `CORSMiddleware` is configured
for the dashboard's fixed allowlist, but a handful of endpoints must be
reachable from ANY origin:

  • Heatmap tracker — loaded by every customer site that pastes the snippet.
  • Analytics session endpoints — fired from the dashboard *and* potentially
    embedded flows; they must never 400 on a preflight and must never combine
    `Allow-Origin: *` with `Allow-Credentials: true` (the browser-reject combo).

Without this bypass, the browser preflight for a POST from an origin we
haven't explicitly allowlisted gets a 400 "Disallowed CORS origin" from
CORSMiddleware before the FastAPI router ever runs.

The bypass is the single source of truth for CORS on the paths it owns:
it short-circuits OPTIONS with a fixed permissive response, and rewrites
response headers on non-OPTIONS to force `Allow-Origin: *` +
`Allow-Credentials: false` regardless of what CORSMiddleware did upstream.
"""

from __future__ import annotations

import logging
from typing import Iterable

logger = logging.getLogger(__name__)

# Permissive preflight response for the public endpoints.
_PREFLIGHT_HEADERS: list[tuple[bytes, bytes]] = [
    (b"access-control-allow-origin", b"*"),
    (b"access-control-allow-credentials", b"false"),
    (b"access-control-allow-methods", b"POST, GET, OPTIONS"),
    (b"access-control-allow-headers", b"Content-Type"),
    (b"access-control-max-age", b"86400"),
    (b"vary", b"Origin"),
]

# Headers we always want stripped from upstream responses on public paths,
# because CORSMiddleware (which sits inside us in the stack) may append
# `Allow-Credentials: true` based on the dashboard config and that breaks
# CORS when combined with `Allow-Origin: *`.
_STRIP_HEADERS: set[bytes] = {
    b"access-control-allow-origin",
    b"access-control-allow-credentials",
}


class PublicCORSBypass:
    """Override CORS handling for endpoints that must work from any origin.

    Stack contract: this middleware MUST be added AFTER CORSMiddleware so
    that it sits outside it (Starlette's `add_middleware` prepends to the
    stack — outermost runs first).

    For paths in `PUBLIC_PATHS`:
      • OPTIONS preflight → respond inline with permissive headers and
        return immediately. CORSMiddleware (and the FastAPI router) never
        see the request.
      • Other methods → pass through, then rewrite the response headers
        on the way out: strip CORSMiddleware's Allow-Credentials and any
        echoed Allow-Origin, force `Allow-Origin: *` and
        `Allow-Credentials: false`. Vary: Origin is preserved.

    For all other paths, the request passes through unchanged and
    CORSMiddleware applies its dashboard allowlist policy.
    """

    PUBLIC_PATHS: tuple[str, ...] = (
        # Heatmap tracker — loaded by every customer site.
        "/api/heatmap/collect",
        "/api/heatmap/h.js",
        # Analytics session endpoints — fired by SiteTracker. Treated as
        # public so a stale preflight cache, a CDN edge, or an unexpected
        # origin can never produce the invalid `*` + credentials=true combo
        # that browsers silently reject.
        "/analytics/track-visit",
        "/analytics/heartbeat",
    )

    def __init__(self, app):
        self.app = app

    def _is_public(self, path: str) -> bool:
        # Exact match or path with trailing slash. We don't use startswith
        # because we don't want to accidentally match any future path that
        # starts with these prefixes.
        return path in self.PUBLIC_PATHS or any(
            path == p or path == p + "/" for p in self.PUBLIC_PATHS
        )

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        if not self._is_public(path):
            return await self.app(scope, receive, send)

        method = scope.get("method", "")

        # Preflight short-circuit. Without this, CORSMiddleware returns 400
        # for any origin not in the dashboard allowlist — which is every
        # customer site by definition.
        if method == "OPTIONS":
            await send({
                "type": "http.response.start",
                "status": 204,
                "headers": list(_PREFLIGHT_HEADERS),
            })
            await send({"type": "http.response.body", "body": b""})
            return

        # Non-OPTIONS public request — let it go through the rest of the
        # stack but rewrite the response so we end up with permissive CORS
        # regardless of what CORSMiddleware did.
        async def send_with_public_cors(message):
            if message.get("type") == "http.response.start":
                cleaned: list[tuple[bytes, bytes]] = [
                    (k, v) for k, v in message.get("headers", [])
                    if k.lower() not in _STRIP_HEADERS
                ]
                cleaned.append((b"access-control-allow-origin", b"*"))
                cleaned.append((b"access-control-allow-credentials", b"false"))
                cleaned.append((b"vary", b"Origin"))
                message["headers"] = cleaned
            await send(message)

        await self.app(scope, receive, send_with_public_cors)


def public_paths_for_logging() -> Iterable[str]:
    """Exposed so main.py can log the active bypass list at startup."""
    return PublicCORSBypass.PUBLIC_PATHS

