import logging
import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes.analyze_competitors import router as competitors_router
from app.routes.discover_competitors import router as discovery_router
from app.routes.transform_ui import router as transform_router
from app.routes.repo_pages import router as repo_pages_router
from app.routes.analyze_page import router as analyze_page_router
from app.routes.suggest_edit import router as suggest_router
from app.routes.voice import router as voice_router
from app.routes.voice_chat import router as voice_chat_router
from app.routes.transcribe import router as transcribe_router
from app.routes.code_pipeline import router as code_pipeline_router
from app.routes.pipeline_v2 import router as pipeline_v2_router
from app.routes.re_render import router as re_render_router
from app.routes.github_publish import router as github_publish_router
from app.routes.projects import router as projects_router
from app.routes.ux_lab import router as ux_lab_router
from app.routes.billing import router as billing_router
from app.routes.webhook import router as webhook_router
from app.routes.edit_lab import router as edit_lab_router
from app.routes.analytics import router as analytics_router
from app.routes.stitch import router as stitch_router
from app.routes.heatmap import router as heatmap_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# Suppress noisy uvicorn access-log lines that provide no diagnostic value
# but eat Railway's 500 logs/sec budget (heartbeats, CORS preflight).
class _QuietAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "/analytics/heartbeat" in msg:
            return False
        if "OPTIONS " in msg:
            return False
        return True

logging.getLogger("uvicorn.access").addFilter(_QuietAccessFilter())

_logger = logging.getLogger(__name__)

# ── Startup env validation ─────────────────────────────────────────────
_REQUIRED_ENV = {
    "DATABASE_URL": "Database will not be available",
    "STRIPE_SECRET_KEY": "Billing and checkout will not work",
    "STRIPE_WEBHOOK_SECRET": "Stripe webhooks will be rejected",
    "STRIPE_PRO_PRICE_ID": "Pro plan mapping will be missing",
    "STRIPE_MAX_PRICE_ID": "Max plan mapping will be missing",
    "ANTHROPIC_API_KEY": "AI analysis will not work",
    "FRONTEND_URL": "Stripe redirects will fall back to localhost",
}
for _var, _msg in _REQUIRED_ENV.items():
    if not os.environ.get(_var):
        _logger.warning("Missing env var %s — %s", _var, _msg)

app = FastAPI(
    title="Reform Analysis Service",
    description="AI-powered UI/UX analysis and refactoring for Reform",
    version="1.0.0",
)


@app.on_event("startup")
async def startup():
    from app.db import create_tables
    await create_tables()
    _logger.info("Database tables created/verified")

# CORS: allow origins from env or sensible defaults
_default_origins = (
    "http://localhost:3000,"
    "https://refineui-chi.vercel.app,"
    "https://uireform.com,"
    "https://www.uireform.com"
)
_allowed_origins = os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",")
if not os.environ.get("ALLOWED_ORIGINS"):
    _logger.warning("ALLOWED_ORIGINS not set — defaulting to localhost only. Set this in production.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    # Dashboard auth uses NextAuth tokens passed in request bodies/headers,
    # not cookies — `credentials: 'include'` is never used anywhere in the
    # frontend. Keeping this `True` would make Starlette inject
    # `Access-Control-Allow-Credentials: true` into every response, and on
    # the public tracker endpoints (which legitimately send Allow-Origin: *)
    # that combination is invalid per CORS spec — browsers reject the POST
    # even though the preflight succeeded. Setting False eliminates the
    # conflict at the source.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The heatmap tracker endpoints (`/api/heatmap/collect`, `/api/heatmap/h.js`)
# are loaded by every customer site. They MUST be reachable from any origin,
# so we wrap the CORSMiddleware with a path-aware bypass that forces a
# permissive CORS policy on those two paths only. Without this, the global
# allowlist 400s every preflight from a site we haven't manually added.
# Added AFTER CORSMiddleware so it sits outermost in the stack.
from app.middleware import PublicHeatmapCORSBypass  # noqa: E402
app.add_middleware(PublicHeatmapCORSBypass)
_logger.info("Public heatmap CORS bypass active for %s", PublicHeatmapCORSBypass.PUBLIC_PATHS)

# Starlette's CORSMiddleware doesn't inject headers on unhandled exceptions
# (the 500 response is generated by the error handler which runs before CORS).
# This global handler catches those cases so the browser gets a readable error
# instead of a CORS "Failed to fetch" with no detail.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in [o.strip() for o in _allowed_origins]:
        headers["Access-Control-Allow-Origin"] = origin
        # Match the global CORSMiddleware setting — credentials are not used
        # in this app, and `true` here would re-introduce the same conflict
        # the global config was just fixed to avoid.
        headers["Access-Control-Allow-Credentials"] = "false"
    _logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers=headers,
    )

app.include_router(competitors_router)
app.include_router(discovery_router)
app.include_router(transform_router)
app.include_router(repo_pages_router)
app.include_router(analyze_page_router)
app.include_router(suggest_router)
app.include_router(voice_router)
app.include_router(voice_chat_router)
app.include_router(transcribe_router)
app.include_router(code_pipeline_router)
app.include_router(pipeline_v2_router)
app.include_router(re_render_router)
app.include_router(github_publish_router)
app.include_router(projects_router)
app.include_router(ux_lab_router)
app.include_router(billing_router)
app.include_router(webhook_router)
app.include_router(edit_lab_router)
app.include_router(analytics_router)
app.include_router(stitch_router)
app.include_router(heatmap_router)


@app.get("/health")
def health():
    return {"status": "ok"}
