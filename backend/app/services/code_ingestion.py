import base64
import logging
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

FRONTEND_EXTENSIONS = {
    ".tsx", ".jsx", ".ts", ".js",
    ".css", ".scss",
    ".json",
    ".mjs", ".cjs",
}

SKIP_PATTERNS = [
    "node_modules/", ".next/", "dist/", "build/", ".git/",
    "__pycache__/", ".cache/", "coverage/", ".turbo/", "public/",
]

PRIORITY_FILES = [
    "package.json", "tailwind.config", "next.config", "tsconfig.json",
    "globals.css", "layout.tsx", "layout.jsx", "page.tsx", "page.jsx",
]

MAX_FILE_SIZE = 100_000
MAX_TOTAL_FILES = 80


def parse_github_url(url: str) -> tuple[str, str]:
    parsed = urlparse(url.strip().rstrip("/"))
    parts = parsed.path.strip("/").split("/")
    if len(parts) < 2:
        raise ValueError(f"Invalid GitHub URL: {url}")
    return parts[0], parts[1].replace(".git", "")


def _should_skip(path: str) -> bool:
    return any(pat in path for pat in SKIP_PATTERNS)


def _is_frontend_file(path: str) -> bool:
    for pf in PRIORITY_FILES:
        if path.endswith(pf) or pf in path:
            return True
    return any(path.endswith(ext) for ext in FRONTEND_EXTENSIONS)


def _is_priority(path: str) -> bool:
    return any(pf in path for pf in PRIORITY_FILES)


async def ingest_github_repo(
    github_url: str,
    branch: str = "main",
    access_token: str | None = None,
) -> dict:
    owner, repo = parse_github_url(github_url)
    repo_name = f"{owner}/{repo}"
    logger.info("Ingesting repo %s (branch: %s)", repo_name, branch)

    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "RefineUI-Bot/1.0",
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        tree_res = await client.get(tree_url, headers=headers)

        if tree_res.status_code == 404:
            tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/master?recursive=1"
            tree_res = await client.get(tree_url, headers=headers)
            if tree_res.status_code == 200:
                branch = "master"

        if tree_res.status_code != 200:
            raise ValueError(f"Failed to fetch repo tree: {tree_res.status_code}")

        all_items = tree_res.json().get("tree", [])

        candidates = []
        for item in all_items:
            if item["type"] != "blob":
                continue
            path = item["path"]
            if _should_skip(path):
                continue
            if not _is_frontend_file(path):
                continue
            size = item.get("size", 0)
            if size > MAX_FILE_SIZE:
                continue
            candidates.append({
                "path": path, "size": size, "sha": item["sha"],
                "priority": _is_priority(path),
            })

        candidates.sort(key=lambda x: (not x["priority"], x["path"]))
        candidates = candidates[:MAX_TOTAL_FILES]
        file_tree = [c["path"] for c in candidates]
        logger.info("Found %d frontend files in %s", len(candidates), repo_name)

        files = []
        for item in candidates:
            try:
                content_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{item['path']}?ref={branch}"
                content_res = await client.get(content_url, headers=headers)
                if content_res.status_code != 200:
                    continue
                content_data = content_res.json()
                raw_content = content_data.get("content", "")
                encoding = content_data.get("encoding", "")
                decoded = base64.b64decode(raw_content).decode("utf-8", errors="replace") if encoding == "base64" and raw_content else raw_content
                files.append({"path": item["path"], "content": decoded, "size": len(decoded)})
            except Exception as e:
                logger.warning("Failed to fetch %s: %s", item["path"], e)

        return {
            "repo_name": repo_name, "branch": branch,
            "files": files, "file_tree": file_tree, "total_files": len(files),
        }
