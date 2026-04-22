# Phase 2 Python End-to-End Test Report

Date: `2026-04-22`

## Scope

This report evaluates the current Phase 2 Python slice against the repository
fixtures and tests present in the main workspace.

## Fixture Set And Repository Classes Covered

- JS/TS baseline fixtures carried forward from Phase 1:
  - `node-cli`
  - `nextjs-app`
  - `vue-app`
  - `noisy-repo`
- Python CLI fixture:
  - `python-cli`
- Python library fixture:
  - `python-library`
- Python web/service fixtures:
  - `python-fastapi`
  - `python-flask`
  - `python-django`
- Noisy Python fixture:
  - `noisy-python`
- Mixed Python + JS/TS fixture:
  - `mixed-python-js`

## Verification Evidence

### Local Tests Added Or Revalidated In This Pass

- contract validation for Phase 2 freshness state, including `degraded`
- Phase 1 additive compatibility checks for `context-index.json` shape and enum
  preservation
- Python first-read-path justification coverage
- warning propagation coverage from `signals.warnings` into comprehension output
- `agent-start.md` overflow trimming coverage for lower-priority sections

### Local Test Results

- Targeted local tests added in this pass:
  - passed via
    `npm test -- tests/contracts/validation.test.ts tests/contracts/compatibility.test.ts tests/comprehend/python-quality.test.ts tests/render/agent-start.test.ts`
- Main workspace test files passed during full-suite run
- Full `npm test` in the repository root still reports failures from
  `.worktrees/phase2-codex` and `.worktrees/phase2-minimax` snapshot baselines,
  not from the main workspace test files

## Canonical Output Examples

### Example: `python-fastapi`

Observed canonical behavior:

- `first_read_path[0]` starts from `pyproject.toml`
- justification is stable and explicit:
  - `why_now`: `Start here to understand workspace shape, scripts, and dependencies.`
  - `reason`: `Manifest files anchor the repository's install and run workflows.`

### Example: Warning Propagation

Observed canonical behavior in `node-cli`:

- `signals.warnings` contains:
  - `Skipping bin entrypoint "./dist/index.js" because it is not present in the scanned snapshot.`
- the same warning is republished into `comprehension.warnings`

## Startup Artifact Examples

### Example: `repo.map.md`

Current renderer behavior:

- includes a `Freshness` section with:
  - `mode`
  - `status`
  - `generated_from`
  - `reason`

### Example: `agent-start.md`

Current renderer behavior under overflow:

- preserves `Warnings And Uncertainty`
- trims lower-priority sections first
- drops `Freshness` and `Defer For Now` before higher-priority sections when the
  content exceeds the budget

## False Positives And False Negatives

### False Positives

- No new severe false-positive pattern was introduced by the `Codex` changes in
  this pass.
- Existing Python framework guidance is still conservative, but the new local
  `src/comprehend/index.ts` WIP has not yet been fully verified against all
  fixtures.

### False Negatives

- `first_read_path` does not yet reliably surface the Python runtime entry file
  in all Python fixtures, even when the manifest anchor is correct.
- Freshness behavior is intentionally limited to scaffold metadata, so the tool
  still cannot claim `fresh`, `stale`, or `degraded` at runtime.

## Noise Suppression Evaluation

Current evidence is positive but incomplete:

- existing fixture coverage verifies defer behavior for noisy JS/TS repositories
- Python scan logic includes suppression rules for virtualenvs, caches, build
  outputs, and low-signal glue paths
- the remaining missing gap is targeted key-path anti-noise coverage on Python
  fixtures

Assessment:

- noise suppression is directionally credible
- it is not yet verified strongly enough to count as a final ship gate

## Freshness-State Evaluation

Current implementation status:

- contracts define `fresh|stale|degraded|unknown`
- validation now covers `degraded`
- runtime output still emits only scaffolded freshness metadata
- the current emitted trust state is effectively `unknown`

Assessment:

- freshness contract work is ahead of freshness runtime behavior
- freshness should not ship yet

## Open Gaps

- `agent-start.md` snapshot coverage is still missing in the main workspace
- Python key-path anti-noise tests are still missing
- Python warning-generation coverage is still narrow
- runtime freshness behavior is not implemented
- freshness verification tests are not implemented
- the worktree snapshot baselines should be reconciled separately from the main
  workspace

## Recommendation

Recommendation: `NO-SHIP`

Reason:

- Python support is improving and the contract/test surface is materially better
  than before this pass
- however, Phase 2 still lacks enough verification for ranking quality and does
  not yet implement trusted freshness behavior
- the remaining gaps are large enough that shipping now would overstate current
  readiness
