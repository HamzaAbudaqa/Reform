"""Tests for the repo-detection engine.

Every scenario is a hand-rolled file dict + file_tree pair — no real repos
and no I/O — so they run in a few ms. They cover the behaviour the old
page_discovery regressed on (dynamic routes dropped, src/pages
misclassified, monorepos, router-less SPAs collapsing, etc.) so we
don't re-break them in future refactors.
"""
from __future__ import annotations

import pytest

from app.services.detection import (
    BuildTool,
    RoutingKind,
    detect_framework,
    discover_pages,
)
from app.services.detection.readiness import is_transformable
from app.services.detection.detectors import PageCandidate


def _files(entries: list[tuple[str, str]]) -> list[dict]:
    return [
        {"path": path, "content": content, "size": len(content)}
        for path, content in entries
    ]


def _tree(files: list[dict]) -> list[str]:
    return [f["path"] for f in files]


def _route_map(pages) -> dict[str, str]:
    return {p.path: p.route for p in pages}


# ── Framework detection ────────────────────────────────────────────────

class TestFrameworkDetection:
    def test_detects_nextjs_app_router(self):
        files = _files([
            ("package.json", '{"dependencies": {"next": "14.0.0"}}'),
            ("app/page.tsx", "export default function P(){return <div/>}"),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.build_tool == BuildTool.NEXT
        assert rf.routing == RoutingKind.NEXT_APP

    def test_detects_nextjs_pages_router(self):
        files = _files([
            ("package.json", '{"dependencies": {"next": "13"}}'),
            ("pages/index.tsx", "export default function P(){return <div/>}"),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.build_tool == BuildTool.NEXT
        assert rf.routing == RoutingKind.NEXT_PAGES

    def test_detects_nextjs_hybrid(self):
        """Repos that migrated partially to App Router still have both dirs."""
        files = _files([
            ("package.json", '{"dependencies": {"next": "14"}}'),
            ("app/dashboard/page.tsx", "export default function P(){return <div/>}"),
            ("pages/legacy.tsx", "export default function P(){return <div/>}"),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.routing == RoutingKind.NEXT_HYBRID

    def test_detects_vite(self):
        files = _files([
            ("package.json", '{"devDependencies": {"vite": "5", "react": "18"}}'),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.build_tool == BuildTool.VITE

    def test_detects_cra(self):
        files = _files([
            ("package.json", '{"dependencies": {"react-scripts": "5.0.0"}}'),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.build_tool == BuildTool.CRA

    def test_detects_monorepo_frontend(self):
        """Monorepo with package.json at apps/web/ — root_dir should reflect it."""
        files = _files([
            ("package.json", '{"name": "root", "workspaces": ["apps/*"]}'),
            ("apps/web/package.json", '{"dependencies": {"next": "14"}}'),
            ("apps/web/app/page.tsx", "export default function P(){return <div/>}"),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.build_tool == BuildTool.NEXT
        assert rf.root_dir == "apps/web/"

    def test_parses_tsconfig_path_aliases(self):
        files = _files([
            ("package.json", '{"dependencies": {"next": "14"}}'),
            ("tsconfig.json", '{"compilerOptions": {"paths": {"@/*": ["./src/*"]}}}'),
            ("app/page.tsx", "export default function P(){return <div/>}"),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.ts_path_aliases == {"@/*": "./src/*"}

    def test_tolerates_tsconfig_with_comments(self):
        """tsconfig is JSONC — we must strip comments before json.loads."""
        files = _files([
            ("package.json", '{"dependencies": {"next": "14"}}'),
            ("tsconfig.json", """
                // editor config
                {
                    "compilerOptions": {
                        /* path aliases */
                        "paths": {"@/*": ["./src/*"],}  // trailing comma
                    }
                }
            """),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.ts_path_aliases == {"@/*": "./src/*"}

    def test_no_package_json_infers_from_tree(self):
        """Snippets without package.json still get best-effort detection."""
        files = _files([
            ("app/page.tsx", "export default function P(){return <div/>}"),
            ("app/about/page.tsx", "export default function A(){return <div/>}"),
        ])
        rf = detect_framework(files, _tree(files))
        assert rf.build_tool == BuildTool.NEXT
        assert rf.routing == RoutingKind.NEXT_APP

    def test_unknown_when_no_signals(self):
        files = _files([("README.md", "# hi")])
        rf = detect_framework(files, _tree(files))
        assert rf.build_tool == BuildTool.UNKNOWN


# ── Page discovery: Next.js App Router ─────────────────────────────────

class TestAppRouterDiscovery:
    def _pkg(self) -> tuple[str, str]:
        return ("package.json", '{"dependencies": {"next": "14"}}')

    def test_basic_routes(self):
        files = _files([
            self._pkg(),
            ("app/page.tsx", "export default function P(){return <main>Home</main>}"),
            ("app/about/page.tsx", "export default function A(){return <main>About</main>}"),
            ("app/dashboard/settings/page.tsx", "export default function S(){return <main>S</main>}"),
        ])
        pages, fw, _ = discover_pages(files, _tree(files))
        assert fw == "app_router"
        routes = _route_map(pages)
        assert routes["app/page.tsx"] == "/"
        assert routes["app/about/page.tsx"] == "/about"
        assert routes["app/dashboard/settings/page.tsx"] == "/dashboard/settings"

    def test_dynamic_routes_included_with_sample(self):
        """Old system dropped [id] entirely — we include it with a sample route
        so the renderer can actually navigate somewhere."""
        files = _files([
            self._pkg(),
            ("app/products/[id]/page.tsx", "export default function P(){return <main>P</main>}"),
            ("app/blog/[...slug]/page.tsx", "export default function B(){return <main>B</main>}"),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        routes = _route_map(pages)
        assert "app/products/[id]/page.tsx" in routes
        # Sample route must not contain the [id] template — renderer would 404.
        assert "[" not in routes["app/products/[id]/page.tsx"]
        assert "[" not in routes["app/blog/[...slug]/page.tsx"]

    def test_route_groups_stripped(self):
        files = _files([
            self._pkg(),
            ("app/(marketing)/about/page.tsx", "export default function A(){return <main>A</main>}"),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        assert _route_map(pages)["app/(marketing)/about/page.tsx"] == "/about"


# ── Page discovery: Next.js Pages Router ───────────────────────────────

class TestPagesRouterDiscovery:
    def _pkg(self) -> tuple[str, str]:
        return ("package.json", '{"dependencies": {"next": "13"}}')

    def test_src_pages_valid_for_nextjs(self):
        """Regression: old system hardcoded src/pages/ as SPA-only, breaking
        every Next.js repo using the src/ layout."""
        files = _files([
            self._pkg(),
            ("src/pages/index.tsx", "export default function H(){return <main>H</main>}"),
            ("src/pages/about.tsx", "export default function A(){return <main>A</main>}"),
        ])
        pages, fw, _ = discover_pages(files, _tree(files))
        assert fw == "pages_router"
        assert len(pages) == 2

    def test_excludes_api_and_underscore_files(self):
        files = _files([
            self._pkg(),
            ("pages/index.tsx", "export default function H(){return <main>H</main>}"),
            ("pages/_app.tsx", "export default function App(){return <main>A</main>}"),
            ("pages/_document.tsx", "export default function D(){return <main>D</main>}"),
            ("pages/api/users.ts", "export default function h(){}"),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        assert [p.path for p in pages] == ["pages/index.tsx"]


# ── Page discovery: SPA with client router ─────────────────────────────

class TestSPADiscovery:
    def test_react_router_routes_override_filenames(self):
        """When <Route path="/cards" element={<SeedSelectionPage/>}/> exists,
        the page's route must be /cards, not /SeedSelectionPage."""
        app_tsx = """
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SeedSelectionPage from "./pages/SeedSelectionPage";
export default function App(){
  return <BrowserRouter><Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/cards" element={<SeedSelectionPage/>}/>
  </Routes></BrowserRouter>;
}
"""
        files = _files([
            ("package.json", '{"dependencies": {"react": "18", "react-router-dom": "6"}, "devDependencies": {"vite": "5"}}'),
            ("src/main.tsx", "import ReactDOM from 'react-dom/client'; ReactDOM.createRoot(root).render(<App/>);"),
            ("src/App.tsx", app_tsx),
            ("src/pages/HomePage.tsx", "export default function H(){return <main>H</main>}"),
            ("src/pages/SeedSelectionPage.tsx", "export default function S(){return <main>S</main>}"),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        routes = _route_map(pages)
        assert routes["src/pages/SeedSelectionPage.tsx"] == "/cards"
        assert routes["src/pages/HomePage.tsx"] == "/"

    def test_routerless_spa_collapses_to_home(self):
        """Without a real router, 'pages' are just stacked sections — render
        one page (Home at the entry) not N that all screenshot identically."""
        files = _files([
            ("package.json", '{"dependencies": {"react": "18"}, "devDependencies": {"vite": "5"}}'),
            ("src/App.tsx", "export default function App(){return <main><Home/><Features/></main>}"),
            ("src/pages/Home.tsx", "export default function H(){return <section>H</section>}"),
            ("src/pages/Features.tsx", "export default function F(){return <section>F</section>}"),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        assert len(pages) == 1
        assert pages[0].name == "Home"
        assert pages[0].path == "src/App.tsx"


# ── Fallback ───────────────────────────────────────────────────────────

class TestFallback:
    def test_falls_back_to_app_tsx_when_no_conventional_pages(self):
        files = _files([
            ("package.json", '{"dependencies": {"react": "18"}, "devDependencies": {"vite": "5"}}'),
            ("src/App.tsx", "export default function App(){return <main>App</main>}"),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        assert len(pages) == 1
        assert pages[0].path == "src/App.tsx"

    def test_large_jsx_fallback_when_no_entry(self):
        """No App.tsx, no main.tsx — still surface something transformable."""
        big_layout = "<main>" + "x" * 3000 + "<section>a</section><header>h</header></main>"
        files = _files([
            ("package.json", '{"dependencies": {"react": "18"}}'),
            ("src/Landing.tsx", f"export default function L(){{return ({big_layout})}}"),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        assert len(pages) >= 1
        assert any("Landing" in p.path for p in pages)

    def test_never_returns_empty_when_react_exists(self):
        """The old system's ValueError('No pages detected') was a cliff. We
        want to always surface something when there's any JSX at all."""
        files = _files([
            ("package.json", '{"dependencies": {"react": "18"}}'),
            ("src/App.tsx", "export default function App(){return <main>" + "x"*2500 + "<section>a</section><header>h</header></main>}"),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        assert len(pages) >= 1


# ── Readiness filter ───────────────────────────────────────────────────

class TestReadiness:
    def _cand(self, path: str) -> PageCandidate:
        return PageCandidate(name="X", path=path, route="/", framework="spa")

    def test_rejects_hooks(self):
        keep, _ = is_transformable(self._cand("src/hooks/useTheme.tsx"), {})
        assert keep is False

    def test_rejects_utils(self):
        keep, _ = is_transformable(self._cand("src/utils/helpers.tsx"), {})
        assert keep is False

    def test_rejects_files_in_lib_dir(self):
        keep, _ = is_transformable(self._cand("src/lib/api.tsx"), {})
        assert keep is False

    def test_accepts_page_suffix_even_in_weird_dir(self):
        """DashboardPage.tsx in /lib/ is unusual but still a page."""
        keep, _ = is_transformable(self._cand("src/lib/DashboardPage.tsx"), {"src/lib/DashboardPage.tsx": "<main>x</main>"})
        assert keep is True

    def test_rejects_no_jsx(self):
        """A .tsx file with only type exports is not a page."""
        keep, reason = is_transformable(
            self._cand("src/pages/Dashboard.tsx"),
            {"src/pages/Dashboard.tsx": "export const FOO = 1; export type T = number;"},
        )
        assert keep is False
        assert "JSX" in reason

    def test_rejects_type_declarations(self):
        keep, _ = is_transformable(self._cand("src/pages/types.d.ts"), {})
        assert keep is False


# ── Backward compatibility ─────────────────────────────────────────────

def test_legacy_import_still_works():
    """Old code imports from page_discovery — don't break it."""
    from app.services.page_discovery import discover_pages as legacy
    from app.services.detection import discover_pages as current
    assert legacy is current
