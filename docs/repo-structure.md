# Repository Structure

This document defines the minimum project layout for Phase 1.

## Top-Level Layout

```text
docs/
src/
tests/
work/
```

## 1. `src/`

Purpose:

- product code for the Phase 1 pipeline

Responsibilities:

- input normalization
- structure scanning
- signal extraction
- comprehension building
- artifact rendering
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
  cli/
```

Rule:

- `src/` contains implementation, not run outputs or planning notes

## 2. `tests/`

Purpose:

- verification of contracts, extractors, and artifact rendering

Responsibilities:

- unit tests for schema and normalization logic
- fixture-based tests for scan and extraction
- regression tests for ranking and confidence behavior
- snapshot tests for markdown renderers

Recommended subdirectories:

```text
tests/
  fixtures/
  contracts/
  scan/
  extract/
  comprehend/
  render/
```

Rule:

- each pipeline stage should have fixture-driven tests before behavior expands

## 3. `docs/`

Purpose:

- stable design and contract documentation for humans

Responsibilities:

- Phase 1 foundation
- core contracts
- artifact definitions
- repository structure definition

Expected files for Phase 1:

- `docs/phase1-foundation.md`
- `docs/contracts.md`
- `docs/artifact-spec.md`
- `docs/repo-structure.md`

Rule:

- `docs/` is for durable design guidance, not temporary run state

## 4. `work/`

Purpose:

- local workspace for generated run outputs

Responsibilities:

- canonical metadata output
- rendered markdown outputs
- optional debug artifacts

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
```

Optional debug artifacts:

```text
work/runs/<run-id>/
  scan.json
  signals.json
  comprehension.json
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
