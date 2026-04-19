"""Heatmap auto-install: inject the Reform tracking script into a user's
repo via a GitHub PR.

Reuses `code_ingestion.ingest_github_repo` to fetch files, `detect_framework`
to pick a safe injection target, and `github_publisher.publish_approved_branch`
+ `open_pull_request` to push a branch and open a PR.

v1 supports:
  • Next.js App Router  → `app/layout.tsx` (or .jsx, also under src/)
  • Vite                → `index.html`
  • Create React App    → `public/index.html`
  • Generic HTML        → any `index.html` in the tree

Anything else (Pages Router, Remix, Astro, unrecognized) falls back to manual
install. Injection uses regex with strict patterns; if the file structure is
unusual enough that we can't safely modify it, we surface
`error_kind="injection_failed"` and let the frontend offer the manual flow.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from app.services.code_ingestion import ingest_github_repo, parse_github_url
from app.services.detection import detect_framework
from app.services.detection.framework import BuildTool, RoutingKind
from app.services.github_publisher import (
    open_pull_request,
    publish_approved_branch,
)

logger = logging.getLogger(__name__)

# Substring guaranteed to appear in any installed Reform tracking tag — used
# to detect "already installed" so re-running the flow is a no-op success.
TRACKER_MARKER = "/api/heatmap/h.js"

_PR_TITLE = "Add Reform tracking"


@dataclass
class InstallResult:
    success: bool
    branch_name: str = ""
    branch_url: str = ""
    pr_url: str = ""
    pr_number: int = 0
    target_file: str = ""
    framework: str = ""
    error: Optional[str] = None
    # Stable machine-readable categories the frontend uses to decide whether
    # to offer manual install vs. retry vs. surface a generic error.
    #   "unsupported_framework" | "no_target" | "injection_failed"
    #   "ingest_failed" | "publish_failed" | "auth_failed" | "no_files"
    #   "already_installed"
    error_kind: Optional[str] = None


# ── Snippet builders ──────────────────────────────────────────────────


def _next_script_jsx(snippet_url: str) -> str:
    """The Next.js <Script> tag we inject into App Router layouts.

    `strategy="afterInteractive"` defers loading until after hydration but
    still runs on every page change without blocking first paint. This is
    the recommended strategy for analytics scripts in next/script.
    """
    return f'        <Script src="{snippet_url}" strategy="afterInteractive" />'


def _html_script_tag(snippet_url: str) -> str:
    """The plain <script> tag we inject into raw HTML files."""
    return f'<script async src="{snippet_url}"></script>'


# ── Framework-specific injectors ──────────────────────────────────────

_HEAD_OPEN_RE = re.compile(r"(<head\b[^>]*>)", re.IGNORECASE)
_BODY_OPEN_RE = re.compile(r"<body\b[^>]*>")
_NEXT_SCRIPT_IMPORT_RE = re.compile(
    r"^import\s+Script\s+from\s+['\"]next/script['\"]\s*;?\s*$",
    re.MULTILINE,
)
# Match a top-level import line. Used to figure out where to slot in the
# `import Script from 'next/script'` line — appended after the LAST import
# so we don't break import-order conventions or any "use client" prelude.
_IMPORT_LINE_RE = re.compile(
    r"^(import\s.+?from\s+['\"][^'\"]+['\"]\s*;?)\s*$",
    re.MULTILINE,
)


def _inject_html(content: str, snippet_url: str) -> Optional[str]:
    """Inject a `<script>` tag right after `<head>`.

    Returns the modified string, or None if there's no `<head>` element to
    inject into (caller will surface this as injection_failed).
    """
    if TRACKER_MARKER in content:
        return content
    m = _HEAD_OPEN_RE.search(content)
    if not m:
        return None
    insert = f"\n    {_html_script_tag(snippet_url)}"
    idx = m.end()
    return content[:idx] + insert + content[idx:]


def _inject_next_layout(content: str, snippet_url: str) -> Optional[str]:
    """Inject `<Script>` into the <body> of a Next.js App Router layout.

    Adds `import Script from 'next/script'` if missing (after the last
    existing import line). Returns None if we can't find a <body> tag to
    inject the Script into.
    """
    if TRACKER_MARKER in content:
        return content

    body_match = _BODY_OPEN_RE.search(content)
    if not body_match:
        return None

    insert = "\n" + _next_script_jsx(snippet_url)
    body_idx = body_match.end()
    new = content[:body_idx] + insert + content[body_idx:]

    if not _NEXT_SCRIPT_IMPORT_RE.search(new):
        last_import = None
        for m in _IMPORT_LINE_RE.finditer(new):
            last_import = m
        if last_import:
            insert_pos = last_import.end()
            new = new[:insert_pos] + "\nimport Script from 'next/script'" + new[insert_pos:]
        else:
            # No imports found at all — prepend at top. Rare for a Next.js
            # layout file but the safest fallback.
            new = "import Script from 'next/script'\n" + new
    return new


# ── Target picker ─────────────────────────────────────────────────────


@dataclass
class _Target:
    path: str
    framework_label: str   # human-readable, surfaced in PR body + UI
    injector: str          # "next_layout" | "html"


def _file_exists(files: list[dict], path: str) -> bool:
    return any(f.get("path") == path for f in files)


def _pick_target(framework, files: list[dict]) -> Optional[_Target]:
    """Decide which file to inject into. Returns None if no safe target."""
    root = framework.root_dir or ""

    # Next.js App Router → app/layout.tsx (try src/app first if present)
    if framework.build_tool == BuildTool.NEXT and framework.routing == RoutingKind.NEXT_APP:
        for ext in ("tsx", "jsx"):
            for prefix in (f"{root}src/app", f"{root}app"):
                candidate = f"{prefix}/layout.{ext}"
                if _file_exists(files, candidate):
                    return _Target(candidate, "Next.js (App Router)", "next_layout")

    # Vite → root index.html
    if framework.build_tool == BuildTool.VITE:
        candidate = f"{root}index.html"
        if _file_exists(files, candidate):
            return _Target(candidate, "Vite", "html")

    # Create React App → public/index.html
    if framework.build_tool == BuildTool.CRA:
        candidate = f"{root}public/index.html"
        if _file_exists(files, candidate):
            return _Target(candidate, "Create React App", "html")

    # Generic fallback — any index.html anywhere reasonable.
    for path in (
        f"{root}index.html",
        f"{root}public/index.html",
        "index.html",
        "public/index.html",
    ):
        if _file_exists(files, path):
            return _Target(path, "HTML site", "html")

    return None


# ── Orchestrator ──────────────────────────────────────────────────────


async def install_tracking_via_github(
    *,
    repo_url: str,
    branch: str,
    access_token: str,
    snippet_url: str,
) -> InstallResult:
    """Add the Reform tracking script to the user's repo and open a PR.

    Steps:
      1. Ingest the repo via GitHub API (no clone)
      2. Detect framework + pick a safe injection target
      3. Modify the target file in memory
      4. Push a new branch with the modified file
      5. Open a PR titled "Add Reform tracking"

    Returns InstallResult with either (success=True + pr_url) or
    (success=False + error + error_kind). The caller maps error_kind to a
    user-facing message + decides whether to offer the manual flow.
    """
    if not repo_url or not access_token:
        return InstallResult(
            success=False,
            error="Missing repo URL or GitHub access token.",
            error_kind="auth_failed",
        )

    try:
        owner, repo = parse_github_url(repo_url)
    except Exception as e:
        return InstallResult(
            success=False, error=f"Invalid repo URL: {e}", error_kind="ingest_failed",
        )

    try:
        ingest = await ingest_github_repo(repo_url, branch=branch, access_token=access_token)
    except Exception as e:
        logger.error("Heatmap install: ingest failed for %s: %s", repo_url, e)
        return InstallResult(
            success=False,
            error=f"Couldn't read your repo from GitHub: {e}",
            error_kind="ingest_failed",
        )

    files = ingest.get("files", [])
    file_tree = ingest.get("file_tree", [])
    # The ingest may have rewritten the branch ("master" fallback). Trust its result.
    actual_branch = ingest.get("branch", branch) or branch

    if not files:
        return InstallResult(
            success=False,
            error="Your repo looks empty — we couldn't find any frontend files.",
            error_kind="no_files",
        )

    framework = detect_framework(files, file_tree)
    target = _pick_target(framework, files)
    if not target:
        return InstallResult(
            success=False,
            framework=framework.legacy_framework_string,
            error=(
                "We couldn't find a safe place to add tracking automatically "
                f"in your {framework.legacy_framework_string} project. "
                "You can install it manually instead — it only takes a minute."
            ),
            error_kind="unsupported_framework",
        )

    target_file = next((f for f in files if f.get("path") == target.path), None)
    if not target_file:
        return InstallResult(
            success=False,
            error=f"We couldn't read {target.path} from your repo.",
            error_kind="ingest_failed",
        )

    current = target_file.get("content", "")

    if TRACKER_MARKER in current:
        # Already installed — surface as a soft success so the UI advances
        # to "waiting for tracking" instead of throwing a confusing error.
        return InstallResult(
            success=True,
            target_file=target.path,
            framework=target.framework_label,
            error_kind="already_installed",
        )

    if target.injector == "next_layout":
        modified = _inject_next_layout(current, snippet_url)
    elif target.injector == "html":
        modified = _inject_html(current, snippet_url)
    else:
        modified = None

    if modified is None or modified == current:
        return InstallResult(
            success=False,
            framework=target.framework_label,
            error=(
                f"We couldn't safely add tracking to {target.path}. "
                "Your file structure may be unusual — please install manually."
            ),
            error_kind="injection_failed",
        )

    try:
        publish = await publish_approved_branch(
            owner=owner,
            repo=repo,
            access_token=access_token,
            approved_files=[{"path": target.path, "content": modified}],
            pages_transformed=[target.path],
            summary_text="install reform tracking",
            base_branch=actual_branch,
            create_new_branch=True,
        )
    except PermissionError as e:
        return InstallResult(
            success=False, error=str(e), error_kind="auth_failed",
        )
    except Exception as e:
        logger.error("Heatmap install: publish failed: %s", e, exc_info=True)
        return InstallResult(
            success=False,
            error=f"We couldn't push the change to GitHub: {e}",
            error_kind="publish_failed",
        )

    branch_name = publish["branch_name"]
    branch_url = publish["branch_url"]

    try:
        pr = await open_pull_request(
            owner=owner,
            repo=repo,
            access_token=access_token,
            head=branch_name,
            base=actual_branch,
            title=_PR_TITLE,
            body=_pr_body(target.path, target.framework_label, snippet_url),
        )
        pr_url = pr["url"]
        pr_number = pr["number"]
    except Exception as e:
        # Branch was pushed successfully, just the PR couldn't open. Fall
        # back to the branch URL so the user can finish via that route.
        logger.warning("Heatmap install: PR open failed, falling back to branch URL: %s", e)
        pr_url = branch_url
        pr_number = 0

    return InstallResult(
        success=True,
        branch_name=branch_name,
        branch_url=branch_url,
        pr_url=pr_url,
        pr_number=pr_number,
        target_file=target.path,
        framework=target.framework_label,
    )


def _pr_body(target_file: str, framework: str, snippet_url: str) -> str:
    return (
        "This PR adds the Reform tracking script to your site so we can show "
        "you visitor heatmaps and behavior insights.\n\n"
        f"**File modified:** `{target_file}` ({framework})\n\n"
        f"**Script source:** `{snippet_url}`\n\n"
        "Reform doesn't track form values, cookies, localStorage, or any "
        "personal data. Events are aggregated into 50×50 heat buckets — raw "
        "events are never stored.\n\n"
        "Once this PR is merged and your site redeploys, tracking will start "
        "automatically.\n\n"
        "_Generated by [Reform](https://reform.app)._"
    )


def auto_install_supported(framework_label: str) -> bool:
    """Quick boolean for the UI to decide whether to surface auto-install.

    The frontend can call /sites/{id}/auto-install regardless — the result
    will tell it. This helper is for pre-flight UI decisions if needed.
    """
    return framework_label in {
        "Next.js (App Router)", "Vite", "Create React App", "HTML site",
    }


def _utc_timestamp() -> str:
    """Used by tests; kept here so the format lives in one place."""
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
