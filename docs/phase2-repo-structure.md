# Phase 2 Repository Structure

This document defines the minimum project layout for Phase 2.

## Top-Level Layout

```text
docs/
src/
tests/
work/
```

## 1. `src/`

Purpose:

- product code for the Phase 2 pipeline

Responsibilities:

- input normalization
- structure scanning
- signal extraction
- comprehension building
- artifact rendering
- freshness support after quality gates
- shared contracts and types

Recommended subdirectories:

```text
src/
  contracts/
  input/
  scan/
  extract/
  comprehend/
  render/
  freshness/
  cli/
```

Rules:

- `src/` contains implementation, not run outputs or planning notes
- Phase 2 should extend the existing pipeline layout rather than introduce a
  competing architecture
- Python-specific logic should stay in clearly bounded helpers rather than leak
  through every stage implicitly

## 2. `tests/`

Purpose:

- verification of contracts, extractors, renderers, and Python quality gates

Responsibilities:

- unit tests for schema and normalization logic
- fixture-based tests for scan and extraction
- regression tests for ranking, confidence, and Python noise suppression
- snapshot tests for markdown renderers
- compatibility tests for canonical metadata evolution
- end-to-end evaluation for Python repositories

Recommended subdirectories:

```text
tests/
  fixtures/
    js/
    python/
  contracts/
  scan/
  extract/
  comprehend/
  render/
  freshness/
  performance/
```

Rules:

- each pipeline stage should have fixture-driven tests before behavior expands
- Python support is not complete until production-style Python fixtures exist
- freshness tests should come after canonical quality tests, not before

## 3. `docs/`

Purpose:

- stable design and contract documentation for humans

Responsibilities:

- Phase 2 foundation
- Phase 2 contracts
- Phase 2 artifact definitions
- Phase 2 repository structure definition
- supporting Phase 2 risk, review, and test strategy docs

Expected files for Phase 2:

- `docs/phase2-foundation.md`
- `docs/phase2-contracts.md`
- `docs/phase2-artifact-spec.md`
- `docs/phase2-repo-structure.md`

Supporting files:

- `docs/phase2-risk-register.md`
- `docs/phase2-test-strategy.md`
- `docs/phase2-decisions.md`
- `docs/phase2-review.md`
- `docs/phase2-kanban.md`

Rule:

- `docs/` is for durable design guidance, not temporary run state

## 4. `work/`

Purpose:

- local workspace for generated run outputs

Responsibilities:

- canonical metadata output
- rendered markdown outputs
- optional debug artifacts
- optional freshness state written only after implementation requires it

Recommended subdirectories:

```text
work/
  runs/
```

Example run layout:

```text
work/runs/<run-id>/
  input.json
  context-index.json
  outputs/
    ONBOARDING.md
    repo.map.md
    agent-start.md
```

Optional debug artifacts:

```text
work/runs/<run-id>/
  scan.json
  signals.json
  comprehension.json
```

Optional freshness artifacts:

```text
work/runs/<run-id>/
  freshness.json
```

Rule:

- `work/` owns mutable run outputs only

## 5. Separation Rules

- `src/` owns product logic
- `tests/` owns verification
- `docs/` owns durable design intent
- `work/` owns mutable run outputs

Non-negotiable:

- do not write generated artifacts into `src/` or `docs/`
- do not store design contracts only in code comments
- do not let run output shape dictate core schema design
- do not let freshness implementation redefine canonical metadata semantics

## 6. Phase 2 Structural Guidance

### 6.1 Python Support Placement

Python support should be added through:

- scan-time manifest and path classification helpers
- extraction-time signal helpers
- comprehension-time ranking rules

It should not require:

- a separate Python-only pipeline
- Python-specific renderers
- a second canonical schema

### 6.2 Agent Startup Rendering

`agent-start.md` should be owned by renderer code that:

- reads canonical metadata only
- enforces the token budget contract
- applies the fixed overflow trimming policy

It should not:

- introduce its own inference layer
- bypass canonical warnings or confidence logic

### 6.3 Freshness Placement

Freshness logic should live in a bounded module that:

- decides whether regeneration is needed
- records stale versus fresh versus unknown state
- triggers canonical rebuilds

It should not:

- become entangled with ranking heuristics
- silently mutate output semantics
