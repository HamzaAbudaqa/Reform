"""Import/dependency resolution for discovered pages.

Given a page file, we want the supporting context (imported components,
hooks, styles) so the Claude transform has the dependencies it actually
needs. This used to live in page_discovery.py; moved here to keep the
detection pipeline self-contained.
"""
from __future__ import annotations

import re

from .framework import RepoFramework
from .routing import DEFAULT_IMPORT_PREFIXES

_IMPORT_RE = re.compile(
    r"""(?:import|from)\s+['"](@/|\.\.?/|~/|@\w[\w/-]*)([^'"]*)['"]"""
)


def resolve_page_imports(
    page_path: str,
    page_content: str,
    files: list[dict],
    rf: RepoFramework,
) -> list[dict]:
    """Return {path, content} for files imported by the given page.

    Handles:
      - Relative imports (./ and ../), resolved against the page's directory.
      - @/ alias (common in shadcn/Next setups).
      - tsconfig path aliases (when present).
      - Common monorepo prefixes (src/, frontend/, etc.) stripped for lookup.

    Bare imports (react, lodash, etc.) and unresolved aliases are skipped
    silently — they're always in node_modules, which we never ingest.
    """
    file_lookup = _build_lookup(files, rf)
    resolved: list[dict] = []
    seen: set[str] = set()

    for match in _IMPORT_RE.finditer(page_content):
        prefix = match.group(1)
        rest = match.group(2)
        full_import = prefix + rest

        candidates = _candidate_paths(full_import, page_path, rf)
        for candidate in candidates:
            for ext in ("", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"):
                full = candidate + ext
                if full in file_lookup and full not in seen:
                    seen.add(full)
                    resolved.append(file_lookup[full])
                    break
            if resolved and resolved[-1]["path"] == file_lookup.get(candidate, {}).get("path"):
                break

    return resolved


def _build_lookup(files: list[dict], rf: RepoFramework) -> dict[str, dict]:
    """Path → file lookup, indexed under every reasonable prefix strip."""
    lookup: dict[str, dict] = {}
    prefixes = list(DEFAULT_IMPORT_PREFIXES)
    if rf.root_dir:
        prefixes.insert(0, rf.root_dir)
    for target in rf.ts_path_aliases.values():
        clean = target.replace("./", "").rstrip("/*").rstrip("/")
        if clean and clean + "/" not in prefixes:
            prefixes.append(clean + "/")

    for f in files:
        path = f.get("path") or ""
        lookup[path] = f
        for pref in prefixes:
            if path.startswith(pref):
                lookup[path[len(pref):]] = f
    return lookup


def _candidate_paths(
    import_path: str,
    page_path: str,
    rf: RepoFramework,
) -> list[str]:
    """Return possible repo-relative prefixes (no extension) to try.

    Multiple prefixes exist because an import like `components/Button` can
    resolve to `src/components/Button` or `frontend/src/components/Button`
    depending on baseUrl.
    """
    # tsconfig aliases — longest-prefix first, then alphabetic tiebreak.
    for alias, target in sorted(rf.ts_path_aliases.items(), key=lambda x: (-len(x[0]), x[0])):
        alias_prefix = alias.rstrip("/*").rstrip("/")
        if alias_prefix and import_path.startswith(alias_prefix):
            remainder = import_path[len(alias_prefix):].lstrip("/")
            target_prefix = target.replace("./", "").rstrip("/*").rstrip("/")
            return [f"{target_prefix}/{remainder}" if remainder else target_prefix]

    if import_path.startswith("@/"):
        return [import_path[2:]]

    if import_path.startswith("./") or import_path.startswith("../"):
        page_dir = "/".join(page_path.split("/")[:-1])
        parts = (page_dir + "/" + import_path).split("/") if page_dir else import_path.split("/")
        normalized: list[str] = []
        for p in parts:
            if p == "..":
                if normalized:
                    normalized.pop()
            elif p and p != ".":
                normalized.append(p)
        return ["/".join(normalized)]

    # Bare module import (react, lodash) — unresolvable in our ingested set.
    return []
