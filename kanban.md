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

- [ ] `0.1` Bootstrap repository implementation structure
  - [ ] Create `src/contracts/`, `src/input/`, `src/scan/`, `src/extract/`, `src/comprehend/`, `src/render/`, `src/cli/`
  - [ ] Create `tests/contracts/`, `tests/scan/`, `tests/extract/`, `tests/comprehend/`, `tests/render/`, `tests/fixtures/`
  - [ ] Create `work/runs/` local output convention in code, not in checked-in generated files
- [ ] `0.2` Establish TypeScript runtime and build pipeline
  - [ ] Add `package.json`
  - [ ] Add `tsconfig.json`
  - [ ] Add build command for compiled JS output
  - [ ] Add test command
  - [ ] Add lint or typecheck command
- [ ] `0.3` Implement shared path and filesystem utilities
  - [ ] Repo-relative path normalization
  - [ ] Ignore rule loading
  - [ ] Stable directory walking helpers
  - [ ] Safe write helpers for `work/runs/<run-id>/...`
- [ ] `0.4` Lock core schema types from whitepaper
  - [ ] Repo input schema
  - [ ] Structure scan schema
  - [ ] Signal extraction schema
  - [ ] Comprehension schema
  - [ ] `context-index.json` schema
- [ ] `0.5` Add contract validation boundary
  - [ ] Runtime schema validation for stage outputs
  - [ ] Shared error shape for invalid stage output
  - [ ] Version field enforcement

### Epic 1: Repo Input And Structure Scan

Owner: `Kimi`  
Milestone: `M1`  
Depends on: `0.1`, `0.3`, `0.4`  
Review gate: `Codex`

- [ ] `1.1` Implement Stage A repo input normalization
  - [ ] Resolve repo root from CLI input
  - [ ] Generate `run_id`
  - [ ] Capture snapshot metadata
  - [ ] Normalize include and exclude options
  - [ ] Emit validated `input.json`
- [ ] `1.2` Implement ignore handling
  - [ ] Respect common repo ignore files where deterministic
  - [ ] Add internal default ignores for build output, vendor, generated paths
  - [ ] Preserve `included_paths` and `excluded_paths` metadata
- [ ] `1.3` Implement Stage B structure scan
  - [ ] Enumerate files and directories
  - [ ] Classify `path.role`
  - [ ] Count files and directories
  - [ ] Emit validated `scan.json`
- [ ] `1.4` Detect JS/TS ecosystem artifacts
  - [ ] Detect `package.json`
  - [ ] Detect lockfiles
  - [ ] Detect `tsconfig` and `jsconfig` as config nodes, not manifests
  - [ ] Detect framework hints from known conventions
- [ ] `1.5` Build scan-level reproducibility metadata
  - [ ] Populate `snapshot_id`
  - [ ] Populate `generated_at`
  - [ ] Preserve included path summary
  - [ ] Preserve excluded path summary

### Epic 2: Deterministic Signal Extraction

Owner: `Kimi`  
Milestone: `M1`  
Depends on: `1.3`, `1.4`, `0.4`  
Review gate: `Codex`

- [ ] `2.1` Implement entrypoint detection
  - [ ] Detect app entrypoints from framework conventions
  - [ ] Detect CLI entrypoints from `package.json` bins and scripts
  - [ ] Detect server entrypoints from common Node service patterns
  - [ ] Emit `reason`, `confidence`, and `evidence`
- [ ] `2.2` Extract commands and bootstrap actions
  - [ ] Parse scripts from `package.json`
  - [ ] Normalize run/test/build/dev commands
  - [ ] Attach command source path
- [ ] `2.3` Build lightweight graph edges
  - [ ] `contains`
  - [ ] `import`
  - [ ] `require`
  - [ ] `config-link`
  - [ ] `test-of`
- [ ] `2.4` Compute priority candidates
  - [ ] Manifest-based candidates
  - [ ] Entrypoint-based candidates
  - [ ] Fan-in based candidates
  - [ ] Framework-core candidates
  - [ ] Adjacent-test candidates
- [ ] `2.5` Compute defer candidates
  - [ ] Vendor-like paths
  - [ ] Generated paths
  - [ ] Build output
  - [ ] Large low-signal directories
- [ ] `2.6` Emit validated `signals.json`
  - [ ] Warnings for unsupported or ambiguous repos
  - [ ] Stable ordering for deterministic output

### Epic 3: Canonical Metadata Builder

Owner: `Codex`  
Milestone: `M2`  
Depends on: `2.1`, `2.3`, `2.4`, `2.5`, `0.4`

- [ ] `3.1` Assemble graph layer
  - [ ] Map files and directories into graph nodes
  - [ ] Map manifests into graph nodes
  - [ ] Map config files into graph nodes
  - [ ] Map test files into graph nodes
  - [ ] Preserve extracted edges
- [ ] `3.2` Assemble top-level repo metadata
  - [ ] Repo name and root
  - [ ] Repo shape
  - [ ] Primary languages
  - [ ] Detected ecosystems
  - [ ] Framework hints
- [ ] `3.3` Assemble reproducibility metadata
  - [ ] `run_id`
  - [ ] `snapshot_id`
  - [ ] `generated_at`
  - [ ] `included_paths`
  - [ ] `excluded_paths`
- [ ] `3.4` Derive human and agent views from the graph
  - [ ] `entrypoints`
  - [ ] `first_read_path`
  - [ ] `key_paths`
  - [ ] `critical_paths`
  - [ ] `defer_for_now`
  - [ ] `agent_hints`
- [ ] `3.5` Enforce inference boundary
  - [ ] Facts do not carry invented summaries
  - [ ] Inferences always carry `reason` and `confidence`
  - [ ] `entrypoints` and `key_paths` require `evidence`
  - [ ] Low-confidence content is omitted from default agent hints
- [ ] `3.6` Emit validated `context-index.json`
  - [ ] Deterministic field ordering
  - [ ] Deterministic item ordering
  - [ ] Stable serialization for snapshots

### Epic 4: Human-Facing Renderers

Owner: `Kimi`  
Milestone: `M3`  
Depends on: `3.4`, `3.6`  
Review gate: `Codex`

- [ ] `4.1` Implement `repo.map.md` renderer
  - [ ] Render repo snapshot
  - [ ] Render first-read path
  - [ ] Render key paths
  - [ ] Render entrypoints
  - [ ] Render critical paths
  - [ ] Render defer-for-now section
- [ ] `4.2` Implement `ONBOARDING.md` renderer
  - [ ] Render action-start summary
  - [ ] Render likely entrypoints
  - [ ] Render getting-oriented hints
  - [ ] Render safe early edit zones
  - [ ] Render defer-for-now section
- [ ] `4.3` Enforce markdown rendering rules
  - [ ] No new claims beyond canonical metadata
  - [ ] Confidence tags only where needed
  - [ ] Compact, skimmable output
- [ ] `4.4` Write outputs to `work/runs/<run-id>/outputs/`
  - [ ] `repo.map.md`
  - [ ] `ONBOARDING.md`

### Epic 5: Agent-Facing Output Path

Owner: `Codex`  
Milestone: `M4`  
Depends on: `3.6`

- [ ] `5.1` Define Phase 1 static agent output format
  - [ ] Decide initial target file layout
  - [ ] Keep it derived-only from `context-index.json`
  - [ ] Keep MCP out of initial implementation path
- [ ] `5.2` Implement minimal agent-facing renderer
  - [ ] Emit compact repo summary for first session
  - [ ] Emit key entrypoints and read path
  - [ ] Emit safe edit and watch-out hints
- [ ] `5.3` Integrate agent output into CLI
  - [ ] Optional flag to emit static agent view
  - [ ] Output path selection
  - [ ] Deterministic overwrite behavior

### Epic 6: CLI And Orchestration

Owner: `Codex`  
Milestone: `M3`  
Depends on: `0.2`, `1.1`, `2.6`, `3.6`, `4.4`

- [ ] `6.1` Implement top-level CLI command
  - [ ] Accept repo path
  - [ ] Accept include and exclude options
  - [ ] Accept debug artifact option
  - [ ] Accept output root option
- [ ] `6.2` Implement pipeline orchestration
  - [ ] Input stage
  - [ ] Scan stage
  - [ ] Extract stage
  - [ ] Comprehend stage
  - [ ] Render stage
- [ ] `6.3` Implement output writing behavior
  - [ ] Always emit `context-index.json`
  - [ ] Emit markdown outputs by default
  - [ ] Emit debug artifacts only when enabled
- [ ] `6.4` Implement error reporting
  - [ ] Friendly validation errors
  - [ ] Stage failure boundaries
  - [ ] Exit codes suitable for scripting
- [ ] `6.5` Preserve headless-friendly behavior
  - [ ] Do not auto-open browser by default
  - [ ] Print output locations

### Epic 7: Quality, Fixtures, And Regression Safety

Owner: `Minimax`  
Milestone: `M0` to `M4`  
Depends on: `0.1`, `0.4`  
Review gate: `Codex`

- [ ] `7.1` Create fixture repo matrix
  - [ ] Next.js fixture
  - [ ] React app fixture
  - [ ] Vite app fixture
  - [ ] Node CLI fixture
  - [ ] Express service fixture
  - [ ] Unsupported or noisy fixture for failure-path testing
- [ ] `7.2` Add contract tests
  - [ ] Repo input schema validation
  - [ ] Scan schema validation
  - [ ] Signals schema validation
  - [ ] `context-index.json` schema validation
- [ ] `7.3` Add stage-level fixture tests
  - [ ] Scan assertions
  - [ ] Entry point extraction assertions
  - [ ] Graph edge assertions
  - [ ] Defer-path assertions
- [ ] `7.4` Add renderer snapshot tests
  - [ ] `repo.map.md`
  - [ ] `ONBOARDING.md`
  - [ ] Canonical JSON snapshot
- [ ] `7.5` Add regression tests for confidence rules
  - [ ] Low-confidence omission in agent-facing sections
  - [ ] Evidence presence on `entrypoints`
  - [ ] Evidence presence on `key_paths`
- [ ] `7.6` Add performance baseline checks
  - [ ] Small repo baseline
  - [ ] Medium repo baseline
  - [ ] Large repo synthetic baseline

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

- [ ] `8.1` Define minimal HTML report scope
  - [ ] Confirm report is derived-only from canonical metadata
  - [ ] Limit scope to read-only exploration
- [ ] `8.2` Build minimal HTML renderer
  - [ ] Repo summary
  - [ ] First-read path
  - [ ] Key paths and entrypoints
  - [ ] Confidence indicators
- [ ] `8.3` Keep release gating separate
  - [ ] HTML is not a blocker for initial Phase 1 release

## Ready First

These tasks should start immediately:

- [ ] `0.1` Bootstrap repository implementation structure
- [ ] `0.2` Establish TypeScript runtime and build pipeline
- [ ] `0.4` Lock core schema types from whitepaper
- [ ] `7.1` Create fixture repo matrix

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

- [ ] `0.1` -> `0.2` -> `0.4`
- [ ] `1.1` -> `1.3` -> `1.4`
- [ ] `2.1` -> `2.3` -> `2.4`
- [ ] `3.1` -> `3.4` -> `3.6`
- [ ] `4.1` + `4.2`
- [ ] `6.1` -> `6.2` -> `6.3`
- [ ] `7.2` -> `7.4` -> `7.6`

Personnel-aware critical path:

- `Codex` path
  - `0.1` -> `0.2` -> `0.4` -> `3.1` -> `3.4` -> `3.6` -> `6.1` -> `6.2` -> `5.1` -> `5.2`
- `Kimi` path
  - `1.1` -> `1.3` -> `1.4` -> `2.1` -> `2.3` -> `2.4` -> `4.1` -> `4.2`
- `Minimax` support path
  - `7.1` -> `7.2` -> `7.4`

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
