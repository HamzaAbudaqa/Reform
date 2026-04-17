"""Page detectors — one per framework/routing convention.

Each detector is a plain function that takes the detected RepoFramework plus
ingested files/tree and returns a list of PageCandidate. The discover
orchestrator picks which detectors to run based on RepoFramework.routing,
then merges + dedups + filters the output.

Adding a new framework (Svelte, Remix, Vue, etc.) means writing one more
detector and adding it to the registry at the bottom of this file.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable

from .framework import RepoFramework, RoutingKind


@dataclass
class PageCandidate:
    """A page discovered by a detector, pre-readiness-filter.

    Kept distinct from the public DiscoveredPage schema so detectors can
    attach extra signals (is_dynamic, score) without polluting the downstream
    contract.
    """
    name: str
    path: str
    route: str
    framework: str           # legacy string: "app_router" | "pages_router" | "spa"
    is_dynamic: bool = False
    # Optional sample route for dynamic pages — the renderer navigates to
    # this instead of the template (/products/[id] → /products/sample).
    sample_route: str | None = None
    # Detector provenance — useful for logging and test assertions.
    detector: str = ""
    extra: dict = field(default_factory=dict)


Detector = Callable[[RepoFramework, list[dict], list[str]], list[PageCandidate]]


# ── Shared helpers ─────────────────────────────────────────────────────

def _segment_label(seg: str) -> str:
    """Title-case a URL segment, splitting on - and _."""
    return seg.replace("-", " ").replace("_", " ").title()


def _is_dynamic_segment(seg: str) -> bool:
    """True for [id], [...slug], [[...rest]]."""
    return bool(re.fullmatch(r"\[{1,2}\.{0,3}[^\]]+\]{1,2}", seg))


def _is_route_group(seg: str) -> bool:
    """True for Next.js route groups: (marketing)."""
    return bool(re.fullmatch(r"\([^)]+\)", seg))


def _dynamic_placeholder(seg: str) -> str:
    """Convert [id] → 'sample', [...slug] → 'demo', [[...rest]] → 'demo'.

    We never actually know a valid ID, so we pick a universally-safe slug.
    Apps that 404 on bogus IDs will show their 404 page — still a useful
    screenshot for UI evaluation.
    """
    inner = seg.strip("[]").lstrip(".")
    # Prefer specific words for common param names.
    if inner in ("id", "slug", "uuid", "name"):
        return "demo"
    return "sample"


# ── Next.js App Router detector ────────────────────────────────────────

_NEXT_APP_PAGE_RE = re.compile(r"^(?:[^/]+/)*app/.*page\.[jt]sx?$")


def detect_next_app_router(
    rf: RepoFramework, files: list[dict], file_tree: list[str]
) -> list[PageCandidate]:
    """Find all `app/**/page.[jt]sx?` files, including dynamic routes."""
    pages: list[PageCandidate] = []
    for path in file_tree:
        if not _NEXT_APP_PAGE_RE.match(path):
            continue
        candidate = _app_router_candidate(path)
        if candidate:
            pages.append(candidate)
    return pages


def _app_router_candidate(path: str) -> PageCandidate | None:
    """Build a PageCandidate from an App Router page file path."""
    # Strip any prefix up to /app/ and the trailing /page.ext.
    inner = re.sub(r"^(?:[^/]+/)*app/", "", path)
    inner = re.sub(r"/?page\.[jt]sx?$", "", inner)

    if inner == "":
        return PageCandidate(
            name="Home", path=path, route="/",
            framework="app_router", detector="next_app",
        )

    segments = inner.split("/")
    labels: list[str] = []
    route_parts: list[str] = []
    sample_parts: list[str] = []
    is_dynamic = False

    for seg in segments:
        if _is_route_group(seg):
            continue
        if _is_dynamic_segment(seg):
            is_dynamic = True
            labels.append(_segment_label(seg.strip("[]").lstrip(".") or "dynamic"))
            route_parts.append(seg)
            sample_parts.append(_dynamic_placeholder(seg))
        else:
            labels.append(_segment_label(seg))
            route_parts.append(seg)
            sample_parts.append(seg)

    if not labels:
        return PageCandidate(
            name="Home", path=path, route="/",
            framework="app_router", detector="next_app",
        )

    return PageCandidate(
        name=" / ".join(labels),
        path=path,
        route="/" + "/".join(route_parts),
        framework="app_router",
        is_dynamic=is_dynamic,
        sample_route="/" + "/".join(sample_parts) if is_dynamic else None,
        detector="next_app",
    )


# ── Next.js Pages Router detector ──────────────────────────────────────

def detect_next_pages_router(
    rf: RepoFramework, files: list[dict], file_tree: list[str]
) -> list[PageCandidate]:
    """Find `pages/**/*.[jt]sx?` routes, excluding _app, _document, api/."""
    pages: list[PageCandidate] = []
    for path in file_tree:
        if not _is_pages_router_file(path, rf):
            continue
        candidate = _pages_router_candidate(path)
        if candidate:
            pages.append(candidate)
    return pages


def _is_pages_router_file(path: str, rf: RepoFramework) -> bool:
    """Check whether a path is a valid Pages Router page.

    Unlike the old hardcoded check, we accept `src/pages/` when the build
    tool is Next.js (valid layout) and reject it otherwise (CRA/Vite).
    """
    if not re.search(r"\.[jt]sx?$", path):
        return False
    # Allow pages/ at root or one dir deep; allow src/pages/ only for Next.
    if not re.match(r"^(?:[^/]+/)?(?:src/)?pages/.*\.[jt]sx?$", path):
        return False
    if ("src/pages/" in path or path.startswith("src/pages/")) and not rf.is_nextjs:
        return False

    # Strip to inner path for filename checks.
    inner = re.sub(r"^(?:[^/]+/)?(?:src/)?pages/", "", path)
    if inner.startswith("_app") or inner.startswith("_document") or inner.startswith("_error"):
        return False
    if inner.startswith("api/"):
        return False
    # Next.js middleware files.
    if inner in ("middleware.ts", "middleware.js"):
        return False
    return True


def _pages_router_candidate(path: str) -> PageCandidate | None:
    """Build a PageCandidate from a Pages Router file path."""
    inner = re.sub(r"^(?:[^/]+/)?(?:src/)?pages/", "", path)
    inner = re.sub(r"\.[jt]sx?$", "", inner)

    if inner == "index":
        return PageCandidate(
            name="Home", path=path, route="/",
            framework="pages_router", detector="next_pages",
        )

    segments = inner.split("/")
    labels: list[str] = []
    route_parts: list[str] = []
    sample_parts: list[str] = []
    is_dynamic = False

    for seg in segments:
        if seg == "index":
            continue
        if _is_dynamic_segment(seg):
            is_dynamic = True
            labels.append(_segment_label(seg.strip("[]").lstrip(".") or "dynamic"))
            route_parts.append(seg)
            sample_parts.append(_dynamic_placeholder(seg))
        else:
            labels.append(_segment_label(seg))
            route_parts.append(seg)
            sample_parts.append(seg)

    if not labels:
        return PageCandidate(
            name="Home", path=path, route="/",
            framework="pages_router", detector="next_pages",
        )

    return PageCandidate(
        name=" / ".join(labels),
        path=path,
        route="/" + "/".join(route_parts),
        framework="pages_router",
        is_dynamic=is_dynamic,
        sample_route="/" + "/".join(sample_parts) if is_dynamic else None,
        detector="next_pages",
    )


# ── SPA convention detector ────────────────────────────────────────────
# Covers: Vite+React, CRA, generic React SPAs. Uses directory conventions
# (pages/, views/, screens/, routes/) plus PascalCase naming suffixes.

_SPA_PAGE_DIR_RE = re.compile(r"(?:^|/)(?:pages|views|screens|routes)/")
_SPA_PAGE_NAME_RE = re.compile(r"^[A-Z][A-Za-z0-9]*(?:Page|Screen|View|Route)$")

_EXCLUDED_FILENAMES = {
    "App.js", "App.jsx", "App.tsx", "App.ts",
    "main.js", "main.jsx", "main.tsx", "main.ts",
    "index.js", "index.jsx", "index.tsx", "index.ts",
    "setupTests.js", "reportWebVitals.js", "firebase.js", "vite-env.d.ts",
}


def detect_spa_convention(
    rf: RepoFramework, files: list[dict], file_tree: list[str]
) -> list[PageCandidate]:
    """Find page-like files in a client-router SPA.

    Strategy:
      1. Any .[jt]sx? file under pages/|views/|screens/|routes/.
      2. Any PascalCase file ending in Page/Screen/View/Route.
    Entry files (App.*, main.*, index.*) excluded — handled by fallback.
    """
    pages: list[PageCandidate] = []
    for path in file_tree:
        if not _is_spa_page_file(path):
            continue
        candidate = _spa_candidate(path)
        if candidate:
            pages.append(candidate)
    return pages


def _is_spa_page_file(path: str) -> bool:
    if not re.search(r"\.[jt]sx?$", path):
        return False
    basename = path.split("/")[-1]
    if basename in _EXCLUDED_FILENAMES:
        return False
    if basename.startswith("_") or basename.startswith("."):
        return False
    lower = basename.lower()
    if "test" in lower or "spec" in lower or ".stories." in lower or ".d.ts" in lower:
        return False

    if _SPA_PAGE_DIR_RE.search(path):
        return True
    name_no_ext = re.sub(r"\.[jt]sx?$", "", basename)
    return bool(_SPA_PAGE_NAME_RE.match(name_no_ext))


def _spa_candidate(path: str) -> PageCandidate | None:
    """Build a SPA PageCandidate from a file path.

    Route is derived from the filename as a stable unique ID. The real route
    is patched in later by the client-router extractor.
    """
    basename = path.split("/")[-1]
    name = re.sub(r"\.[jt]sx?$", "", basename)
    if name.startswith("[") or name.startswith("_"):
        return None

    # Split PascalCase/camelCase: TemplateForm → Template Form.
    spaced = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name)
    label = _segment_label(spaced)
    route = f"/{name}"
    if name.lower() in ("home", "homepage", "landing", "main"):
        route = "/"

    return PageCandidate(
        name=label, path=path, route=route,
        framework="spa", detector="spa_convention",
    )


# ── Registry ───────────────────────────────────────────────────────────

def detectors_for(rf: RepoFramework) -> list[Detector]:
    """Pick which detectors to run based on the detected routing kind.

    Order matters — first detector to claim a path wins, because the
    orchestrator dedupes by file path.
    """
    if rf.routing == RoutingKind.NEXT_APP:
        return [detect_next_app_router]
    if rf.routing == RoutingKind.NEXT_PAGES:
        return [detect_next_pages_router]
    if rf.routing == RoutingKind.NEXT_HYBRID:
        # App Router takes precedence over Pages Router in Next.js 13+.
        return [detect_next_app_router, detect_next_pages_router]
    if rf.routing == RoutingKind.CLIENT_ROUTER:
        return [detect_spa_convention]
    if rf.routing == RoutingKind.SPA:
        return [detect_spa_convention]
    # UNKNOWN — try everything; fallback kicks in if still empty.
    return [detect_next_app_router, detect_next_pages_router, detect_spa_convention]
