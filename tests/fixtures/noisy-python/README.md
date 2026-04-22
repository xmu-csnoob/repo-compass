# Noisy Python Fixture

A Python repo saturated with noise artifacts to test suppression logic.

## Real Source (should rank high)
- `src/noisy_repo/__init__.py` — package init
- `src/noisy_repo/core.py` — core pipeline logic
- `src/noisy_repo/generated/output.py` — generated code (defer, not exclude)

## Noise to Exclude
- `.venv/` — virtualenv directory
- `__pycache__/` — bytecode cache
- `build/dist/` — build artifacts
- `migrations/` — database migrations (defer_for_now, not source)

## Purpose

Tests that `core.py` appears in `critical_paths` despite surrounding noise,
and that noise directories do NOT appear in ranked output.
