"""Tests for scoring, component extraction, and determinism guarantees.

Kept separate from test_detection.py so the core detection semantics stay
readable. Every test is self-contained — hand-rolled file dicts, no I/O.
"""
from __future__ import annotations

import random

import pytest

from app.services.detection import (
    discover_pages,
    extract_components,
    score_page,
)


def _files(entries: list[tuple[str, str]]) -> list[dict]:
    return [
        {"path": path, "content": content, "size": len(content)}
        for path, content in entries
    ]


def _tree(files: list[dict]) -> list[str]:
    return [f["path"] for f in files]


# ── Determinism ─────────────────────────────────────────────────────────

class TestDeterminism:
    """Same input → same output, regardless of order."""

    def _sample_repo(self) -> list[dict]:
        rich = """
import Header from '@/components/Header';
import Card from '@/components/Card';
export default function P(){
  return <main className="container"><Header/><section><Card/><Card/></section></main>;
}
"""
        return _files([
            ("package.json", '{"dependencies": {"next": "14"}}'),
            ("app/page.tsx", "export default function H(){return <main><h1>Home</h1></main>}"),
            ("app/about/page.tsx", "export default function A(){return <main><section>About</section></main>}"),
            ("app/dashboard/page.tsx", rich),
            ("app/settings/page.tsx", "export default function S(){return <main><section>S</section></main>}"),
        ])

    def test_output_stable_across_shuffled_input(self):
        """Shuffling files + file_tree must produce identical pages."""
        files = self._sample_repo()
        tree = _tree(files)

        pages_a, fw_a, _ = discover_pages(files, tree)

        # Shuffle both inputs with multiple seeds; output must match A.
        for seed in (1, 7, 42, 99, 2026):
            rnd = random.Random(seed)
            shuf_files = files.copy()
            rnd.shuffle(shuf_files)
            shuf_tree = tree.copy()
            rnd.shuffle(shuf_tree)
            pages_b, fw_b, _ = discover_pages(shuf_files, shuf_tree)

            assert fw_a == fw_b
            assert len(pages_a) == len(pages_b)
            for a, b in zip(pages_a, pages_b):
                assert a.path == b.path
                assert a.route == b.route
                assert a.quality_score == b.quality_score
                assert a.components == b.components
                assert a.layout_tree == b.layout_tree

    def test_idempotent_across_repeated_calls(self):
        """Calling discover_pages twice on the same input returns equal lists."""
        files = self._sample_repo()
        tree = _tree(files)
        for _ in range(5):
            pages_a, _, _ = discover_pages(files, tree)
            pages_b, _, _ = discover_pages(files, tree)
            assert [p.path for p in pages_a] == [p.path for p in pages_b]
            assert [p.quality_score for p in pages_a] == [p.quality_score for p in pages_b]

    def test_tiebreak_by_path_when_scores_match(self):
        """Two pages with identical content → tied score → path asc wins."""
        # Both pages have the same content, so they score identically.
        body = "export default function P(){return <main><section>x</section></main>}"
        files = _files([
            ("package.json", '{"dependencies": {"next": "14"}}'),
            ("app/z-page/page.tsx", body),
            ("app/a-page/page.tsx", body),
            ("app/m-page/page.tsx", body),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        # Lexicographic path order is the stable tiebreak.
        assert [p.path for p in pages] == [
            "app/a-page/page.tsx",
            "app/m-page/page.tsx",
            "app/z-page/page.tsx",
        ]

    def test_top_n_limits_output(self):
        """top_n returns the top K scored pages; determinism preserved."""
        files = self._sample_repo()
        tree = _tree(files)
        pages, _, _ = discover_pages(files, tree, top_n=2)
        assert len(pages) == 2
        # The rich dashboard should be the top page.
        assert pages[0].path == "app/dashboard/page.tsx"


# ── Scoring ────────────────────────────────────────────────────────────

class TestScoring:
    def test_rich_page_outscores_stub(self):
        rich = """
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Card from '@/components/Card';
import Nav from '@/components/Nav';
export default function Dashboard() {
  return (
    <main className="container mx-auto grid">
      <Header />
      <nav className="flex"><Nav /></nav>
      <section className="flex">
        <Sidebar />
        <article>
          <Card /><Card /><Card /><Card />
        </article>
      </section>
      <footer>f</footer>
    </main>
  );
}
"""
        stub = "export default function E(){return <div>x</div>}"
        rich_score, _ = score_page("app/dashboard/page.tsx", rich)
        stub_score, _ = score_page("app/stub/page.tsx", stub)
        assert rich_score > stub_score
        assert rich_score >= 50
        assert stub_score <= 10

    def test_edge_page_penalized(self):
        body = (
            "export default function P(){return "
            "<main className='container'><section><h1>x</h1></section></main>}"
        )
        normal_score, _ = score_page("app/dashboard/page.tsx", body)
        edge_score, _ = score_page("app/demo-page/page.tsx", body)
        assert edge_score < normal_score

    def test_logic_heavy_penalized(self):
        logic = """
import { useState, useEffect } from 'react';
export default function W() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);
  useEffect(() => { if (a) setB(1); }, [a]);
  function h1(){ return 1; }
  function h2(){ return 2; }
  function h3(){ return 3; }
  return <div>{a}</div>;
}
"""
        score, signals = score_page("app/x/page.tsx", logic)
        assert signals.logic_heavy_penalty < 0
        assert score < 20

    def test_no_jsx_scores_low(self):
        """A 'page' that's all logic + no JSX scores essentially zero."""
        code = "export const x = 1; export const y = 2;"
        score, _ = score_page("app/x/page.tsx", code)
        assert score == 0

    def test_signals_deterministic(self):
        body = """
export default function P() {
  return (
    <main className="container">
      <section><h1>Hi</h1></section>
      <section><h2>Second</h2></section>
    </main>
  );
}
"""
        a, _ = score_page("app/x/page.tsx", body)
        b, _ = score_page("app/x/page.tsx", body)
        assert a == b

    def test_score_bounded_0_to_100(self):
        """No matter how inflated the signals, score clamps to [0, 100]."""
        # An absurdly rich page — every positive signal maxed.
        massive = (
            "import A from '@/a';\n" * 30
            + "export default function P() { return ("
            + "<main className='container mx-auto grid flex max-w-xl wrapper'>"
            + "".join([
                "<section>" + "<A/>" * 20 + "</section>",
                "<header>" + "<A/>" * 20 + "</header>",
                "<nav>" + "<A/>" * 20 + "</nav>",
                "<article>" + "<A/>" * 20 + "</article>",
                "<footer>" + "<A/>" * 20 + "</footer>",
                "<aside>" + "<A/>" * 20 + "</aside>",
            ])
            + "</main>); }"
        )
        score, _ = score_page("app/x/page.tsx", massive)
        assert 0 <= score <= 100


# ── Component extraction ───────────────────────────────────────────────

class TestComponentExtraction:
    def test_extracts_pascal_case_components(self):
        body = """
export default function Page() {
  return (
    <main>
      <Header />
      <Sidebar />
      <Card title="a" />
      <Card title="b" />
    </main>
  );
}
"""
        result = extract_components(body)
        assert result.components_used == ["Card", "Header", "Sidebar"]

    def test_extraction_preserves_hierarchy(self):
        body = """
export default function Page() {
  return (
    <main>
      <header><Nav /></header>
      <section>
        <Card><Title>T</Title></Card>
      </section>
    </main>
  );
}
"""
        result = extract_components(body)
        tree = result.layout_tree
        assert len(tree) == 1
        assert tree[0]["tag"] == "main"
        children_tags = [c["tag"] for c in tree[0]["children"]]
        assert "header" in children_tags
        assert "section" in children_tags

    def test_ignores_fragment_and_react_prefix(self):
        body = "export default function P(){return <><Card/><Fragment>x</Fragment></>;}"
        result = extract_components(body)
        assert "Fragment" not in result.components_used
        assert "Card" in result.components_used

    def test_ignores_jsx_in_strings(self):
        """A string '<Header />' must not be mistaken for a component usage."""
        body = '''
const msg = "Click <Header /> to continue";
export default function P(){ return <main><Sidebar /></main>; }
'''
        result = extract_components(body)
        assert result.components_used == ["Sidebar"]

    def test_ignores_jsx_in_comments(self):
        body = """
// <FakeHeader /> is not real
/* <AlsoFake /> */
export default function P(){ return <main><RealCard /></main>; }
"""
        result = extract_components(body)
        assert result.components_used == ["RealCard"]

    def test_self_closing_and_paired_tags(self):
        body = "export default function P(){ return <main><br/><hr /><Widget /></main>; }"
        result = extract_components(body)
        assert result.components_used == ["Widget"]
        # <br> and <hr> are void elements; they shouldn't appear as parents.
        assert result.layout_tree[0]["tag"] == "main"

    def test_empty_content_returns_empty(self):
        result = extract_components("")
        assert result.components_used == []
        assert result.layout_tree == []

    def test_extraction_deterministic(self):
        body = """
export default function P() {
  return <main><Header /><Sidebar /><Card /></main>;
}
"""
        a = extract_components(body).to_dict()
        b = extract_components(body).to_dict()
        assert a == b


# ── Integration: pages carry scoring + components end-to-end ───────────

class TestIntegration:
    def test_pages_have_score_components_and_tree(self):
        body = """
import Header from '@/components/Header';
export default function Page() {
  return <main><Header /><section>x</section></main>;
}
"""
        files = _files([
            ("package.json", '{"dependencies": {"next": "14"}}'),
            ("app/page.tsx", body),
        ])
        pages, _, _ = discover_pages(files, _tree(files))
        assert len(pages) == 1
        p = pages[0]
        assert p.quality_score > 0
        assert "Header" in p.components
        assert any(n["tag"] == "main" for n in p.layout_tree)
        assert "layout_tags" in p.score_signals

    def test_backward_compat_fields_still_present(self):
        """Old consumers reading name/path/route/framework must keep working."""
        files = _files([
            ("package.json", '{"dependencies": {"next": "14"}}'),
            ("app/page.tsx", "export default function P(){return <main>H</main>}"),
        ])
        pages, fw, _ = discover_pages(files, _tree(files))
        assert fw == "app_router"
        p = pages[0]
        assert p.name == "Home"
        assert p.path == "app/page.tsx"
        assert p.route == "/"
        assert p.framework == "app_router"
