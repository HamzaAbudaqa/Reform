"""Backward-compatible shim.

Page discovery now lives in `app.services.detection`. This module re-exports
the public API so existing imports (`from app.services.page_discovery import
discover_pages`) keep working without changes.

New code should import from `app.services.detection` directly.
"""
from app.services.detection import discover_pages

__all__ = ["discover_pages"]
