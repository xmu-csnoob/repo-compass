# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

repo-compass is a deterministic repo-analysis tool that generates navigation artifacts (ONBOARDING.md, repo.map.md, context-index.json) for unfamiliar codebases. It uses a linear 5-stage pipeline with Zod-validated schemas at every boundary. Design principle: prefer deterministic static signals first; LLM is optional, never the primary source of truth.

## Development Commands

| Task | Command |
|------|---------|
| Build | `npm run build` (compiles `src/` → `dist/` via `tsconfig.build.json`) |
| Type check | `npm run typecheck` (full project including tests) |
| Clean | `npm run clean` (removes `dist/`) |
| Run all tests | `npm test` |
| Watch mode | `npm run test:watch` |
| Run single test file | `npx vitest run <path>` |
| Run tests matching pattern | `npx vitest run -t "<pattern>"` |
| Run CLI | `node dist/cli/index.js <repo-path> [--debug] [--freshness-mode watch\|ci]` |

Requires Node.js >= 20. ESM only (`"type": "module"`).

## Pipeline Architecture

The pipeline is strictly linear — not an agent swarm. Each stage validates its output with Zod before the next stage consumes it.

| Stage | Module | Reads | Writes | Key behavior |
|-------|--------|-------|--------|-------------|
| A: Input | `src/input/` | external request | validated `RepoInput` | Normalizes paths, applies defaults, validates with `repoInputSchema` |
| B: Scan | `src/scan/` | `RepoInput` | `StructureScan` | Walks filesystem (respects `.gitignore` + custom excludes), classifies paths by `role`, detects languages/ecosystems/frameworks |
| C: Extract | `src/extract/` | `StructureScan` | `SignalExtraction` | Extracts entrypoints, commands, import edges, priority/defer candidates |
| D: Comprehend | `src/comprehend/` | `SignalExtraction` | `Comprehension` | Builds graph, ranks key paths, generates first-read-path, agent hints |
| E: Render | `src/render/` | `Comprehension` | `ContextIndex` + markdown/HTML | Renders canonical JSON and derived views (ONBOARDING.md, repo.map.md, agent-start.md, index.html) |

The CLI (`src/cli/index.ts`) orchestrates the full pipeline and writes artifacts to `work/runs/<run-id>/`.

## Module Breakdown

- **`src/contracts/`** — All Zod schemas, TypeScript types, and validation logic. This is the source of truth for every data boundary in the pipeline. Schema version is `"2.0"`.
- **`src/shared/`** — Low-level utilities: filesystem helpers (`fs.ts`), ignore-pattern loading (`ignore.ts`), path resolution (`paths.ts`). No business logic.
- **`src/freshness/`** — Incremental-scan support. Computes path signatures (mtime + size), detects changes across runs. Modes: `off` (no state), `watch` (track changes), `ci` (verify freshness).
- **`src/cli/index.ts`** — Entry point. Parses args, builds `RepoInput`, runs the pipeline, writes artifacts. Supports `--debug` to emit intermediate JSONs (scan.json, signals.json, comprehension.json).

## Key Data Contracts

All schemas live in `src/contracts/schemas.ts` and types in `src/contracts/types.ts`. Key invariants enforced everywhere:

- Every artifact carries `schema_version: "2.0"`
- Every derived claim carries `reason` and `confidence` (`high|medium|low`)
- `context-index.json` is canonical; markdown renderers derive from it, never rebuild logic independently
- `path.role`: `source|config|docs|tests|generated|vendor|build|unknown`
- `key_paths.role`: `entry|core|config|workflow|test|docs`
- `entrypoints.kind`: `app|cli|server|library|test-harness|build`
- `repo_shape`: `application|library|service|tool|mixed`

Do not expand enums without updating `src/contracts/enums.ts`, `src/contracts/schemas.ts`, and `docs/contracts.md`.

## Directory Layout

```
src/
  contracts/    # Zod schemas, types, enums, validation
  input/        # input normalization (Stage A)
  scan/         # structure scanning (Stage B) — Node.js + Python detection
  extract/      # signal extraction (Stage C) — entrypoints, imports, commands
  comprehend/   # comprehension building (Stage D) — graph, key paths, hints
  render/       # artifact rendering (Stage E) — JSON + markdown + HTML
  freshness/    # incremental scan state
  shared/       # fs, ignore, path utilities
  cli/          # CLI entry point and orchestration
  index.ts      # public API exports
tests/
  fixtures/     # 13+ sample repos for fixture-driven tests (see tests/fixtures/README.md)
  contracts/    # schema compatibility and validation tests
  scan/         # structure scan assertions against fixtures
  extract/      # signal extraction assertions
  comprehend/   # comprehension building tests
  render/       # snapshot tests for markdown/HTML output
  freshness/    # freshness system tests
  shared/       # utility tests
  performance/  # baseline performance tests
docs/           # durable design contracts (do not store run state here)
work/           # mutable run state only (never checked-in)
  runs/<run-id>/
    input.json → context-index.json
    outputs/ONBOARDING.md, repo.map.md, context-index.json, index.html, agent-start.md
```

## Testing Approach

- Fixture-driven: each pipeline stage has tests against realistic repos in `tests/fixtures/` before behavior expands.
- Snapshot tests: `tests/render/snapshots/` holds expected output for markdown/JSON renders.
- Test layout mirrors `src/` layout under `tests/`.
- Vitest config excludes `tests/fixtures/**` from test discovery.

## Non-Negotiable Separation Rules

- `src/` — product logic only; never run outputs or planning notes
- `docs/` — durable design intent only; never temporary run state
- `work/` — mutable run state only; never checked-in source or design docs
- Source code must never depend on mutable agent memory
- Artifacts must be reproducible from filesystem inputs alone
