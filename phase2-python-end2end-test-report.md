# Phase 2 Python End-to-End Test Report

Date: `2026-04-23`

## Scope

This report evaluates the current Phase 2 Python slice on the local `main`
branch only. Development worktrees are intentionally excluded from both the
test commands and the recommendation below.

## Verification Run

### Build And Mainline Test Commands

- `npm run build`
- `npx vitest run --exclude '.worktrees/**'`
- `npx vitest run --exclude '.worktrees/**' tests/render/cli.test.ts tests/render/snapshot.test.ts tests/comprehend/python-quality.test.ts tests/freshness/freshness.test.ts tests/contracts/validation.test.ts tests/contracts/compatibility.test.ts`

Observed results on `2026-04-23`:

- build passed
- mainline suite passed: `17` files, `136` tests
- targeted Phase 2 verification passed: `6` files, `61` tests

### Fixture Audit Run

The pipeline was re-run against these fixture repositories:

- JS/TS baseline fixtures:
  - `node-cli`
  - `nextjs-app`
  - `vue-app`
  - `noisy-repo`
- Python fixtures:
  - `python-cli`
  - `python-library`
  - `python-fastapi`
  - `python-flask`
  - `python-django`
  - `noisy-python`
  - `mixed-python-js`

Each fixture produced:

- `context-index.json`
- `repo.map.md`
- `ONBOARDING.md`
- `agent-start.md`
- `index.html`

## What Passed Credibly

### Contracts And Snapshots

- `context-index.json` emits Phase 2 shape on `main`
- `repo.map.md`, `ONBOARDING.md`, and `agent-start.md` snapshots pass in the
  main workspace
- CLI pipeline output writing is verified in tests
- freshness contract validation covers `fresh|stale|degraded|unknown`

### Freshness Runtime

Current `main` behavior is real runtime behavior, not scaffolding only:

- `off` mode reports `unknown`
- first `watch` run reports `degraded`
- repeated `watch` run on an unchanged repo reports `fresh`
- `ci` mode reports `fresh`

Observed example from a repeated `python-fastapi` run:

- first run:
  - status `degraded`
  - reason `No prior freshness state available; performed full rebuild but incremental trust is unproven.`
- second run:
  - status `fresh`
  - reason `No filesystem changes detected; performed full canonical rebuild for trust.`

### Signal Quality That Held Up In The Audit

- `python-fastapi` starts `first_read_path` from `pyproject.toml`
- `python-django` surfaces `manage.py` as an entrypoint and key path
- `mixed-python-js` detects both `python` and `node`
- `node-cli` republishes the skipped-bin warning into canonical output
- noisy Python suppression is covered in tests for virtualenv, cache, build,
  dist, and migration paths
- `agent-start.md` includes `Freshness`, and warning sections are preserved
  under overflow trimming

## Findings

### Resolved During This Pass

- `python-flask` now reports only `flask`, not a mixed `fastapi`/`flask` hint set
- `python-cli` now surfaces `src/python_cli_repo/cli.py` and
  `src/python_cli_repo/__main__.py`
- `python-library` now surfaces `src/python_lib_repo/__init__.py` as the public
  import surface
- `python-fastapi` now surfaces `app/main.py`
- `mixed-python-js` now surfaces `src/mixed_repo/api.py`
- `noisy-python` now defers migration and generated paths instead of promoting
  them into `key_paths`

### Remaining Observations

- Python package fixtures now expose package `__init__.py` files as library
  entry surfaces, which is useful but still conservative
- Django still surfaces `manage.py` as the primary operational entrypoint, which
  is acceptable for this slice

## Fixture Notes

### `python-cli`

- ecosystems: `python`
- framework hints: `python-cli`
- first read path: `pyproject.toml`, `src/python_cli_repo/cli.py`,
  `src/python_cli_repo/__main__.py`
- outcome: credible CLI entry coverage

### `python-library`

- ecosystems: `python`
- first read path: `pyproject.toml`, `src/python_lib_repo/__init__.py`
- outcome: credible library import-surface coverage

### `python-fastapi`

- ecosystems: `python`
- framework hints: `fastapi`
- first read path: `pyproject.toml`, `app/main.py`
- outcome: credible FastAPI service entry coverage

### `python-flask`

- ecosystems: `python`
- framework hints: `flask`
- entrypoint: `app.py`
- outcome: credible Flask service entry coverage

### `python-django`

- ecosystems: `python`
- framework hints: `django`
- entrypoint: `manage.py`
- outcome: credible for this fixture

### `noisy-python`

- ecosystems: `python`
- first read path remains manifest-led
- outcome: suppression behavior looks correct in tests and audit output, with
  migration and generated paths deferred

### `mixed-python-js`

- ecosystems: `node`, `python`
- framework hints: `vite`, `fastapi`
- first read path: `frontend/package.json`, `package.json`, `pyproject.toml`,
  `src/mixed_repo/api.py`
- outcome: credible mixed backend/frontend entry coverage

## Recommendation

Recommendation: `SHIP`

Reason:

- build passes, mainline tests pass, snapshots pass, and freshness runtime is
  implemented on `main`
- the refreshed fixture audit no longer shows the earlier blocking Python
  heuristic failures
- scoped Python repository classes now surface stable entrypoints or package
  import surfaces, and noisy migration/generated paths are deferred correctly
- the Phase 2 implementation on `main` now meets the repository's current ship
  bar for the declared fixture set
