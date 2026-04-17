"""Transformation-readiness filter.

Detectors are permissive on purpose — better to surface a candidate and
filter it than to miss a page. This module is the filter: it drops files
that are clearly not transformable UI pages (hooks, utilities, types,
context providers, etc.) before they reach the Claude-based transform
pipeline.

The filter is content-aware: a file named `useTheme.tsx` would never be a
page; a file named `Dashboard.tsx` with no JSX isn't either. Both get
dropped. Keep this conservative — false positives waste Claude tokens but
false negatives drop real pages.
"""
from __future__ import annotations

import logging
import re

from .detectors import PageCandidate

logger = logging.getLogger(__name__)


# Filename patterns that are never pages.
_NON_PAGE_NAME_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^use[A-Z]"),                      # hooks: useSomething
    re.compile(r"\.d\.ts$"),                       # type declarations
    re.compile(r"\.stories\.[jt]sx?$"),            # Storybook stories
    re.compile(r"\.test\.[jt]sx?$"),               # tests
    re.compile(r"\.spec\.[jt]sx?$"),               # tests
    re.compile(r"^(?:types|constants|config|utils|helpers)\.[jt]sx?$", re.I),
)

# Directory segments whose contents are rarely pages. A file under any of
# these is filtered *unless* its filename clearly indicates a page.
_NON_PAGE_DIRS: tuple[str, ...] = (
    "/hooks/",
    "/lib/",
    "/utils/",
    "/helpers/",
    "/contexts/",
    "/context/",
    "/providers/",
    "/store/",
    "/stores/",
    "/services/",
    "/api/",
    "/types/",
    "/constants/",
    "/config/",
    "/schemas/",
    "/queries/",
    "/mutations/",
)

# If a candidate's filename ends in one of these, we trust it's a page even
# when living in an otherwise-non-page directory (e.g. a DashboardPage.tsx
# that someone stashed in /lib/ — rare, but don't drop it).
_PAGE_NAME_SUFFIXES = ("Page", "Screen", "View", "Route")


def _matches_non_page_name(path: str) -> bool:
    basename = path.split("/")[-1]
    return any(p.search(basename) for p in _NON_PAGE_NAME_PATTERNS)


def _in_non_page_dir(path: str) -> bool:
    return any(seg in path for seg in _NON_PAGE_DIRS)


def _has_page_suffix(path: str) -> bool:
    stem = re.sub(r"\.[jt]sx?$", "", path.split("/")[-1])
    return any(stem.endswith(suffix) for suffix in _PAGE_NAME_SUFFIXES)


def _has_jsx_content(content: str) -> bool:
    """Detect whether a file actually renders UI.

    Checks for: default export function/component, JSX tags, or React.createElement.
    A file that's all types/interfaces/exports-of-constants returns False.
    """
    if not content:
        return False
    if re.search(r"<[A-Z]\w*", content):        # JSX component tag: <Foo
        return True
    if re.search(r"<[a-z][a-z0-9]*[\s/>]", content):   # JSX HTML tag: <div>, <br/>, <a href
        return True
    if "React.createElement" in content or "createElement(" in content:
        return True
    return False


def is_transformable(
    candidate: PageCandidate,
    content_lookup: dict[str, str],
) -> tuple[bool, str]:
    """Return (keep, reason). False reason explains why it was dropped.

    The reason string is logged for debugging and test assertions.
    """
    path = candidate.path

    # Name-based rejection is strongest — hooks/tests/types never pass.
    if _matches_non_page_name(path):
        return False, "non-page filename pattern"

    # Directory-based rejection, overridden by explicit page-suffix naming.
    if _in_non_page_dir(path) and not _has_page_suffix(path):
        return False, "file lives in a non-page directory"

    # Content-based rejection — file has no JSX = not a page.
    # Only applied if we actually ingested the content (files missing from
    # the lookup are trusted; detector already filtered path-wise).
    content = content_lookup.get(path)
    if content is not None and not _has_jsx_content(content):
        return False, "no JSX content"

    return True, ""


def filter_candidates(
    candidates: list[PageCandidate],
    content_lookup: dict[str, str],
) -> list[PageCandidate]:
    """Drop non-transformable candidates and return the survivors.

    Logs each dropped candidate at DEBUG level so the reason is traceable.
    """
    kept: list[PageCandidate] = []
    dropped: list[tuple[str, str]] = []
    for c in candidates:
        keep, reason = is_transformable(c, content_lookup)
        if keep:
            kept.append(c)
        else:
            dropped.append((c.path, reason))

    if dropped:
        logger.debug(
            "Readiness filter dropped %d candidate(s): %s",
            len(dropped),
            [f"{p} ({r})" for p, r in dropped],
        )
    return kept
