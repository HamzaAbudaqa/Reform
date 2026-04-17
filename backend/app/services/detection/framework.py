"""Framework detection — single source of truth.

Reads package.json, tsconfig, config files, and file-tree signals to produce
a RepoFramework describing the build tool, routing conventions, and monorepo
layout. Both the page-discovery pipeline and the preview renderer consume
this, so they cannot drift apart.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class BuildTool(str, Enum):
    """Frontend build tool — what command starts the dev server."""
    NEXT = "next"
    VITE = "vite"
    CRA = "cra"
    REMIX = "remix"
    ASTRO = "astro"
    UNKNOWN = "unknown"


class RoutingKind(str, Enum):
    """How the app maps URLs to components."""
    NEXT_APP = "app_router"
    NEXT_PAGES = "pages_router"
    NEXT_HYBRID = "next_hybrid"
    CLIENT_ROUTER = "client_router"   # react-router-dom, wouter, tanstack
    SPA = "spa"                       # single entry, no client router
    UNKNOWN = "unknown"


# Router libraries we can detect + parse. Kept in a single place so we can
# extend without chasing literals through the codebase.
ROUTER_LIBRARIES = (
    "react-router-dom",
    "react-router",
    "@tanstack/react-router",
    "wouter",
    "@reach/router",
    "navi",
)

# Patterns that signal a router is *used* (not just installed) — covers JSX
# usage and imperative router construction.
ROUTER_USAGE_PATTERNS = (
    "<Route",
    "<Routes",
    "createBrowserRouter",
    "createHashRouter",
    "createMemoryRouter",
    "createRouter",
    "RouterProvider",
    "useRoutes",
)


@dataclass
class RepoFramework:
    """Everything downstream code needs to know about a repo's frontend stack.

    Built once per pipeline run; passed into detectors, fallback, renderer.
    """
    build_tool: BuildTool = BuildTool.UNKNOWN
    routing: RoutingKind = RoutingKind.UNKNOWN
    # The directory (relative to repo root) that holds the actual frontend.
    # "" for root-level apps, "frontend/" for monorepos, etc. Always ends
    # in "/" when non-empty so callers can concatenate directly.
    root_dir: str = ""
    # package.json dependencies (merged deps + devDeps).
    dependencies: dict[str, str] = field(default_factory=dict)
    # tsconfig paths — e.g. {"@/*": "./src/*"}. Used to resolve aliased imports.
    ts_path_aliases: dict[str, str] = field(default_factory=dict)
    # Known router library (first match); None if no client router is used.
    router_library: str | None = None
    # True if we saw router usage patterns in source (not just the dep).
    has_client_router: bool = False
    # Raw package.json (for scripts inspection, etc). Keep it around instead
    # of parsing twice.
    package_json: dict = field(default_factory=dict)

    @property
    def is_nextjs(self) -> bool:
        return self.build_tool == BuildTool.NEXT

    @property
    def legacy_framework_string(self) -> str:
        """Backward-compat string used by older consumers (preview_renderer,
        existing DiscoveredPage.framework field). Maps the richer enum down
        to the short form the rest of the codebase expects."""
        if self.build_tool == BuildTool.NEXT:
            return "next"
        if self.build_tool == BuildTool.VITE:
            return "vite"
        if self.build_tool == BuildTool.CRA:
            return "cra"
        return "unknown"


# ── package.json helpers ───────────────────────────────────────────────

def _find_package_json(files: list[dict]) -> dict | None:
    """Find the most relevant package.json.

    In a monorepo we prefer the one whose folder contains frontend indicators
    (next/vite/react scripts) over the root. Falls back to root package.json.
    """
    candidates: list[tuple[str, dict]] = []
    for f in files:
        path = f.get("path") or ""
        if not path.endswith("package.json"):
            continue
        try:
            data = json.loads(f.get("content") or "{}")
        except (json.JSONDecodeError, ValueError):
            continue
        candidates.append((path, data))

    if not candidates:
        return None

    def rank_key(entry: tuple[str, dict]) -> tuple:
        """Lower tuple wins (standard ascending sort).

        Ranking (most important first):
          1. has_frontend=True before has_frontend=False  → 0 vs 1
          2. shallower path before deeper → depth
          3. lexicographic path → path (deterministic tiebreaker)
        """
        path, data = entry
        deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        scripts = data.get("scripts", {})
        has_frontend = any(
            k in deps for k in ("next", "vite", "react-scripts", "react")
        ) or any(
            s in (scripts.get("dev", "") + scripts.get("start", ""))
            for s in ("next", "vite", "react-scripts")
        )
        depth = path.count("/")
        return (0 if has_frontend else 1, depth, path)

    candidates.sort(key=rank_key)
    best_path, best_data = candidates[0]
    best_data["__path"] = best_path
    return best_data


def _root_dir_for_package(pkg: dict) -> str:
    """Derive the frontend root directory from the package.json path.

    'frontend/package.json' → 'frontend/'
    'package.json'          → ''
    'apps/web/package.json' → 'apps/web/'
    """
    path = pkg.get("__path", "package.json")
    root = path[: -len("package.json")]
    return root


# ── tsconfig helpers ───────────────────────────────────────────────────

def _parse_tsconfig(files: list[dict], root_dir: str) -> dict[str, str]:
    """Extract compilerOptions.paths from tsconfig.json.

    Returns a flat mapping: {"@/*": "./src/*"} etc. We parse leniently —
    tsconfig commonly has comments/trailing commas which break json.loads,
    so we strip them first.
    """
    for candidate in (f"{root_dir}tsconfig.json", "tsconfig.json"):
        match = next((f for f in files if f.get("path") == candidate), None)
        if not match:
            continue
        raw = match.get("content") or ""
        cleaned = _strip_jsonc(raw)
        try:
            data = json.loads(cleaned)
        except (json.JSONDecodeError, ValueError):
            return {}
        paths = (
            data.get("compilerOptions", {}).get("paths")
            or data.get("compilerOptions", {}).get("baseUrl")
            and {}
            or {}
        )
        if isinstance(paths, dict):
            # Normalize: values are lists in tsconfig; pick the first target.
            return {
                alias: (target[0] if isinstance(target, list) and target else str(target))
                for alias, target in paths.items()
            }
    return {}


def _strip_jsonc(raw: str) -> str:
    """Strip // and /* */ comments and trailing commas so tsconfig parses."""
    # Remove block comments first, then line comments.
    no_block = re.sub(r"/\*[\s\S]*?\*/", "", raw)
    no_line = re.sub(r"//[^\n]*", "", no_block)
    # Trailing commas before ] or }.
    return re.sub(r",(\s*[\]}])", r"\1", no_line)


# ── Main detector ──────────────────────────────────────────────────────

def detect_framework(files: list[dict], file_tree: list[str]) -> RepoFramework:
    """Build a RepoFramework from ingested files + file tree.

    Pure function; does no network I/O. Safe to call multiple times, but in
    practice the pipeline calls it exactly once and shares the result.
    """
    pkg = _find_package_json(files)
    if pkg is None:
        # No package.json at all — we can still try to infer from file tree.
        return _infer_from_tree(file_tree, files)

    deps = {
        **(pkg.get("dependencies") or {}),
        **(pkg.get("devDependencies") or {}),
    }
    scripts = pkg.get("scripts") or {}
    root_dir = _root_dir_for_package(pkg)
    ts_aliases = _parse_tsconfig(files, root_dir)

    build_tool = _detect_build_tool(deps, scripts, file_tree, root_dir)
    router_lib = next((lib for lib in ROUTER_LIBRARIES if lib in deps), None)
    has_client_router_use = _scan_for_router_usage(files)
    routing = _infer_routing(build_tool, file_tree, root_dir, has_client_router_use)

    rf = RepoFramework(
        build_tool=build_tool,
        routing=routing,
        root_dir=root_dir,
        dependencies=deps,
        ts_path_aliases=ts_aliases,
        router_library=router_lib,
        has_client_router=has_client_router_use,
        package_json=pkg,
    )
    logger.info(
        "Detected framework: build=%s routing=%s root=%r router=%s",
        build_tool.value, routing.value, root_dir, router_lib,
    )
    return rf


def detect_build_tool_from_package_json(package_json_path: str) -> BuildTool:
    """Disk-based build-tool detection.

    Used by the preview renderer, which reads a cloned repo from disk and
    doesn't have an ingested file list. Shares the dep/script heuristic with
    the in-memory detector so they cannot drift.
    """
    try:
        with open(package_json_path) as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError, ValueError):
        return BuildTool.UNKNOWN

    deps = {
        **(data.get("dependencies") or {}),
        **(data.get("devDependencies") or {}),
    }
    scripts = data.get("scripts") or {}
    # No file_tree on disk — pass empty and root_dir "" so config-file checks
    # are skipped; dep-based detection is sufficient here.
    return _detect_build_tool(deps, scripts, [], "")


def _detect_build_tool(
    deps: dict[str, str],
    scripts: dict,
    file_tree: list[str],
    root_dir: str,
) -> BuildTool:
    """Infer build tool from dependencies + config files + scripts.

    Priority: explicit config files > dependency presence > script strings.
    """
    has_config = lambda name: any(
        p == f"{root_dir}{name}" or p.endswith(f"/{name}") for p in file_tree
    )

    # Next.js: next dep + (next.config.* OR app/|pages/ structure).
    if "next" in deps or has_config("next.config.js") or has_config("next.config.mjs") or has_config("next.config.ts"):
        return BuildTool.NEXT

    # Remix: @remix-run/* dep.
    if any(d.startswith("@remix-run/") for d in deps):
        return BuildTool.REMIX

    # Astro.
    if "astro" in deps:
        return BuildTool.ASTRO

    # Vite: vite dep OR vite.config.*.
    if "vite" in deps or has_config("vite.config.js") or has_config("vite.config.ts") or has_config("vite.config.mjs"):
        return BuildTool.VITE

    # CRA: react-scripts dep.
    if "react-scripts" in deps:
        return BuildTool.CRA

    # Script-based heuristics (last resort — some repos wrap commands).
    dev_script = (scripts.get("dev") or "") + " " + (scripts.get("start") or "")
    if "next" in dev_script:
        return BuildTool.NEXT
    if "vite" in dev_script:
        return BuildTool.VITE
    if "react-scripts" in dev_script:
        return BuildTool.CRA

    return BuildTool.UNKNOWN


def _infer_routing(
    build_tool: BuildTool,
    file_tree: list[str],
    root_dir: str,
    has_client_router_use: bool,
) -> RoutingKind:
    """Decide routing convention based on build tool + actual structure.

    For Next.js, we check which router directories exist — a repo can have
    both (hybrid), and that affects which detector runs.
    """
    if build_tool == BuildTool.NEXT:
        has_app = _has_next_app_dir(file_tree, root_dir)
        has_pages = _has_next_pages_dir(file_tree, root_dir)
        if has_app and has_pages:
            return RoutingKind.NEXT_HYBRID
        if has_app:
            return RoutingKind.NEXT_APP
        if has_pages:
            return RoutingKind.NEXT_PAGES
        # Next declared but no conventional dirs found — fall through to SPA.

    if has_client_router_use:
        return RoutingKind.CLIENT_ROUTER

    if build_tool in (BuildTool.VITE, BuildTool.CRA):
        return RoutingKind.SPA

    return RoutingKind.UNKNOWN


def _has_next_app_dir(file_tree: list[str], root_dir: str) -> bool:
    """True if a Next.js App Router page exists under root_dir."""
    # Match <root_dir>app/...page.[jt]sx? AND <root_dir>src/app/...page.[jt]sx?
    pattern = re.compile(
        rf"^{re.escape(root_dir)}(?:src/)?app/.*page\.[jt]sx?$"
    )
    return any(pattern.match(p) for p in file_tree)


def _has_next_pages_dir(file_tree: list[str], root_dir: str) -> bool:
    """True if a Next.js Pages Router page exists under root_dir.

    We accept `<root>/pages/` AND `<root>/src/pages/` — both are valid
    Next.js layouts. Disambiguation from CRA/Vite happens via build_tool.
    """
    pattern = re.compile(
        rf"^{re.escape(root_dir)}(?:src/)?pages/(?!api/|_).*\.[jt]sx?$"
    )
    return any(pattern.match(p) for p in file_tree)


def _scan_for_router_usage(files: list[dict]) -> bool:
    """True if any source file actually instantiates a client router.

    Importing react-router-dom but never using it is rare but possible
    (leftover dep); this check avoids false positives.
    """
    for f in files:
        content = f.get("content") or ""
        if not content:
            continue
        for pat in ROUTER_LIBRARIES:
            if pat in content:
                return True
        for pat in ROUTER_USAGE_PATTERNS:
            if pat in content:
                return True
    return False


def _infer_from_tree(file_tree: list[str], files: list[dict]) -> RepoFramework:
    """No package.json — make a best guess from file structure alone.

    Common case: a subdirectory snippet or a repo that excluded package.json
    from ingestion. We still want detectors to have something to work with.
    """
    has_app = any(re.match(r"^(?:[^/]+/)*app/.*page\.[jt]sx?$", p) for p in file_tree)
    has_pages = any(
        re.match(r"^(?:[^/]+/)?pages/.*\.[jt]sx?$", p)
        and "/src/pages/" not in p
        and not p.startswith("src/pages/")
        for p in file_tree
    )
    has_client_router = _scan_for_router_usage(files)

    if has_app or has_pages:
        return RepoFramework(
            build_tool=BuildTool.NEXT,
            routing=(
                RoutingKind.NEXT_HYBRID if has_app and has_pages
                else RoutingKind.NEXT_APP if has_app
                else RoutingKind.NEXT_PAGES
            ),
        )
    if has_client_router:
        return RepoFramework(
            build_tool=BuildTool.UNKNOWN,
            routing=RoutingKind.CLIENT_ROUTER,
            has_client_router=True,
        )
    return RepoFramework()
