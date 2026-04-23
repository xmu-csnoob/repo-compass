# Phase 3 Repository Structure

This document defines the minimum project layout for Phase 3.

## Top-Level Layout

```text
docs/
src/
tests/
work/
```

## 1. `src/`

Purpose:

- product code for the Phase 3 pipeline

Recommended subdirectories:

```text
src/
  contracts/
  input/
  scan/
  classify/
  extract/
  comprehend/
  render/
  freshness/
  cli/
```

Phase 3 addition:

- `classify/` owns directory-intent classification and related helpers

Rules:

- `scan/` continues to own filesystem inventory and path roles
- `classify/` owns folder-purpose inference
- `extract/` consumes intent; it should not become the home for implicit
  directory-purpose rules

## 2. `tests/`

Purpose:

- verification of contracts, classifier behavior, extraction regression, and
  output quality

Recommended subdirectories:

```text
tests/
  fixtures/
  contracts/
  scan/
  classify/
  extract/
  comprehend/
  render/
  freshness/
  performance/
```

Phase 3 requirements:

- `tests/classify/` should exist for directory intent classification coverage
- extraction tests should prove intent-aware filtering on fixture-heavy repos
- `fastapi/fastapi` should be part of release gating as the primary real-repo
  validation target
- one additional structurally different regression target should be part of
  release gating to catch over-suppression

## 3. `docs/`

Purpose:

- stable design and contract documentation for humans

Phase 3 design pack:

- `docs/phase3/foundation.md`
- `docs/phase3/contracts.md`
- `docs/phase3/artifact-spec.md`
- `docs/phase3/repo-structure.md`

Supporting documents may evolve separately, but the design pack above is the
frozen Phase 3 planning set.

Rule:

- `docs/` owns durable design intent, not run outputs or ad hoc planning notes

## 4. `work/`

Purpose:

- local workspace for generated run outputs

Phase 3 run layout direction:

```text
work/runs/<run-id>/
  input.json
  scan.json
  context-index.json
  debug/
    intent-map.json
  outputs/
    ONBOARDING.md
    repo.map.md
    agent-start.md
```

Rules:

- `intent-map.json` is an internal intermediate artifact
- by default it should be emitted only when debug or equivalent developer-mode
  output is enabled
- if written, it should live under a debug-oriented path rather than beside
  canonical user-facing artifacts
- `work/` remains the only home for mutable run outputs

## 5. Separation Rules

- `scan/` owns observation
- `classify/` owns purpose inference
- `extract/` owns signal extraction from observed and classified inputs
- `comprehend/` owns canonical understanding
- `render/` owns derived output formatting

Non-negotiable:

- do not move folder-purpose logic into renderer text templates
- do not let `extract/` accumulate hidden repo-specific path exceptions when the
  logic belongs in `classify/`
- do not let a future LLM path bypass the same typed interface used by static
  classification

## 6. Phase 3 Structural Guidance

### 6.1 Intent Classification Placement

Intent classification should be added through:

- `src/classify/index.ts` for orchestration
- `src/classify/engine.ts` for rule evaluation
- `src/classify/rules.ts` for declarative rule definitions
- optional future LLM adapter behind the same interface

Wave 0 freeze:

- the typed classifier seam is defined by `docs/phase3/contracts.md`
- `DirectoryEvidence` and `DirectoryClassifier` names are frozen for parallel
  implementation work
- `src/classify/` may change internal helper structure later, but it must not
  redefine the frozen interface without updating the Phase 3 design pack

It should not require:

- a second extraction pipeline
- renderer-side intent inference
- a replacement for `StructureScan`

Phase 3 expectation:

- the static classifier is the required implementation
- a future LLM classifier must implement the same interface rather than create
  a separate code path

`DirectoryEvidence` should carry at minimum:

- `path` as the repo-relative directory path
- `children` as immediate child file and directory names
- `manifest_hints` as manifests found in or structurally linked to the directory
- `parent_intent` as the nearest already-classified ancestor intent, if any

### 6.2 Extraction Placement

Intent-aware suppression and ranking changes should live in `extract/` only as
consumption logic.

`extract/` should:

- resolve file intent from classified ancestors
- decide whether certain local signals should be promoted
- preserve Phase 2 behavior when intent lookup returns `unknown`

`extract/` should not:

- reinvent directory-purpose classification from scratch
- suppress non-target surfaces by hidden repo-specific path exceptions

### 6.3 Artifact Placement

If `intent-map.json` is written, it should live under `work/runs/<run-id>/`
with other generated artifacts and never under `docs/` or `src/`.
