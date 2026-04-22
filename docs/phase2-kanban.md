# Phase 2 Kanban

This Kanban translates the Phase 2 whitepapers into an implementation plan for a
small parallel team.

## Team Shape

Actual developer profile for Phase 2:

- `Codex`
  - strongest engineering judgment
  - medium execution time
  - best for contracts, integration, ranking rules, and acceptance gates
- `Kimi`
  - second strongest
  - short execution time
  - best for bounded feature modules with clear interfaces
- `Minimax`
  - weakest engineering judgment
  - very long execution time
  - should only own low-risk, spec-locked, easy-to-verify work

Assignment rules:

- `Codex` owns any task that defines interfaces used by others.
- `Codex` also owns Python ranking rules, startup contract integration, and
  final acceptance gates.
- `Kimi` owns important but bounded implementation slices after contracts and
  fixtures are stable.
- `Minimax` only owns fixture setup, snapshot harness work, and mechanical docs.
- Do not assign Python inference boundaries, freshness semantics, or startup
  trimming logic to `Minimax`.

Recommended role mapping:

- `Codex: Architecture + Integration`
  - Phase 2 contracts
  - comprehension and ranking extensions
  - startup artifact integration
  - freshness semantics
  - final acceptance gates
- `Kimi: Bounded Feature Implementation`
  - Python scan and extraction modules
  - renderer updates
  - CLI and pipeline plumbing
  - compatibility-safe schema wiring
- `Minimax: Low-Risk Support Work`
  - Python fixture repo setup
  - snapshot harness and example outputs
  - report scaffolding
  - repetitive test coverage

Parallelization rule:

- `Codex` starts first and freezes interfaces.
- `Kimi` starts once contracts, fixture targets, and module boundaries are
  stable.
- `Minimax` starts only after acceptance criteria are concrete.
- Never block `Codex` on `Minimax`.
- Freshness work starts only after the Python quality gate and startup artifact
  gate are green.

## Delivery Milestones

- `P2-M0`: Phase 2 contracts, Python scope, and startup contract are frozen
- `P2-M1`: Python scan and extraction produce stable intermediate results
- `P2-M2`: comprehension builder emits valid canonical metadata for Python repos
- `P2-M3`: `agent-start.md` and markdown outputs are generated from canonical metadata
- `P2-M4`: Python quality gates and end-to-end report pass
- `P2-M5`: freshness path ships after quality gates

## Backlog

### Epic 0: Phase 2 Contract And Fixture Freeze

Owner: `Codex`
Milestone: `P2-M0`

- [ ] `0.1` Freeze Phase 2 canonical schema extensions
  - [ ] Lock manifest kinds for Python support
  - [ ] Lock freshness fields and enum semantics
  - [ ] Lock additive compatibility rules against Phase 1
- [ ] `0.2` Freeze Python scope and failure boundaries
  - [ ] Lock Python in-scope manifests and layouts
  - [ ] Lock Python out-of-scope cases for the first slice
  - [ ] Lock Python P0 failure definition
- [ ] `0.3` Freeze `agent-start.md` contract
  - [ ] Lock required sections
  - [ ] Lock backing fields
  - [ ] Lock `<= 2000` token budget
  - [ ] Lock overflow trimming order
- [ ] `0.4` Freeze verification targets
  - [ ] Lock Python repo classes in the test matrix
  - [ ] Lock end-to-end report requirements
  - [ ] Lock phase gates for freshness sequencing

### Epic 1: Python Repo Input And Structure Scan

Owner: `Kimi`
Milestone: `P2-M1`
Depends on: `0.1`, `0.2`
Review gate: `Codex`

- [ ] `1.1` Extend Stage A repo input for Phase 2
  - [ ] Add `schema_version` `2.0`
  - [ ] Add `emit_agent_start`
  - [ ] Add `freshness_mode`
  - [ ] Preserve backward-compatible defaults where reasonable
- [ ] `1.2` Implement Python manifest detection
  - [ ] Detect `pyproject.toml`
  - [ ] Detect `setup.py`
  - [ ] Detect `setup.cfg`
  - [ ] Detect `requirements*.txt`
- [ ] `1.3` Extend path classification for Python repos
  - [ ] Recognize common Python source layouts
  - [ ] Classify test directories and files
  - [ ] Keep docs/config/build/generated separation consistent with Phase 1
- [ ] `1.4` Implement Python noise suppression rules
  - [ ] `.venv` and virtualenv directories
  - [ ] `__pycache__`
  - [ ] build/dist artifacts
  - [ ] migrations and low-signal glue paths
- [ ] `1.5` Build scan-level Python reproducibility metadata
  - [ ] Preserve included path summary
  - [ ] Preserve excluded path summary
  - [ ] Emit validated Phase 2 `scan.json`

### Epic 2: Python Signal Extraction

Owner: `Kimi`
Milestone: `P2-M1`
Depends on: `1.2`, `1.3`, `1.4`, `0.1`
Review gate: `Codex`

- [ ] `2.1` Implement Python entrypoint detection
  - [ ] Detect `__main__.py`
  - [ ] Detect common CLI bootstrap paths
  - [ ] Detect common service startup files
  - [ ] Emit `reason`, `confidence`, and `evidence`
- [ ] `2.2` Extract Python commands and bootstrap actions
  - [ ] Parse runnable hints from manifests and common config
  - [ ] Normalize command source paths
  - [ ] Avoid inventing commands when signals are weak
- [ ] `2.3` Extend lightweight graph edges
  - [ ] Preserve existing Phase 1 edges
  - [ ] Add `module-link` for Python import/module relationships where cheap
  - [ ] Keep edge extraction deterministic and bounded
- [ ] `2.4` Compute Phase 2 priority candidates
  - [ ] Manifest-based candidates
  - [ ] Entrypoint-based candidates
  - [ ] Fan-in based candidates
  - [ ] Root-central candidates
  - [ ] Adjacent-test candidates
- [ ] `2.5` Compute Python defer candidates
  - [ ] virtualenv and cache paths
  - [ ] generated and build paths
  - [ ] migrations or low-signal operational directories
- [ ] `2.6` Emit validated Phase 2 `signals.json`
  - [ ] Warnings for unsupported or ambiguous Python repos
  - [ ] Stable ordering for deterministic output

### Epic 3: Canonical Metadata Builder

Owner: `Codex`
Milestone: `P2-M2`
Depends on: `2.1`, `2.3`, `2.4`, `2.5`, `0.1`

- [ ] `3.1` Extend graph layer for Phase 2
  - [ ] Preserve Phase 1 node and edge behavior
  - [ ] Add Python manifests into graph nodes
  - [ ] Preserve `module-link` edges
- [ ] `3.2` Extend top-level repo metadata
  - [ ] Primary languages for Python repos
  - [ ] Detected ecosystems for Python repos
  - [ ] Conservative framework hints for FastAPI, Flask, and Django
- [ ] `3.3` Derive Phase 2 views from the graph
  - [ ] `entrypoints`
  - [ ] `first_read_path`
  - [ ] `key_paths`
  - [ ] `critical_paths`
  - [ ] `defer_for_now`
  - [ ] `agent_hints`
  - [ ] `warnings`
- [ ] `3.4` Add freshness metadata container
  - [ ] `mode`
  - [ ] `status`
  - [ ] `generated_from`
  - [ ] `reason`
- [ ] `3.5` Enforce inference boundary
  - [ ] Facts do not carry invented summaries
  - [ ] Inferences always carry `reason` and `confidence`
  - [ ] Low-confidence Python guesses are omitted from startup guidance
  - [ ] `degraded` freshness does not overstate trust
- [ ] `3.6` Emit validated Phase 2 `context-index.json`
  - [ ] Deterministic field ordering
  - [ ] Deterministic item ordering
  - [ ] Stable serialization for snapshots

### Epic 4: Startup And Human-Facing Renderers

Owner: `Kimi`
Milestone: `P2-M3`
Depends on: `3.3`, `3.4`, `3.6`, `0.3`
Review gate: `Codex`

- [ ] `4.1` Update `repo.map.md` renderer for Phase 2
  - [ ] Render Python-oriented repo snapshot
  - [ ] Render freshness state when present
  - [ ] Preserve no-new-claims rule
- [ ] `4.2` Update `ONBOARDING.md` renderer for Phase 2
  - [ ] Render Python-oriented run and test hints
  - [ ] Render warnings when signals are incomplete
  - [ ] Preserve no-new-claims rule
- [ ] `4.3` Implement `agent-start.md` renderer
  - [ ] Render required sections in fixed order
  - [ ] Render from canonical metadata only
  - [ ] Enforce token budget
- [ ] `4.4` Implement `agent-start.md` overflow trimming
  - [ ] Implement section-aware budget measurement
  - [ ] Implement overflow trimming order exactly as specified
  - [ ] Preserve warnings while trimming lower-priority sections
  - [ ] Keep trimming logic isolated enough for direct tests
- [ ] `4.5` Integrate output writing
  - [ ] `repo.map.md`
  - [ ] `ONBOARDING.md`
  - [ ] `agent-start.md`

### Epic 5: CLI And Pipeline Integration

Owner: `Codex`
Milestone: `P2-M3`
Depends on: `1.1`, `3.6`, `4.3`

- [ ] `5.1` Update CLI for Phase 2 output path
  - [ ] Add `agent-start.md` emission path
  - [ ] Preserve debug artifact flow
  - [ ] Preserve deterministic overwrite behavior
- [ ] `5.2` Integrate Phase 2 pipeline defaults
  - [ ] Default startup artifact emission behavior
  - [ ] Backward-compatible handling of legacy options where practical
  - [ ] Stable run layout under `work/runs/<run-id>/`
- [ ] `5.3` Add CLI-facing freshness mode wiring
  - [ ] Parse `off|watch|ci`
  - [ ] Keep freshness off by default until implementation is ready
  - [ ] Expose freshness metadata without faking freshness support

### Epic 6: Test Matrix And Quality Gates

Owner: `Codex`
Milestone: `P2-M4`
Depends on: `1.5`, `2.6`, `3.6`, `4.3`

- [ ] `6.1` Build Python fixture suite
  - [ ] Python CLI fixture
  - [ ] Python library fixture
  - [ ] Python web/service fixture
  - [ ] Noisy Python fixture
  - [ ] Mixed Python + JS/TS fixture
- [ ] `6.2` Add contract and compatibility tests
  - [ ] Schema validation for new fields
  - [ ] Freshness enum coverage including `degraded`
  - [ ] Additive compatibility checks against Phase 1
- [ ] `6.3` Add comprehension and ranking tests
  - [ ] Entry point credibility tests
  - [ ] Key-path anti-noise tests
  - [ ] First-read-path justification tests
  - [ ] Warning generation tests
- [ ] `6.4` Add renderer and startup contract tests
  - [ ] `agent-start.md` snapshots
  - [ ] overflow trimming order tests
  - [ ] freshness rendering tests
- [ ] `6.5` Produce Phase 2 end-to-end report
  - [ ] Create `phase2-python-end2end-test-report.md`
  - [ ] Evaluate false positives and false negatives
  - [ ] Evaluate noise suppression
  - [ ] Record ship/no-ship recommendation

### Epic 7: Freshness System

Owner: `Kimi`
Milestone: `P2-M5`
Depends on: `6.5`
Review gate: `Codex`

- [ ] `7.1` Implement freshness state model
  - [ ] `fresh`
  - [ ] `stale`
  - [ ] `degraded`
  - [ ] `unknown`
- [ ] `7.2` Implement watch-mode regeneration
  - [ ] change detection
  - [ ] canonical rebuild trigger
  - [ ] degraded-state fallback when equivalence is not proven
- [ ] `7.3` Implement CI regeneration path
  - [ ] explicit CI mode
  - [ ] canonical rebuild path
  - [ ] freshness metadata emission
- [ ] `7.4` Add freshness verification
  - [ ] watch-mode tests
  - [ ] CI-mode tests
  - [ ] incremental-versus-full trust signaling tests

## Definition Of Done

Phase 2 is done only when all of the following are true:

- Python support works credibly for the scoped repository classes
- `context-index.json` remains canonical and additive versus Phase 1 where intended
- `agent-start.md` is generated from canonical metadata and obeys the fixed budget rules
- startup overflow behavior matches the documented trimming order
- Python P0 failures do not exceed the severity of the major Phase 1 Vue miss
- `phase2-python-end2end-test-report.md` recommends ship for the scoped repo classes
- freshness ships only after Python quality and startup artifact gates pass
