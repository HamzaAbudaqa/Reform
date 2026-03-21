---
name: testing_setup
description: Complete test suite exists for both backend (pytest) and frontend (vitest+RTL). Backend 99% coverage, frontend 100% statement coverage.
type: project
---

Full test suite was implemented in March 2026.

**Backend:** `backend/tests/` — 243 pytest tests, 99% line coverage
- `conftest.py` — shared fixtures + `VALID_INTELLIGENCE_BODY` factory
- `test_schemas.py` — Pydantic schema validation
- `test_tinyfish_client.py` — all private helpers + extract_site_data
- `test_competitor_analyzer.py` — parallel execution + fallback
- `test_pattern_aggregator.py` — Claude aggregation + fallback
- `test_ui_transformer.py` — deterministic transform pipeline
- `test_routes.py` — FastAPI routes via TestClient

**Frontend:** `__tests__/` — 156 Vitest + RTL tests, 100% statement coverage
- `lib/utils.test.ts`, `lib/mock-data.test.ts`
- `components/UploadPanel.test.tsx`, `BeforeAfterCanvas.test.tsx`
- `components/ControlsPanel.test.tsx`, `DemoWorkspace.test.tsx`
- `components/landing-and-layout.test.tsx` (Navbar, Footer, HeroSection, HowItWorks, FeatureHighlights)

**Why:** coverage gaps, state machine, regression protection, schema contract.

**How to apply:** When modifying any backend service or frontend component, run tests before and after to catch regressions.
