# Phase 1 Kanban

This Kanban translates the Phase 1 whitepaper into an implementation plan for a
small parallel team.

## Team Shape

Actual developer profile for Phase 1:

- `Codex`
  - strongest engineering judgment
  - medium execution time
  - best for architecture, contracts, integration, high-coupling modules
- `Kimi`
  - second strongest
  - short execution time
  - best for bounded feature modules with clear inputs and outputs
- `Minimax`
  - weakest engineering judgment
  - very long execution time
  - should only own low-risk, spec-locked, easy-to-verify work

Assignment rules:

- `Codex` owns any task that defines interfaces used by others.
- `Codex` also owns all cross-stage integration and final acceptance gates.
- `Kimi` owns important but bounded implementation slices after interface freeze.
- `Minimax` only owns tasks with explicit fixtures, explicit schema, and narrow
  write scope.
- Do not assign ambiguous inference logic or schema design to `Minimax`.

Recommended role mapping:

- `Codex: Architecture + Integration`
  - contracts
  - project scaffold
  - comprehension builder
  - CLI orchestration
  - final renderer integration
- `Kimi: Bounded Feature Implementation`
  - repo input normalization
  - structure scan
  - deterministic extraction modules
  - selected markdown renderer implementation
- `Minimax: Low-Risk Support Work`
  - fixture repo setup
  - snapshot harness
  - deterministic utility coverage
  - documentation-adjacent mechanical tasks

Parallelization rule:

- `Codex` starts first and freezes interfaces.
- `Kimi` starts once contracts and module boundaries are stable.
- `Minimax` starts only after acceptance criteria are concrete.
- Never block `Codex` on `Minimax`.

## Delivery Milestones

- `M0`: repo scaffold, build, schemas, and fixture strategy in place
- `M1`: scan and extract pipeline produces stable intermediate results
- `M2`: comprehension builder emits valid `context-index.json`
- `M3`: markdown outputs are generated from canonical metadata
- `M4`: static agent-facing output path and performance baseline are complete

## Backlog

### Epic 0: Foundation And Project Scaffold

Owner: `Codex`  
Milestone: `M0`

- [x] `0.1` Bootstrap repository implementation structure
  - [x] Create `src/contracts/`, `src/input/`, `src/scan/`, `src/extract/`, `src/comprehend/`, `src/render/`, `src/cli/`
  - [x] Create `tests/contracts/`, `tests/scan/`, `tests/extract/`, `tests/comprehend/`, `tests/render/`, `tests/fixtures/`
  - [x] Create `work/runs/` local output convention in code, not in checked-in generated files
- [x] `0.2` Establish TypeScript runtime and build pipeline
  - [x] Add `package.json`
  - [x] Add `tsconfig.json`
  - [x] Add build command for compiled JS output
  - [x] Add test command
  - [x] Add lint or typecheck command
- [x] `0.3` Implement shared path and filesystem utilities
  - [x] Repo-relative path normalization
  - [x] Ignore rule loading
  - [x] Stable directory walking helpers
  - [x] Safe write helpers for `work/runs/<run-id>/...`
- [x] `0.4` Lock core schema types from whitepaper
  - [x] Repo input schema
  - [x] Structure scan schema
  - [x] Signal extraction schema
  - [x] Comprehension schema
  - [x] `context-index.json` schema
- [x] `0.5` Add contract validation boundary
  - [x] Runtime schema validation for stage outputs
  - [x] Shared error shape for invalid stage output
  - [x] Version field enforcement

### Epic 1: Repo Input And Structure Scan

Owner: `Kimi`  
Milestone: `M1`  
Depends on: `0.1`, `0.3`, `0.4`  
Review gate: `Codex`

- [x] `1.1` Implement Stage A repo input normalization
  - [x] Resolve repo root from CLI input
  - [x] Generate `run_id`
  - [x] Capture snapshot metadata
  - [x] Normalize include and exclude options
  - [x] Emit validated `input.json`
- [x] `1.2` Implement ignore handling
  - [x] Respect common repo ignore files where deterministic
  - [x] Add internal default ignores for build output, vendor, generated paths
  - [x] Preserve `included_paths` and `excluded_paths` metadata
- [x] `1.3` Implement Stage B structure scan
  - [x] Enumerate files and directories
  - [x] Classify `path.role`
  - [x] Count files and directories
  - [x] Emit validated `scan.json`
- [x] `1.4` Detect JS/TS ecosystem artifacts
  - [x] Detect `package.json`
  - [x] Detect lockfiles
  - [x] Detect `tsconfig` and `jsconfig` as config nodes, not manifests
  - [x] Detect framework hints from known conventions
- [x] `1.5` Build scan-level reproducibility metadata
  - [x] Populate `snapshot_id`
  - [x] Populate `generated_at`
  - [x] Preserve included path summary
  - [x] Preserve excluded path summary

### Epic 2: Deterministic Signal Extraction

Owner: `Kimi`  
Milestone: `M1`  
Depends on: `1.3`, `1.4`, `0.4`  
Review gate: `Codex`

- [x] `2.1` Implement entrypoint detection
  - [x] Detect app entrypoints from framework conventions
  - [x] Detect CLI entrypoints from `package.json` bins and scripts
  - [x] Detect server entrypoints from common Node service patterns
  - [x] Emit `reason`, `confidence`, and `evidence`
- [x] `2.2` Extract commands and bootstrap actions
  - [x] Parse scripts from `package.json`
  - [x] Normalize run/test/build/dev commands
  - [x] Attach command source path
- [x] `2.3` Build lightweight graph edges
  - [x] `contains`
  - [x] `import`
  - [x] `require`
  - [x] `config-link`
  - [x] `test-of`
- [x] `2.4` Compute priority candidates
  - [x] Manifest-based candidates
  - [x] Entrypoint-based candidates
  - [x] Fan-in based candidates
  - [x] Framework-core candidates
  - [x] Adjacent-test candidates
- [x] `2.5` Compute defer candidates
  - [x] Vendor-like paths
  - [x] Generated paths
  - [x] Build output
  - [x] Large low-signal directories
- [x] `2.6` Emit validated `signals.json`
  - [x] Warnings for unsupported or ambiguous repos
  - [x] Stable ordering for deterministic output

### Epic 3: Canonical Metadata Builder

Owner: `Codex`  
Milestone: `M2`  
Depends on: `2.1`, `2.3`, `2.4`, `2.5`, `0.4`

- [x] `3.1` Assemble graph layer
  - [x] Map files and directories into graph nodes
  - [x] Map manifests into graph nodes
  - [x] Map config files into graph nodes
  - [x] Map test files into graph nodes
  - [x] Preserve extracted edges
- [x] `3.2` Assemble top-level repo metadata
  - [x] Repo name and root
  - [x] Repo shape
  - [x] Primary languages
  - [x] Detected ecosystems
  - [x] Framework hints
- [x] `3.3` Assemble reproducibility metadata
  - [x] `run_id`
  - [x] `snapshot_id`
  - [x] `generated_at`
  - [x] `included_paths`
  - [x] `excluded_paths`
- [x] `3.4` Derive human and agent views from the graph
  - [x] `entrypoints`
  - [x] `first_read_path`
  - [x] `key_paths`
  - [x] `critical_paths`
  - [x] `defer_for_now`
  - [x] `agent_hints`
- [x] `3.5` Enforce inference boundary
  - [x] Facts do not carry invented summaries
  - [x] Inferences always carry `reason` and `confidence`
  - [x] `entrypoints` and `key_paths` require `evidence`
  - [x] Low-confidence content is omitted from default agent hints
- [x] `3.6` Emit validated `context-index.json`
  - [x] Deterministic field ordering
  - [x] Deterministic item ordering
  - [x] Stable serialization for snapshots

### Epic 4: Human-Facing Renderers

Owner: `Kimi`  
Milestone: `M3`  
Depends on: `3.4`, `3.6`  
Review gate: `Codex`

- [x] `4.1` Implement `repo.map.md` renderer
  - [x] Render repo snapshot
  - [x] Render first-read path
  - [x] Render key paths
  - [x] Render entrypoints
  - [x] Render critical paths
  - [x] Render defer-for-now section
- [x] `4.2` Implement `ONBOARDING.md` renderer
  - [x] Render action-start summary
  - [x] Render likely entrypoints
  - [x] Render getting-oriented hints
  - [x] Render safe early edit zones
  - [x] Render defer-for-now section
- [x] `4.3` Enforce markdown rendering rules
  - [x] No new claims beyond canonical metadata
  - [x] Confidence tags only where needed
  - [x] Compact, skimmable output
- [x] `4.4` Write outputs to `work/runs/<run-id>/outputs/`
  - [x] `repo.map.md`
  - [x] `ONBOARDING.md`

### Epic 5: Agent-Facing Output Path

Owner: `Codex`  
Milestone: `M4`  
Depends on: `3.6`

- [x] `5.1` Define Phase 1 static agent output format
  - [x] Decide initial target file layout
  - [x] Keep it derived-only from `context-index.json`
  - [x] Keep MCP out of initial implementation path
- [x] `5.2` Implement minimal agent-facing renderer
  - [x] Emit compact repo summary for first session
  - [x] Emit key entrypoints and read path
  - [x] Emit safe edit and watch-out hints
- [x] `5.3` Integrate agent output into CLI
  - [x] Optional flag to emit static agent view
  - [x] Output path selection
  - [x] Deterministic overwrite behavior

### Epic 6: CLI And Orchestration

Owner: `Codex`  
Milestone: `M3`  
Depends on: `0.2`, `1.1`, `2.6`, `3.6`, `4.4`

- [x] `6.1` Implement top-level CLI command
  - [x] Accept repo path
  - [x] Accept include and exclude options
  - [x] Accept debug artifact option
  - [x] Accept output root option
- [x] `6.2` Implement pipeline orchestration
  - [x] Input stage
  - [x] Scan stage
  - [x] Extract stage
  - [x] Comprehend stage
  - [x] Render stage
- [x] `6.3` Implement output writing behavior
  - [x] Always emit `context-index.json`
  - [x] Emit markdown outputs by default
  - [x] Emit debug artifacts only when enabled
- [x] `6.4` Implement error reporting
  - [x] Friendly validation errors
  - [x] Stage failure boundaries
  - [x] Exit codes suitable for scripting
- [x] `6.5` Preserve headless-friendly behavior
  - [x] Do not auto-open browser by default
  - [x] Print output locations

### Epic 7: Quality, Fixtures, And Regression Safety

Owner: `Minimax`  
Milestone: `M0` to `M4`  
Depends on: `0.1`, `0.4`  
Review gate: `Codex`

- [x] `7.1` Create fixture repo matrix
  - [x] Next.js fixture
  - [x] React app fixture
  - [x] Vite app fixture
  - [x] Node CLI fixture
  - [x] Express service fixture
  - [x] Unsupported or noisy fixture for failure-path testing
- [x] `7.2` Add contract tests
  - [x] Repo input schema validation
  - [x] Scan schema validation
  - [x] Signals schema validation
  - [x] `context-index.json` schema validation
- [x] `7.3` Add stage-level fixture tests
  - [x] Scan assertions
  - [x] Entry point extraction assertions
  - [x] Graph edge assertions
  - [x] Defer-path assertions
- [x] `7.4` Add renderer snapshot tests
  - [x] `repo.map.md`
  - [x] `ONBOARDING.md`
  - [x] Canonical JSON snapshot
- [x] `7.5` Add regression tests for confidence rules
  - [x] Low-confidence omission in agent-facing sections
  - [x] Evidence presence on `entrypoints`
  - [x] Evidence presence on `key_paths`
- [x] `7.6` Add performance baseline checks
  - [x] Small repo baseline
  - [x] Medium repo baseline
  - [x] Large repo synthetic baseline

Constraints for `Minimax` work:

- `Minimax` should not define expected outputs alone; `Codex` must provide or
  approve golden snapshots first.
- `Minimax` should not own inference heuristics, confidence logic, or schema
  evolution.
- `Minimax` tasks must have deterministic acceptance criteria.

### Epic 8: Stretch Goal - HTML Report

Owner: `Kimi`  
Milestone: `Post-M4 or stretch within M4`  
Depends on: `3.6`  
Review gate: `Codex`

- [x] `8.1` Define minimal HTML report scope
  - [x] Confirm report is derived-only from canonical metadata
  - [x] Limit scope to read-only exploration
- [x] `8.2` Build minimal HTML renderer
  - [x] Repo summary
  - [x] First-read path
  - [x] Key paths and entrypoints
  - [x] Confidence indicators
- [x] `8.3` Keep release gating separate
  - [x] HTML is not a blocker for initial Phase 1 release

## Ready First

These tasks should start immediately:

- [x] `0.1` Bootstrap repository implementation structure
- [x] `0.2` Establish TypeScript runtime and build pipeline
- [x] `0.4` Lock core schema types from whitepaper
- [x] `7.1` Create fixture repo matrix

Suggested immediate staffing:

- `Codex`
  - `0.1`
  - `0.2`
  - `0.4`
- `Kimi`
  - prepare implementation plan for `1.1` to `1.4` after schema freeze
- `Minimax`
  - start `7.1` only after fixture acceptance checklist is written by `Codex`

## Critical Path

The narrowest delivery path to a usable Phase 1 release:

- [x] `0.1` -> `0.2` -> `0.4`
- [x] `1.1` -> `1.3` -> `1.4`
- [x] `2.1` -> `2.3` -> `2.4`
- [x] `3.1` -> `3.4` -> `3.6`
- [x] `4.1` + `4.2`
- [x] `6.1` -> `6.2` -> `6.3`
- [ ] `7.2` -> `7.4` -> `7.6`

Personnel-aware critical path:

- `Codex` path
  - [x] `0.1` -> `0.2` -> `0.4` -> `3.1` -> `3.4` -> `3.6` -> `6.1` -> `6.2` -> `5.1` -> `5.2`
- `Kimi` path
  - [x] `1.1` -> `1.3` -> `1.4` -> `2.1` -> `2.3` -> `2.4` -> `4.1` -> `4.2`
- `Minimax` support path
  - [x] `7.1` -> `7.2`

Risk note:

- The project succeeds or fails primarily on `Codex` throughput, because all
  schema, integration, and metadata correctness converge there.
- `Kimi` is the main accelerator.
- `Minimax` should improve coverage, not define delivery pace.

## Delegation Strategy

### Codex-Owned Work

These tasks should not be delegated away:

- schema and contract definitions
- canonical metadata builder
- confidence and evidence policy enforcement
- CLI orchestration
- final integration of stage outputs
- acceptance review of Kimi and Minimax work

### Kimi-Owned Work

Best-fit tasks for Kimi:

- repo input normalization
- scan walkers and artifact detectors
- entrypoint extraction
- graph edge extraction
- markdown renderer implementation once canonical fields are frozen

### Minimax-Owned Work

Only assign work in this class:

- fixture setup from explicit template
- test harness boilerplate
- snapshot test wiring
- repetitive validation cases
- mechanical docs or example output assembly

Avoid assigning Minimax:

- heuristic ranking
- framework detection logic
- ambiguous parser behavior
- cross-module refactors
- final renderer logic

## Definition Of Done

Phase 1 is done only when all of the following are true:

- CLI can scan a JS/TS repo and emit `context-index.json`
- CLI can derive `repo.map.md` and `ONBOARDING.md` from canonical metadata
- Outputs are deterministic across repeated runs on the same snapshot
- Canonical metadata includes reproducibility fields
- Confidence and evidence rules match the whitepaper
- Fixture tests and renderer snapshots pass
- Performance baseline is measured against the declared Phase 1 SLOs

---

# Phase 2 Kanban

## Delivery Milestones

- `P2-M0`: Phase 2 contracts, Python scope, and startup contract are frozen
- `P2-M1`: Python scan and extraction produce stable intermediate results
- `P2-M2`: comprehension builder emits valid canonical metadata for Python repos
- `P2-M3`: `agent-start.md` and markdown outputs are generated from canonical metadata
- `P2-M4`: Python quality gates and end-to-end report pass
- `P2-M5`: freshness path ships after quality gates

## Backlog

### Epic 0: Phase 2 Contract And Fixture Freeze

Owner: `Codex` | Milestone: `P2-M0`

- [x] `0.1` Freeze Phase 2 canonical schema extensions (merged to main)
  - [x] Lock manifest kinds for Python support
  - [x] Lock freshness fields and enum semantics
  - [x] Lock additive compatibility rules against Phase 1
- [ ] `0.2` Freeze Python scope and failure boundaries
  - [ ] Lock Python in-scope manifests and layouts
  - [ ] Lock Python out-of-scope cases for the first slice
  - [ ] Lock Python P0 failure definition
- [x] `0.3` Freeze `agent-start.md` contract (merged to main)
  - [x] Lock required sections
  - [x] Lock backing fields
  - [x] Lock `<= 2000` token budget
  - [x] Lock overflow trimming order
- [ ] `0.4` Freeze verification targets
  - [ ] Lock Python repo classes in the test matrix
  - [ ] Lock end-to-end report requirements
  - [ ] Lock phase gates for freshness sequencing

### Epic 1: Python Repo Input And Structure Scan

Owner: `Kimi` | Milestone: `P2-M1` | Review gate: `Codex`

- [x] `1.1` Extend Stage A repo input for Phase 2 (merged to main)
  - [x] Add `schema_version` `2.0`
  - [x] Add `emit_agent_start`
  - [x] Add `freshness_mode`
  - [x] Preserve backward-compatible defaults where reasonable
- [x] `1.2` Implement Python manifest detection (merged to main)
  - [x] Detect `pyproject.toml`
  - [x] Detect `setup.py`
  - [x] Detect `setup.cfg`
  - [x] Detect `requirements*.txt`
- [x] `1.3` Extend path classification for Python repos (merged to main)
  - [x] Recognize common Python source layouts
  - [x] Classify test directories and files
  - [x] Keep docs/config/build/generated separation consistent with Phase 1
- [x] `1.4` Implement Python noise suppression rules (merged to main)
  - [x] `.venv` and virtualenv directories
  - [x] `__pycache__`
  - [x] build/dist artifacts
  - [x] migrations and low-signal glue paths
- [x] `1.5` Build scan-level Python reproducibility metadata (merged to main)
  - [x] Preserve included path summary
  - [x] Preserve excluded path summary
  - [x] Emit validated Phase 2 `scan.json`

### Epic 2: Python Signal Extraction

Owner: `Kimi` | Milestone: `P2-M1` | Review gate: `Codex`

- [x] `2.1` Implement Python entrypoint detection (merged to main)
  - [x] Detect `__main__.py`
  - [x] Detect common CLI bootstrap paths
  - [x] Detect common service startup files
  - [x] Emit `reason`, `confidence`, and `evidence`
- [x] `2.2` Extract Python commands and bootstrap actions (merged to main)
  - [x] Parse runnable hints from manifests and common config
  - [x] Normalize command source paths
  - [x] Avoid inventing commands when signals are weak
- [x] `2.3` Extend lightweight graph edges (merged to main)
  - [x] Preserve existing Phase 1 edges
  - [x] Add `module-link` for Python import/module relationships where cheap
  - [x] Keep edge extraction deterministic and bounded
- [x] `2.4` Compute Phase 2 priority candidates (merged to main)
  - [x] Manifest-based candidates
  - [x] Entrypoint-based candidates
  - [x] Fan-in based candidates
  - [x] Root-central candidates
  - [x] Adjacent-test candidates
- [x] `2.5` Compute Python defer candidates (merged to main)
  - [x] virtualenv and cache paths
  - [x] generated and build paths
  - [x] migrations or low-signal operational directories
- [x] `2.6` Emit validated Phase 2 `signals.json` (merged to main)
  - [x] Warnings for unsupported or ambiguous Python repos
  - [x] Stable ordering for deterministic output

### Epic 3: Canonical Metadata Builder

Owner: `Codex` | Milestone: `P2-M2`

- [x] `3.1` Extend graph layer for Phase 2 (merged to main)
  - [x] Preserve Phase 1 node and edge behavior
  - [x] Add Python manifests into graph nodes
  - [x] Preserve `module-link` edges
- [x] `3.2` Extend top-level repo metadata (merged to main)
  - [x] Primary languages for Python repos
  - [x] Detected ecosystems for Python repos
  - [x] Conservative framework hints for FastAPI, Flask, and Django
- [x] `3.3` Derive Phase 2 views from the graph (merged to main)
  - [x] `entrypoints`
  - [x] `first_read_path`
  - [x] `key_paths`
  - [x] `critical_paths`
  - [x] `defer_for_now`
  - [x] `agent_hints`
  - [x] `warnings`
- [x] `3.4` Add freshness metadata container (merged to main)
  - [x] `mode`
  - [x] `status`
  - [x] `generated_from`
  - [x] `reason`
- [x] `3.5` Enforce inference boundary (merged to main)
  - [x] Facts do not carry invented summaries
  - [x] Inferences always carry `reason` and `confidence`
  - [x] Low-confidence Python guesses are omitted from startup guidance
  - [x] `degraded` freshness does not overstate trust
- [x] `3.6` Emit validated Phase 2 `context-index.json` (merged to main)
  - [x] Deterministic field ordering
  - [x] Deterministic item ordering
  - [x] Stable serialization for snapshots

### Epic 4: Startup And Human-Facing Renderers

Owner: `Kimi` | Milestone: `P2-M3` | Review gate: `Codex`

- [x] `4.1` Update `repo.map.md` renderer for Phase 2 (merged to main)
  - [x] Render Python-oriented repo snapshot
  - [x] Render freshness state when present
  - [x] Preserve no-new-claims rule
- [x] `4.2` Update `ONBOARDING.md` renderer for Phase 2 (merged to main)
  - [x] Render Python-oriented run and test hints
  - [x] Render warnings when signals are incomplete
  - [x] Preserve no-new-claims rule
- [x] `4.3` Implement `agent-start.md` renderer (merged to main)
  - [x] Render required sections in fixed order
  - [x] Render from canonical metadata only
  - [x] Enforce token budget
- [x] `4.4` Implement `agent-start.md` overflow trimming (merged to main)
  - [x] Implement section-aware budget measurement
  - [x] Implement overflow trimming order exactly as specified
  - [x] Preserve warnings while trimming lower-priority sections
  - [x] Keep trimming logic isolated enough for direct tests
- [x] `4.5` Integrate output writing (merged to main)
  - [x] `repo.map.md`
  - [x] `ONBOARDING.md`
  - [x] `agent-start.md`

### Epic 5: CLI And Pipeline Integration

Owner: `Codex` | Milestone: `P2-M3`

- [x] `5.1` Update CLI for Phase 2 output path (merged to main)
  - [x] Add `agent-start.md` emission path
  - [x] Preserve debug artifact flow
  - [x] Preserve deterministic overwrite behavior
- [x] `5.2` Integrate Phase 2 pipeline defaults (merged to main)
  - [x] Default startup artifact emission behavior
  - [x] Backward-compatible handling of legacy options where practical
  - [x] Stable run layout under `work/runs/<run-id>/`
- [x] `5.3` Add CLI-facing freshness mode wiring (merged to main)
  - [x] Parse `off|watch|ci`
  - [x] Keep freshness off by default until implementation is ready
  - [x] Expose freshness metadata without faking freshness support

### Epic 6: Test Matrix And Quality Gates

Owner: `Minimax` + `Codex` | Milestone: `P2-M4`

- [x] `6.1` Build Python fixture suite (merged to main)
  - [x] Python CLI fixture
  - [x] Python library fixture
  - [x] Python web/service fixture (FastAPI / Flask / Django)
  - [x] Noisy Python fixture
  - [x] Mixed Python + JS/TS fixture
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
  - [ ] Overflow trimming order tests
  - [ ] Freshness rendering tests
- [ ] `6.5` Produce Phase 2 end-to-end report
  - [ ] Create `phase2-python-end2end-test-report.md`
  - [ ] Evaluate false positives and false negatives
  - [ ] Evaluate noise suppression
  - [ ] Record ship/no-ship recommendation

### Epic 7: Freshness System

Owner: `Kimi` | Milestone: `P2-M5` | Review gate: `Codex`

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

## Critical Path (Phase 2)

- `0.1` -> `0.2` -> `1.2` -> `1.3` -> `1.4` -> `2.1` -> `2.4` -> `2.5` -> `3.1` -> `3.2` -> `3.3` -> `6.2` -> `6.3` -> `6.5`

## Definition Of Done

Phase 2 is done only when all of the following are true:

- Python support works credibly for the scoped repository classes
- `context-index.json` remains canonical and additive versus Phase 1 where intended
- `agent-start.md` is generated from canonical metadata and obeys the fixed budget rules
- startup overflow behavior matches the documented trimming order
- Python P0 failures do not exceed the severity of the major Phase 1 Vue miss
- `phase2-python-end2end-test-report.md` recommends ship for the scoped repo classes
- freshness ships only after Python quality and startup artifact gates pass
