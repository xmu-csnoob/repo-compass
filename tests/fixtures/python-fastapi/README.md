# Python FastAPI Fixture

A minimal FastAPI service with router-based structure.

## Structure

- `pyproject.toml` — declares `fastapi` and `uvicorn` dependencies
- `app/main.py` — FastAPI app instance with `/` and `/health` routes
- `app/routers/items.py` — REST router with CRUD endpoints
- `app/models/` — Pydantic model definitions
