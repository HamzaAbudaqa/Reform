"""Page discovery orchestrator — the public entry point.

Pipeline:
  1. Canonicalize input order (deterministic guarantee).
  2. Detect repo framework.
  3. Pick and run detectors.
  4. Merge + dedup candidates by file path and route.
  5. Patch SPA routes from client-router config.
  6. Collapse router-less SPAs into a single Home page.
  7. Apply readiness filter.
  8. Fall back if still empty.
  9. Score every surviving candidate + extract components.
 10. Stable-sort by (-score, path); optionally truncate to top_n.
 11. Resolve imports for each surviving page.

Returns the same shape as before — `(pages, framework_str, dep_map)` —
so nothing downstream needs to change. The new per-page fields
(quality_score, components, layout_tree) are additive.
"""
from __future__ import annotations

import logging

from app.schemas.pipeline_v2 import DiscoveredPage

from .components import extract_components
from .detectors import PageCandidate, detectors_for
from .fallback import fallback_pages
from .framework import RepoFramework, RoutingKind, detect_framework
from .imports import resolve_page_imports
from .readiness import filter_candidates
from .routing import extract_route_map
from .scoring import score_page, signals_to_dict

logger = logging.getLogger(__name__)


def discover_pages(
    files: list[dict],
    file_tree: list[str],
    *,
    top_n: int | None = None,
) -> tuple[list[DiscoveredPage], str, dict[str, list[dict]]]:
    """Discover pages in an ingested repo.

    Args:
        files: list of {"path", "content", "size"} dicts from ingestion.
        file_tree: list of paths included in ingestion.
        top_n: if set, return only the top-N pages by quality_score after
               sorting. None (default) returns all pages sorted by score.

    Returns (pages, legacy_framework_string, dependency_map). Output is
    deterministic: reordering `files` or `file_tree` on input does not
    change the output list or its order.
    """
    # ── Step 1: canonicalize order ────────────────────────────────────
    # The detectors iterate `file_tree` in order; every sort in downstream
    # code assumes this list is stable. Upstream ingestion already sorts,
    # but we don't trust it — this is the determinism contract.
    files = sorted(files, key=lambda f: f.get("path", ""))
    file_tree = sorted(set(file_tree))

    rf = detect_framework(files, file_tree)
    content_lookup = {f["path"]: f.get("content", "") for f in files}

    candidates = _run_detectors(rf, files, file_tree)
    candidates = _dedup_candidates(candidates)
    candidates = _keep_only_ingested(candidates, content_lookup)

    # For SPAs with a client router, override filename-derived routes with
    # the actual routes from <Route path="..."> definitions.
    if rf.has_client_router:
        _apply_client_router_routes(candidates, files, rf)

    # Router-less SPAs: collapse N matched "pages" into a single Home at the
    # entry file. Those matches are almost always sections stacked inside App.
    if rf.routing == RoutingKind.SPA and not rf.has_client_router and candidates:
        collapsed = _collapse_to_entry(files)
        if collapsed:
            logger.info(
                "Router-less SPA — collapsing %d candidates into Home at %s",
                len(candidates), collapsed.path,
            )
            candidates = [collapsed]

    candidates = filter_candidates(candidates, content_lookup)

    if not candidates:
        logger.info("Primary detection produced zero pages — running fallback")
        fallback = fallback_pages(files)
        # Fallback output hasn't been readiness-checked because its whole
        # purpose is "surface anything" — but do exclude files we didn't
        # actually ingest, or the evaluator will crash on missing content.
        candidates = [c for c in fallback if c.path in content_lookup]

    # Dedup once more in case fallback overlapped with anything above.
    candidates = _dedup_candidates(candidates)

    # ── Step 9: score + extract ───────────────────────────────────────
    scored = [
        _build_discovered_page(c, content_lookup.get(c.path, ""))
        for c in candidates
    ]

    # ── Step 10: stable sort by (-score, path) ────────────────────────
    # Highest score first; lexicographic path as tiebreaker. This guarantees
    # two identical repos produce identical ordering, and a single tie
    # always resolves the same way.
    scored.sort(key=lambda p: (-p.quality_score, p.path))

    if top_n is not None and top_n >= 0:
        scored = scored[:top_n]

    dependency_map = {
        p.path: resolve_page_imports(p.path, content_lookup.get(p.path, ""), files, rf)
        for p in scored
    }

    legacy_framework = _legacy_framework_for_pipeline(rf, scored)
    logger.info(
        "Discovered %d page(s) (framework=%s, build=%s, routing=%s)",
        len(scored), legacy_framework, rf.build_tool.value, rf.routing.value,
    )
    if scored:
        logger.debug(
            "Top pages: %s",
            [(p.path, p.quality_score) for p in scored[:5]],
        )
    return scored, legacy_framework, dependency_map


# ── Orchestration helpers ──────────────────────────────────────────────

def _run_detectors(
    rf: RepoFramework, files: list[dict], file_tree: list[str]
) -> list[PageCandidate]:
    """Run every detector picked for this framework and concatenate results."""
    out: list[PageCandidate] = []
    for detector in detectors_for(rf):
        try:
            out.extend(detector(rf, files, file_tree))
        except Exception as exc:  # detectors are pure, but be defensive.
            logger.warning("Detector %s failed: %s", detector.__name__, exc)
    return out


def _dedup_candidates(candidates: list[PageCandidate]) -> list[PageCandidate]:
    """Dedup by file path first, then by route. First-seen wins.

    Path-first dedup matters for hybrid Next.js: App Router may claim a
    path before Pages Router tries to re-claim it.
    """
    seen_paths: set[str] = set()
    seen_routes: set[str] = set()
    out: list[PageCandidate] = []
    for c in candidates:
        if c.path in seen_paths:
            continue
        if c.route in seen_routes:
            continue
        seen_paths.add(c.path)
        seen_routes.add(c.route)
        out.append(c)
    return out


def _keep_only_ingested(
    candidates: list[PageCandidate], content_lookup: dict[str, str]
) -> list[PageCandidate]:
    """Drop candidates whose content wasn't ingested — evaluator would fail."""
    kept = [c for c in candidates if c.path in content_lookup]
    missing = len(candidates) - len(kept)
    if missing:
        logger.debug("Dropped %d candidate(s) with no ingested content", missing)
    return kept


def _apply_client_router_routes(
    candidates: list[PageCandidate],
    files: list[dict],
    rf: RepoFramework,
) -> None:
    """Mutate candidates in place to use real router-config routes."""
    route_map = extract_route_map(files, rf.root_dir, rf.ts_path_aliases)
    if not route_map:
        return
    for c in candidates:
        if c.path in route_map:
            real_route = route_map[c.path]
            logger.info("Router override: %s %s → %s", c.path, c.route, real_route)
            c.route = real_route


def _collapse_to_entry(files: list[dict]) -> PageCandidate | None:
    """For router-less SPAs: pick the entry file as the sole Home page."""
    from .fallback import find_entry_page
    return find_entry_page(files)


def _build_discovered_page(c: PageCandidate, content: str) -> DiscoveredPage:
    """Convert a candidate to the public schema, scoring + extracting on the way.

    Dynamic Next.js routes get their sample_route as the nav target so the
    renderer can actually load them; the template survives in `name`.
    """
    route = c.sample_route if (c.is_dynamic and c.sample_route) else c.route
    score, signals = score_page(c.path, content)
    extraction = extract_components(content)

    return DiscoveredPage(
        name=c.name,
        path=c.path,
        route=route,
        framework=c.framework,
        quality_score=score,
        score_signals=signals_to_dict(signals),
        components=extraction.components_used,
        layout_tree=extraction.layout_tree,
    )


def _legacy_framework_for_pipeline(rf: RepoFramework, pages: list[DiscoveredPage]) -> str:
    """Map the rich RepoFramework back to the single string older code expects.

    Pipeline v2 stores this in the response's `framework` field. We keep
    using the per-page routing vocabulary ('app_router' etc.) because the
    frontend has been rendering it, but fall back to the repo-level build
    tool if no pages were found.
    """
    if pages:
        frameworks = {p.framework for p in pages}
        if len(frameworks) == 1:
            return next(iter(frameworks))
        # Hybrid — return the framework of the first page after sorting.
        # Sort is already stable by path, so this is deterministic.
        return pages[0].framework
    return rf.legacy_framework_string
