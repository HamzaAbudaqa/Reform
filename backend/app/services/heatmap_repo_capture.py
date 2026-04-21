"""Clone a repo, spin up the user's dev server, and screenshot a path.

Used as a fallback for heatmap screenshot captures when the deployed live
URL returns an error (most often HTTP 404 from SPA-style deployments
where only `/` is a real server route, or deployments where a route was
renamed/removed between tracker-install and today).

This is the same strategy the UI Transformation pipeline uses — and the
reason those screenshots always work even on routes that would 404 if
hit directly on Vercel. The trade-off is wall-clock: one capture takes
60-120s because of npm install + dev-server boot. We pay that cost only
as a fallback; the fast live-URL path still handles the happy case in
~8s.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import tempfile

from app.services.preview_renderer import (
    _clone_repo,
    _detect_framework,
    _find_free_port,
    _find_frontend_root,
    _generate_dummy_env,
    _guess_route,
    _install_deps,
    _kill_server,
    _start_dev_server,
    _wait_for_server,
)
from app.services.screenshot import take_screenshot_b64

logger = logging.getLogger(__name__)


async def capture_path_from_repo(
    repo_clone_url: str,
    branch: str,
    path: str,
    access_token: str = "",
) -> str | None:
    """Capture `path` against a freshly-booted dev server of `repo_clone_url`.

    Returns base64 PNG on success, None on any failure. Failure modes are
    deliberately silent here — the caller is already falling back from a
    failed live capture and doesn't have a better option to suggest; we
    log loudly and let the caller decide how to surface it.

    The clone / install / dev-server boot steps are synchronous subprocess
    calls (from preview_renderer); we wrap each in `asyncio.to_thread` so
    the FastAPI event loop stays responsive while the 60-120s capture runs.
    """
    tmp_dir = tempfile.mkdtemp(prefix="reform_heatmap_repo_")
    proc = None
    try:
        port = _find_free_port()

        await asyncio.to_thread(_clone_repo, repo_clone_url, branch, tmp_dir, access_token)

        frontend_dir = await asyncio.to_thread(_find_frontend_root, tmp_dir)
        await asyncio.to_thread(_install_deps, frontend_dir)
        await asyncio.to_thread(_generate_dummy_env, frontend_dir)

        proc = await asyncio.to_thread(_start_dev_server, frontend_dir, port)
        if not await asyncio.to_thread(_wait_for_server, port):
            logger.error(
                "heatmap repo capture: dev server never came up for %s", repo_clone_url,
            )
            return None

        framework = await asyncio.to_thread(_detect_framework, frontend_dir)
        # Caller passes the route path as seen by the tracker (e.g.
        # `/dashboard`). If it's empty we fall back to the filesystem-
        # based guess — same heuristic the preview renderer uses.
        route = path if path and path.startswith("/") else _guess_route(path or "", framework)
        url = f"http://localhost:{port}{route}"

        logger.info(
            "heatmap repo capture: screenshotting %s (framework=%s)", url, framework,
        )
        return await take_screenshot_b64(url)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "heatmap repo capture failed for %s %s: %s", repo_clone_url, path, exc,
        )
        return None
    finally:
        if proc is not None:
            await asyncio.to_thread(_kill_server, proc)
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass
