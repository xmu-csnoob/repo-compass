# Phase 3 Release Readiness Report

Date: `2026-04-24`

## Verdict

Recommendation: `SHIP`

Scope of this recommendation:

- ship the current Phase 3 static directory-intent implementation
- treat LLM classification as a future enhancement, not part of Phase 3 release
  scope

Reason:

- the original Phase 3 blocking failure on `fastapi/fastapi` is now resolved
- the suppression path holds on the primary real-repo target and the secondary
  structurally different real-repo target
- the remaining issues are polish and Phase 4 concerns, not Phase 3 release
  blockers

## Candidate Under Review

This report evaluates the current `phase3-codex` worktree state, not `main`.

Current implementation characteristics:

- static directory-intent classification only
- no runtime LLM classification path
- additive Phase 3 contracts preserved

## Verification Summary

### Build

Command:

- `npm run build`

Observed result:

- passed

### Targeted Phase 3 Verification

Command:

- `npx vitest run tests/comprehend/intent-guidance.test.ts tests/comprehend/python-quality.test.ts tests/extract/suppression.test.ts tests/classify/engine.test.ts tests/classify/rules.test.ts tests/classify/boundary.test.ts tests/render/cli.test.ts`

Observed result:

- `7` files
- `122` tests
- all passed

### Real-Repo End-to-End Audit

Primary validation target:

- repo: `fastapi/fastapi`
- local clone: `/tmp/repo-compass-fastapi`
- audited commit: `e54e5a8`
- run id: `run-2026-04-24T00-28-35-961Z`

Regression target:

- repo: `pallets/flask`
- local clone: `/tmp/repo-compass-flask`
- audited commit: `2ac89889`
- run id: `run-2026-04-24T00-22-26-083Z`

## What Passed

### 1. The Primary Phase 3 Blocking Failure Is Fixed

On `fastapi/fastapi`:

- `docs_src/**` entrypoints: `0`
- `tests/**` entrypoints: `0`
- `docs_src/` intent: `example-fixtures`
- `fastapi/` intent: `library-surface`
- false `flask` framework hint is gone

This is the core Phase 3 release gate. The repo no longer floods the user-facing
entrypoint and read-first surfaces with doc examples.

### 2. Startup Guidance Is Back To A Usable State

On `fastapi/fastapi`:

- `agent-start.md` is no longer collapsed to a 5-line shell
- `run` hint now says:
  - `Use python -m fastapi to run the CLI.`
- `safe-edit-zone` now says:
  - `Prefer edits under fastapi before touching config, build, generated, or vendor paths.`

These two guidance fixes close the last user-visible issues from the previous
e2e audit.

### 3. Regression Target Still Behaves Credibly

On `pallets/flask`:

- `examples/**` entrypoints: `0`
- `tests/**` entrypoints: `0`
- `src/**` entrypoints: `7`
- framework hints remain `flask, pytest, python-cli`

This indicates the stronger suppression and library-surface logic did not break
the structurally different real repo.

### 4. Contract Surface Still Supports Future LLM Work

Current code still preserves:

- `DirectoryClassifier` interface
- `DirectoryClassifierMethod = "static" | "llm"`
- `IntentMap` additive contract
- bounded directory depth

So this release does not close off the future LLM-assisted path.

## Canonical Output Assessment

### `fastapi/fastapi`

Observed read-first surface:

- `pyproject.toml`
- `fastapi/cli.py`
- `fastapi/__main__.py`
- `fastapi/applications.py`
- `fastapi/background.py`
- `fastapi/datastructures.py`

Observed guidance:

- `Use python -m fastapi to run the CLI.`
- `Prefer edits under fastapi ...`

Assessment:

- credible for the declared Phase 3 scope
- much closer to a useful library-oriented cold start

### `pallets/flask`

Observed read-first surface still starts with example manifests before the root
manifest:

- `examples/celery/pyproject.toml`
- `examples/celery/requirements.txt`
- `examples/javascript/pyproject.toml`
- `examples/tutorial/pyproject.toml`
- `pyproject.toml`

Assessment:

- not ideal
- but no longer a suppression failure
- does not negate the Phase 3 value claim

## Remaining Risks

These are real, but they are not Phase 3 release blockers.

### 1. Library-Repo Narration Still Needs Polish

Examples:

- `repo_shape` still lands on `mixed` for both `fastapi/fastapi` and
  `pallets/flask`
- several internal package modules are still framed as `server` entrypoints
  because FastAPI/Flask object detection remains structurally local

Impact:

- guidance is usable, but not yet semantically elegant for library-first repos

Recommended follow-up:

- improve repo-shape and entrypoint narration in a future refinement pass

### 2. Read-First Ranking For Library Repos Is Still Conservative

`pallets/flask` still over-ranks example manifests ahead of the root manifest
and package surface.

Impact:

- ranking quality is not yet ideal on all library repos

Recommended follow-up:

- add intent-aware read-first ranking for library-led repos

### 3. LLM Is Not Integrated

Current state:

- contracts and interfaces are LLM-ready
- runtime implementation remains static-only
- there is no `use_llm_classify` execution path wired into the actual pipeline

Impact:

- Phase 3 ships as deterministic static classification only
- richer semantic disambiguation still requires a later phase

## LLM Integration Readiness

Assessment: `partially ready`

What is already ready:

- classifier interface abstraction exists
- classifier method enum already includes `llm`
- `IntentMap` downstream consumption is decoupled from the concrete classifier

What would still need additive work before LLM integration:

- wire an actual classifier selection path into repo input / orchestration
- add an injected classifier seam instead of hardcoding `StaticClassifier`
  construction inside `buildIntentMap()`
- expand `DirectoryEvidence` if the LLM path needs richer evidence packs

Conclusion:

- Phase 3 is releasable without LLM
- Phase 4 can add LLM without a structural rewrite, but not without a small
  implementation seam pass

## Final Recommendation

Recommendation: `SHIP`

Rationale:

- the explicit Phase 3 release gate on `fastapi/fastapi` is now satisfied
- the secondary real-repo regression target remains credible
- the previously blocking startup-guidance defects are fixed
- remaining gaps are quality improvements, not phase-defining failures

Suggested post-release follow-up priorities:

1. intent-aware guidance and ranking for library repos
2. classifier injection seam for future LLM integration
3. optional LLM-assisted directory classification as a separate phase
