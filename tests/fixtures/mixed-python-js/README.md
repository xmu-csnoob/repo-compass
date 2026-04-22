# Mixed Python + JS/TS Fixture

A repo where Python (FastAPI) is the primary runtime and TypeScript/React is secondary.

## Structure

**Python side (primary):**
- `pyproject.toml` — Python manifest with FastAPI + uvicorn
- `src/mixed_repo/api.py` — FastAPI app with REST endpoints
- `src/mixed_repo/models.py` — Pydantic models

**TypeScript/React side (secondary):**
- `package.json` — JS manifest at repo root
- `frontend/package.json` — frontend-specific manifest
- `frontend/src/App.tsx` — React entry component (nested under `frontend/`)
- `frontend/vite.config.ts` — Vite config

## Scanner Behavior Notes

**Python detection:** Requires Phase 2 Python support (`1.2` Python manifest detection).
The scanner does not currently detect `.py` files as a language.

**Nested frontend detection limitation:** The Phase 1 scanner looks for React hints at
root-level `src/App.tsx` or `src/main.tsx` plus root `package.json`. The `frontend/`
subdirectory layout means `frontend/src/App.tsx` is **not** detected by the current
scanner — this is a known gap that Phase 2 cross-language ranking should address.

**Mixed repo detection:** Requires Phase 2 support for detecting multiple ecosystems
from concurrent `pyproject.toml` + `package.json` presence.

## What This Fixture Tests

- Structural presence of dual-language layout
- Python `pyproject.toml` as primary manifest signal
- JS `package.json` as secondary manifest signal
- `frontend/src/App.tsx` as a structural entry candidate once nested detection is implemented

## Test Expectations

When Phase 2 is complete, the following should hold:
- `src/mixed_repo/api.py` appears in `key_paths` as `entry` role (Python primary)
- `pyproject.toml` detected as Python ecosystem manifest
- `frontend/src/App.tsx` detected as secondary entry (requires nested frontend support)
- `frontend/` noise does not dominate ranking when Python is primary

**Current scanner status:** Mixed Python+JS detection is NOT yet implemented. This fixture
provides structural substrate for future Phase 2 cross-language ranking work.
