# Noisy Python Fixture

A Python repo saturated with artifact noise to test suppression and ranking.

## Real Source (signal)

| File | Purpose |
|------|---------|
| `src/noisy_repo/__init__.py` | package init |
| `src/noisy_repo/core.py` | core pipeline logic |
| `src/noisy_repo/generated/output.py` | generated code (defer_for_now candidate) |
| `tests/test_core.py` | test file |

## Artifact Noise (not signal)

| Path | Type | Scanner Status Today |
|------|------|---------------------|
| `.venv/` | virtualenv | NOT excluded by current defaults |
| `__pycache__/` | bytecode cache | NOT excluded by current defaults |
| `build/dist/` | wheel artifact | classified as `build` role, not excluded |
| `migrations/` | alembic migrations | NOT excluded; defer_for_now candidate |

## Current Scanner Behavior

The Phase 1 scanner default ignore list includes:
`.git/`, `node_modules/`, `.next/`, `.output/`, `dist/`, `coverage/`, `work/`

**NOT currently ignored:** `.venv/`, `__pycache__/`, `build/` (only `dist/` is in the ignore list).

**Expected Phase 2 behavior** (not yet implemented):
- `.venv/` → exclude
- `__pycache__/` → exclude
- `build/` → exclude
- `migrations/` → defer_for_now

## Purpose

This fixture provides the **structural substrate** for Phase 2 noise suppression tests. The artifact files exist to be scanned. Whether they are correctly excluded/deferred is a **product behavior to be verified**, not a fixture guarantee.

## Anti-Noise Test Expectations

When Phase 2 noise suppression is implemented, the following should hold:
- `src/noisy_repo/core.py` appears in `critical_paths`
- `migrations/` appears in `defer_for_now`
- `.venv/`, `__pycache__/`, `build/` do not appear in any ranked output
