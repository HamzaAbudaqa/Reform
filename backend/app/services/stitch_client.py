"""Google Stitch ingestion client.

Stitch (stitch.withgoogle.com) is Google's AI UI-generation tool. Reform
ingests Stitch share URLs as an additional design-reference source that
feeds the transform pipeline's DesignIntelligence, alongside (or in place
of) competitor patterns from TinyFish.

Flow per URL:
  1. Validate host against the allowlist (default: stitch.withgoogle.com).
  2. Check two-tier cache (memory → S3). Return early on hit.
  3. Playwright → full-page PNG → JPEG compression for Claude.
  4. Claude vision call with structured extraction prompt.
  5. Parse JSON, construct StitchDesign, cache, return.

Designed to mirror the tinyfish_client architecture exactly so callers
can adopt it with the same mental model.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import time
from typing import Optional
from urllib.parse import urlparse

import anthropic

from app.prompts.stitch_extraction_prompt import (
    SYSTEM_PROMPT,
    build_extraction_prompt,
)
from app.schemas.stitch import (
    StitchDesign,
    StitchDesignTokens,
    StitchPatterns,
)
from app.services.anthropic_errors import (
    is_anthropic_exception,
    log_and_classify,
)
from app.services.s3_client import (
    download_stitch_cache,
    upload_screenshot_and_presign,
    upload_stitch_cache,
)

logger = logging.getLogger(__name__)


# ─── Config ─────────────────────────────────────────────────────────────

# Feature kill switch. When false, routes return 503 / skip work cleanly.
# Defaults to enabled so dev setups "just work" once ANTHROPIC_API_KEY is set.
STITCH_ENABLED = os.environ.get("STITCH_ENABLED", "true").lower() in ("1", "true", "yes")

# Hostnames we'll let Playwright visit. Keeps arbitrary URLs from being
# scraped under the Stitch banner. Comma-separated via env; default covers
# stitch.withgoogle.com and the google.com share domain seen in shares.
_DEFAULT_ALLOWLIST = "stitch.withgoogle.com,stitchui.withgoogle.com"
STITCH_URL_ALLOWLIST = tuple(
    host.strip().lower()
    for host in os.environ.get("STITCH_URL_ALLOWLIST", _DEFAULT_ALLOWLIST).split(",")
    if host.strip()
)

# Model used for the vision extraction. Opus 4.7 for quality — a
# single-screen mockup deserves the better visual reasoning; the cost
# delta over Sonnet is marginal at this scale.
STITCH_VISION_MODEL = os.environ.get("STITCH_VISION_MODEL", "claude-opus-4-7")

# Per-URL wall-clock ceiling. Playwright launch + page load + vision call
# should comfortably fit under 2 min; beyond that we give up and return an
# error entry so the batch completes.
_PER_URL_TIMEOUT = float(os.environ.get("STITCH_PER_URL_TIMEOUT", "120"))

# Client-side backpressure to avoid flooding Playwright + Claude when a
# caller passes many URLs. Matches the TinyFish semaphore pattern.
_CONCURRENCY_LIMIT = int(os.environ.get("STITCH_MAX_CONCURRENT", "4"))
_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(_CONCURRENCY_LIMIT)
    return _semaphore


# ─── URL validation ─────────────────────────────────────────────────────

def is_allowed_stitch_url(url: str) -> bool:
    """Return True if the URL's host is on the Stitch allowlist."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    return any(host == allowed or host.endswith("." + allowed) for allowed in STITCH_URL_ALLOWLIST)


# ─── In-memory cache ────────────────────────────────────────────────────
# Tier 1 (fast, per-process). Tier 2 is the S3 helpers in s3_client.
_memory_cache: dict[str, tuple[float, dict]] = {}
_MEMORY_TTL = 86400  # 24h


def _get_cached(url: str) -> Optional[dict]:
    entry = _memory_cache.get(url)
    if entry and (time.time() - entry[0]) < _MEMORY_TTL:
        logger.info("Stitch cache HIT (memory) for %s", url)
        return entry[1]
    s3_entry = download_stitch_cache(url, max_age_days=30)
    if s3_entry:
        logger.info("Stitch cache HIT (s3) for %s", url)
        _memory_cache[url] = (time.time(), s3_entry)
        return s3_entry
    return None


def _set_cache(url: str, data: dict) -> None:
    _memory_cache[url] = (time.time(), data)
    try:
        upload_stitch_cache(url, data)
    except Exception as e:
        logger.warning("Stitch S3 cache write failed for %s: %s", url, e)


def clear_cache() -> None:
    """Drop the in-memory cache. Used in tests."""
    _memory_cache.clear()


# ─── Screenshot + Claude extraction ─────────────────────────────────────

async def _capture_screenshot(url: str) -> bytes:
    """Load the Stitch share URL in a headless browser and return PNG bytes.

    Kept separate from the Claude call so it can be swapped out for a
    different capture strategy (e.g. Stitch iframe inspection) without
    touching extraction logic.
    """
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page(viewport={"width": 1440, "height": 900})
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                raise RuntimeError(f"Stitch page load failed: {e}") from e
            # Stitch renders client-side; give the canvas time to paint.
            await page.wait_for_timeout(3500)
            png_bytes = await page.screenshot(full_page=True, type="png")
            return png_bytes
        finally:
            await browser.close()


def _compress_for_claude(png_bytes: bytes) -> bytes:
    """Inline PNG → JPEG shrink to stay under Claude's vision limits.

    Same heuristics as services/screenshot.py; duplicated here as a tiny
    helper to avoid pulling that module's wider imports into the Stitch
    path. Swap to a shared util later if a third consumer appears.
    """
    import io
    from PIL import Image

    MAX_BYTES = 4 * 1024 * 1024
    MAX_DIM = 7000
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    w, h = img.size
    if w > MAX_DIM or h > MAX_DIM:
        ratio = min(MAX_DIM / w, MAX_DIM / h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    for q in (85, 75, 60, 45):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=q, optimize=True)
        data = buf.getvalue()
        if len(data) <= MAX_BYTES:
            return data
    img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=45, optimize=True)
    return buf.getvalue()


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*\n(.*?)\n\s*```", re.DOTALL)


def _parse_extraction_json(raw: str) -> Optional[dict]:
    """Extract the JSON object from a Claude response, tolerant of fences."""
    text = raw.strip()
    m = _JSON_FENCE_RE.search(text)
    if m:
        text = m.group(1)
    # Trim anything before the first `{` and after the last `}`.
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    candidate = text[start : end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as e:
        logger.warning("Stitch extraction JSON parse failed: %s", e)
        return None


async def _extract_with_claude(jpeg_bytes: bytes, context: str = "") -> dict:
    """Send the screenshot to Claude vision and return the parsed JSON spec.

    Raises on Anthropic errors (caller translates via anthropic_errors).
    Returns an empty dict if Claude's response can't be parsed — the caller
    treats that as a soft failure per URL rather than crashing the batch.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)
    image_b64 = base64.standard_b64encode(jpeg_bytes).decode("utf-8")
    user_prompt = build_extraction_prompt(context=context)

    message = await asyncio.to_thread(
        client.messages.create,
        model=STITCH_VISION_MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": user_prompt},
                ],
            }
        ],
    )
    raw = message.content[0].text if message.content else ""
    parsed = _parse_extraction_json(raw)
    return parsed or {}


# ─── Public API ─────────────────────────────────────────────────────────

async def fetch_stitch_design(
    url: str,
    *,
    label: str = "",
    context: str = "",
    run_id: str = "stitch-ingest",
) -> StitchDesign:
    """Fetch one Stitch URL and return its extracted StitchDesign.

    Never raises for expected failures (bad URL, load timeout, extraction
    parse failure). Those become `StitchDesign(error=...)` so batch
    callers see per-URL status. Anthropic-specific errors are re-raised
    for the caller to classify via anthropic_errors.
    """
    if not STITCH_ENABLED:
        return StitchDesign(url=url, label=label, error="Stitch ingestion is disabled")

    if not is_allowed_stitch_url(url):
        return StitchDesign(
            url=url,
            label=label,
            error=f"URL host is not on the Stitch allowlist ({', '.join(STITCH_URL_ALLOWLIST)})",
        )

    cached = _get_cached(url)
    if cached:
        try:
            return StitchDesign.model_validate({**cached, "cached": True})
        except Exception as e:
            logger.warning("Stitch cached payload failed validation, re-fetching: %s", e)

    sem = _get_semaphore()
    async with sem:
        try:
            png_bytes = await asyncio.wait_for(_capture_screenshot(url), timeout=_PER_URL_TIMEOUT)
        except asyncio.TimeoutError:
            logger.warning("Stitch capture timed out for %s", url)
            return StitchDesign(url=url, label=label, error="Stitch page took too long to load")
        except Exception as e:
            logger.warning("Stitch capture failed for %s: %s", url, e)
            return StitchDesign(url=url, label=label, error=f"Capture failed: {e}")

        # Upload screenshot first so we always have a record even if
        # extraction later fails. Presigned URL lets the frontend render
        # without base64 bloat.
        screenshot_key = ""
        screenshot_url = ""
        try:
            b64 = base64.b64encode(png_bytes).decode("ascii")
            key, presigned = upload_screenshot_and_presign(
                run_id=run_id,
                page_path=urlparse(url).path or "stitch",
                label="stitch",
                b64_data=b64,
            )
            screenshot_key = key or ""
            screenshot_url = presigned or ""
        except Exception as e:
            logger.warning("Stitch screenshot upload failed for %s: %s", url, e)

        try:
            jpeg_bytes = _compress_for_claude(png_bytes)
        except Exception as e:
            logger.warning("Stitch image compress failed for %s: %s", url, e)
            return StitchDesign(
                url=url,
                label=label,
                screenshot_key=screenshot_key,
                screenshot_url=screenshot_url,
                error=f"Image compression failed: {e}",
            )

        try:
            parsed = await asyncio.wait_for(
                _extract_with_claude(jpeg_bytes, context=context),
                timeout=_PER_URL_TIMEOUT,
            )
        except asyncio.TimeoutError:
            return StitchDesign(
                url=url,
                label=label,
                screenshot_key=screenshot_key,
                screenshot_url=screenshot_url,
                error="Vision extraction timed out",
            )
        except Exception as e:
            if is_anthropic_exception(e):
                info = log_and_classify(e)
                return StitchDesign(
                    url=url,
                    label=label,
                    screenshot_key=screenshot_key,
                    screenshot_url=screenshot_url,
                    error=info.user_message,
                )
            logger.error("Stitch extraction failed for %s: %s", url, e, exc_info=True)
            return StitchDesign(
                url=url,
                label=label,
                screenshot_key=screenshot_key,
                screenshot_url=screenshot_url,
                error=f"Extraction failed: {e}",
            )

    # Assemble the typed response. Missing fields become their schema
    # defaults — the pipeline tolerates empty extractions gracefully.
    tokens_raw = parsed.get("design_tokens") or {}
    patterns_raw = parsed.get("patterns") or {}
    design = StitchDesign(
        url=url,
        label=label,
        screenshot_key=screenshot_key,
        screenshot_url=screenshot_url,
        summary=parsed.get("summary", "") or "",
        design_tokens=StitchDesignTokens(
            theme=tokens_raw.get("theme", "") or "",
            palette=tokens_raw.get("palette", {}) or {},
            typography_tone=tokens_raw.get("typography_tone", "") or "",
            spacing_rhythm=tokens_raw.get("spacing_rhythm", "") or "",
            border_radius=tokens_raw.get("border_radius", "") or "",
        ),
        patterns=StitchPatterns(
            layout_patterns=patterns_raw.get("layout_patterns", []) or [],
            cta_hierarchy=patterns_raw.get("cta_hierarchy", "") or "",
            spacing_rhythm=patterns_raw.get("spacing_rhythm", "") or "",
            card_style=patterns_raw.get("card_style", "") or "",
            typography_tone=patterns_raw.get("typography_tone", "") or "",
            component_patterns=patterns_raw.get("component_patterns", []) or [],
        ),
    )

    # Cache only successful (non-empty) extractions.
    if design.summary or design.patterns.layout_patterns or design.design_tokens.palette:
        _set_cache(url, design.model_dump(mode="json"))
    return design


async def fetch_stitch_designs(
    urls: list[str],
    *,
    context: str = "",
    run_id: str = "stitch-ingest",
) -> list[StitchDesign]:
    """Fetch many Stitch URLs in parallel (under the concurrency semaphore)."""
    tasks = [fetch_stitch_design(url, context=context, run_id=run_id) for url in urls]
    return await asyncio.gather(*tasks)


def merge_stitch_designs(designs: list[StitchDesign]) -> tuple[StitchPatterns, StitchDesignTokens]:
    """Combine multiple successful Stitch designs into one pattern + token set.

    Deterministic merge: first-seen wins for scalar fields, dedup-preserving
    for lists. Errored designs are skipped. This is the cheap in-memory
    merge; callers who want Claude-powered synthesis should call the
    separate design-intelligence endpoint.
    """
    merged_patterns = StitchPatterns()
    merged_tokens = StitchDesignTokens()
    seen_layout: set[str] = set()
    seen_components: set[str] = set()

    for d in designs:
        if d.error:
            continue

        # Tokens: first non-empty wins.
        if not merged_tokens.theme and d.design_tokens.theme:
            merged_tokens.theme = d.design_tokens.theme
        if not merged_tokens.typography_tone and d.design_tokens.typography_tone:
            merged_tokens.typography_tone = d.design_tokens.typography_tone
        if not merged_tokens.spacing_rhythm and d.design_tokens.spacing_rhythm:
            merged_tokens.spacing_rhythm = d.design_tokens.spacing_rhythm
        if not merged_tokens.border_radius and d.design_tokens.border_radius:
            merged_tokens.border_radius = d.design_tokens.border_radius
        for k, v in (d.design_tokens.palette or {}).items():
            merged_tokens.palette.setdefault(k, v)

        # Patterns: scalar first-wins, list dedup-preserving.
        if not merged_patterns.cta_hierarchy and d.patterns.cta_hierarchy:
            merged_patterns.cta_hierarchy = d.patterns.cta_hierarchy
        if not merged_patterns.spacing_rhythm and d.patterns.spacing_rhythm:
            merged_patterns.spacing_rhythm = d.patterns.spacing_rhythm
        if not merged_patterns.card_style and d.patterns.card_style:
            merged_patterns.card_style = d.patterns.card_style
        if not merged_patterns.typography_tone and d.patterns.typography_tone:
            merged_patterns.typography_tone = d.patterns.typography_tone
        for p in d.patterns.layout_patterns:
            if p and p not in seen_layout:
                seen_layout.add(p)
                merged_patterns.layout_patterns.append(p)
        for c in d.patterns.component_patterns:
            if c and c not in seen_components:
                seen_components.add(c)
                merged_patterns.component_patterns.append(c)

    return merged_patterns, merged_tokens
