# Mixed Python + JS/TS Fixture

A repo where Python (FastAPI) is the primary runtime and TypeScript/React is secondary.

## Structure

**Python side (primary):**
- `pyproject.toml` — Python manifest with FastAPI + uvicorn
- `src/mixed_repo/api.py` — FastAPI app (entrypoint candidate)
- `src/mixed_repo/models.py` — Pydantic models

**TypeScript/React side (secondary):**
- `package.json` — JS manifest (secondary)
- `frontend/package.json` — frontend-specific manifest
- `frontend/src/App.tsx` — React entry component
- `frontend/vite.config.ts` — Vite config with API proxy

## Notes

- Both `pyproject.toml` AND `package.json` present → mixed repo detection signal
- Python `api.py` should appear in `key_paths` as entry
- Frontend `App.tsx` should appear as secondary entry
- `frontend/` noise should not dominate ranking
