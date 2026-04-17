"""Repo detection engine.

Public API:
  - discover_pages(files, file_tree, *, top_n=None) → (pages, framework_str, dep_map)
  - detect_framework(files, file_tree) → RepoFramework
  - score_page(path, content) → (score, signals)
  - extract_components(content) → ExtractionResult
  - RepoFramework, BuildTool, RoutingKind (types for downstream consumers)

Everything else is implementation detail. Don't import from submodules
unless you're writing a test or extending a detector — the top-level
imports here are the stable contract.
"""
from .components import ExtractionResult, extract_components
from .discover import discover_pages
from .framework import (
    BuildTool,
    RepoFramework,
    RoutingKind,
    detect_framework,
)
from .scoring import ScoreSignals, score_page

__all__ = [
    "discover_pages",
    "detect_framework",
    "score_page",
    "extract_components",
    "RepoFramework",
    "BuildTool",
    "RoutingKind",
    "ScoreSignals",
    "ExtractionResult",
]
