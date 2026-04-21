# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

repo-compass is currently in Phase 1 planning and specification. No implementation code exists yet — only design contracts in `docs/`. The implementation (`src/`, `tests/`) is pending.

## What This Tool Does

Generates three entry artifacts for unfamiliar codebases:
- `ONBOARDING.md` — action-start guide for new contributors/agents
- `repo.map.md` — navigation-first repository map
- `context-index.json` — canonical structured comprehension model (machine-readable; markdown files are derived views of this)

Design principle: prefer deterministic static signals first; LLM is optional, never the primary source of truth.

## Planned Directory Layout

```
src/
  contracts/    # shared schemas and types
  input/        # input normalization (Stage A)
  scan/         # structure scanning (Stage B)
  extract/      # signal extraction (Stage C)
  comprehend/   # comprehension building (Stage D)
  render/       # artifact rendering (Stage E)
  cli/
tests/
  fixtures/     # sample repos for fixture-based tests
  contracts/
  scan/
  extract/
  comprehend/
  render/
docs/           # durable design contracts (do not store run state here)
work/           # mutable run state only (never mix into src/ or docs/)
  runs/<run-id>/
    input.json → scan.json → signals.json → comprehension.json
    outputs/ONBOARDING.md, repo.map.md, context-index.json
    status.json
  logs/
  claims/
  scratch/
```

## Pipeline Architecture

Linear pipeline with five stages — not an agent swarm:

| Stage | Module | Input | Output |
|-------|--------|-------|--------|
| A: Repo Input | `src/input/` | external request | `input.json` |
| B: Structure Scan | `src/scan/` | `input.json` | `scan.json` |
| C: Signal Extraction | `src/extract/` | `scan.json` | `signals.json` |
| D: Comprehension Build | `src/comprehend/` | `signals.json` | `comprehension.json` |
| E: Artifact Rendering | `src/render/` | `comprehension.json` | outputs |

## Data Contract Rules

All contracts are defined in `docs/contracts.md`. Key invariants:

- Every artifact carries `schema_version`
- Every derived claim carries `reason` and `confidence` (`high|medium|low`)
- `context-index.json` is canonical; markdown renderers must derive from it, not rebuild logic independently
- Markdown outputs must not add claims that don't exist in the canonical model

**Frozen Phase 1 enums** — do not expand without updating `docs/contracts.md`:
- `path.role`: `source|config|docs|tests|generated|vendor|build|unknown`
- `key_paths.role`: `entry|core|config|workflow|test|docs`
- `entrypoints.kind`: `app|cli|server|library|test-harness|build`
- `confidence`: `high|medium|low`
- `repo_shape`: `application|library|service|tool|mixed`

## Testing Approach

Each pipeline stage should have fixture-driven tests before behavior expands. Test layout mirrors `src/` layout under `tests/`. Snapshot tests are expected for artifact rendering output.

## Non-Negotiable Separation Rules

- `src/` — product logic only; never run outputs or planning notes
- `docs/` — durable design intent only; never temporary run state
- `work/` — mutable run state only; never checked-in source or design docs
- Source code must never depend on mutable agent memory
- Artifacts must be reproducible from filesystem inputs alone
