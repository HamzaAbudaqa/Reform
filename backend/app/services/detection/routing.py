"""Client-router route extraction.

Parses react-router / wouter / tanstack-router config in source files to
map component file paths → their real URL routes. Without this, a file at
`src/pages/SeedSelectionPage.tsx` gets filename-derived route
`/SeedSelectionPage` when the real route is `/cards`.
"""
from __future__ import annotations

import re

from .framework import ROUTER_LIBRARIES, ROUTER_USAGE_PATTERNS

# Common prefixes we try stripping to resolve imports against the file list.
# Extended with tsconfig aliases at call time.
DEFAULT_IMPORT_PREFIXES = ("src/", "frontend/", "client/", "app/", "web/")


def extract_route_map(
    files: list[dict],
    root_dir: str = "",
    ts_aliases: dict[str, str] | None = None,
) -> dict[str, str]:
    """Return {file_path: route} for components referenced in <Route> configs.

    Supports:
      - JSX:   <Route path="/cards" element={<SeedSelectionPage />} />
      - JSX:   <Route path="/cards" component={SeedSelectionPage} />
      - Data:  { path: "/cards", element: <SeedSelectionPage /> }
      - Data:  createBrowserRouter([...])

    Anything else (custom routers, lazy loaders wrapped in HOFs, etc.) falls
    through silently and pages keep their filename-derived routes.
    """
    file_lookup = _build_file_lookup(files, root_dir, ts_aliases or {})
    route_map: dict[str, str] = {}

    for f in files:
        content = f.get("content") or ""
        if not content or not _looks_like_router_config(content):
            continue

        router_dir = "/".join(f["path"].split("/")[:-1])
        component_to_file = _resolve_component_imports(
            content, router_dir, file_lookup, ts_aliases or {}
        )

        # <Route> JSX form — element={<Comp ...>} or component={Comp}
        for m in re.finditer(r"<Route\s", content):
            chunk = content[m.start(): m.start() + 600]
            path_m = re.search(r"""path\s*=\s*['"]([^'"]+)['"]""", chunk)
            elem_m = re.search(r"element\s*=\s*\{?\s*<(\w+)", chunk)
            comp_m = re.search(r"component\s*=\s*\{(\w+)\}", chunk)
            if not path_m:
                continue
            route_path = path_m.group(1)
            if route_path == "*":
                continue
            comp_name = (
                (elem_m.group(1) if elem_m else None)
                or (comp_m.group(1) if comp_m else None)
            )
            if comp_name and comp_name in component_to_file:
                route_map[component_to_file[comp_name]] = route_path

        # Data-router form: { path: "/x", element: <Comp /> }
        for m in re.finditer(
            r"""path\s*:\s*['"]([^'"]+)['"]\s*,[\s\S]*?element\s*:\s*<(\w+)""",
            content,
        ):
            route_path, comp_name = m.group(1), m.group(2)
            if route_path != "*" and comp_name in component_to_file:
                route_map[component_to_file[comp_name]] = route_path

        # Data-router form: { path: "/x", Component: Comp }
        for m in re.finditer(
            r"""path\s*:\s*['"]([^'"]+)['"]\s*,[\s\S]*?Component\s*:\s*(\w+)""",
            content,
        ):
            route_path, comp_name = m.group(1), m.group(2)
            if route_path != "*" and comp_name in component_to_file:
                route_map[component_to_file[comp_name]] = route_path

    return route_map


def _looks_like_router_config(content: str) -> bool:
    """Cheap pre-filter so we don't run expensive regex on every file."""
    has_import = any(lib in content for lib in ROUTER_LIBRARIES)
    has_usage = any(pat in content for pat in ROUTER_USAGE_PATTERNS) or "path:" in content
    return has_import and has_usage


def _build_file_lookup(
    files: list[dict],
    root_dir: str,
    ts_aliases: dict[str, str],
) -> dict[str, dict]:
    """Build a normalized path→file lookup with common prefixes stripped.

    Importers rarely write `src/components/Foo`; they write `components/Foo`
    (with `baseUrl: src`) or `@/components/Foo` (with path alias). We index
    each file under its original path AND every stripped/aliased form so
    lookups with either style succeed.
    """
    lookup: dict[str, dict] = {}
    prefixes = list(DEFAULT_IMPORT_PREFIXES)
    if root_dir:
        prefixes.insert(0, root_dir)

    # Also strip alias targets — e.g. alias "@/*": "./src/*" means we should
    # treat "src/" as an alias-stripped prefix.
    for target in ts_aliases.values():
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


def _resolve_component_imports(
    content: str,
    source_dir: str,
    file_lookup: dict[str, dict],
    ts_aliases: dict[str, str],
) -> dict[str, str]:
    """Return {ComponentName: file_path} for imports in `content`.

    Handles default + named imports, lazy imports, and alias paths. Relative
    paths resolve against `source_dir`; alias paths resolve via ts_aliases.
    """
    component_to_file: dict[str, str] = {}

    patterns = (
        # import Default from './path'
        re.compile(r"""import\s+(\w+)\s+from\s+['"]([^'"]+)['"]"""),
        # const Default = lazy(() => import('./path'))
        re.compile(
            r"""const\s+(\w+)\s*=\s*(?:React\.)?lazy\(\s*\(?\)?\s*=>\s*import\(\s*['"]([^'"]+)['"]"""
        ),
    )
    for pat in patterns:
        for m in pat.finditer(content):
            comp_name, import_path = m.group(1), m.group(2)
            resolved = _resolve_import_path(import_path, source_dir, ts_aliases)
            if resolved is None:
                continue
            for ext in ("", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"):
                full = resolved + ext
                if full in file_lookup:
                    component_to_file[comp_name] = file_lookup[full]["path"]
                    break

    return component_to_file


def _resolve_import_path(
    import_path: str,
    source_dir: str,
    ts_aliases: dict[str, str],
) -> str | None:
    """Convert an import string to a repo-relative path prefix (no extension)."""
    # Alias imports: longest-prefix first; secondary sort by alias name so
    # ties resolve deterministically when two aliases share length.
    for alias, target in sorted(ts_aliases.items(), key=lambda x: (-len(x[0]), x[0])):
        alias_prefix = alias.rstrip("/*").rstrip("/")
        if alias_prefix and import_path.startswith(alias_prefix):
            remainder = import_path[len(alias_prefix):].lstrip("/")
            target_prefix = target.replace("./", "").rstrip("/*").rstrip("/")
            return f"{target_prefix}/{remainder}" if remainder else target_prefix

    # Built-in @/ alias (common in Next.js, shadcn setups).
    if import_path.startswith("@/"):
        return import_path[2:]

    # Relative imports.
    if import_path.startswith("./") or import_path.startswith("../"):
        parts = (source_dir + "/" + import_path).split("/") if source_dir else import_path.split("/")
        normalized: list[str] = []
        for p in parts:
            if p == "..":
                if normalized:
                    normalized.pop()
            elif p and p != ".":
                normalized.append(p)
        return "/".join(normalized)

    return None
