# Phase 3 Foundation

## 1. Project Definition

`repo-compass` Phase 3 builds on the current Phase 2 contract and pipeline
assumptions with a new directory-intent layer so repo navigation can reason
about folder purpose before promoting file-level signals into startup guidance.

Phase 3 product shape:

- one canonical metadata artifact: `context-index.json`
- one new internal intent artifact: `intent-map.json`
- two human views derived from canonical metadata: `ONBOARDING.md` and
  `repo.map.md`
- one fixed-size agent startup view derived from canonical metadata:
  `agent-start.md`
- one optional HTML report derived from canonical metadata

Phase 3 design principles:

- `context-index.json` remains the canonical output for downstream consumers
- directory purpose should be inferred before file-level entrypoints are trusted
- deterministic evidence remains primary; LLM classification is optional
- new intent logic must plug into the existing linear pipeline, not create a
  parallel interpretation path
- phase value is measured by fewer first-session wrong turns on real repos

Phase 3 depends on these Phase 2 behaviors remaining available:

- `StructureScan` continues to provide path inventory, path roles, manifest
  detection, languages, ecosystems, and framework hints
- `SignalExtraction` remains the stage that promotes entrypoints, commands, and
  edges
- `context-index.json` remains canonical for all renderers
- renderers continue deriving output from canonical metadata only

## 2. Value Boundary

Phase 3 should answer these questions better than Phase 2:

- which top-level or near-top-level folders are core product surfaces
- which folders are examples, tests, tooling, docs, or config
- which folders should influence startup guidance versus be isolated as support
  material
- when local file signals should be discounted because their enclosing
  directory intent is non-primary

This tool is not:

- a whole-repo semantic architecture engine
- a replacement for deterministic scan or contract validation
- an LLM-first summarizer
- a guarantee that every repo can be perfectly classified at arbitrary depth

Phase 3 success condition:

- examples and tests stop flooding primary Python entrypoint output
- startup guidance improves on repos with large docs or fixture corpora
- directory-level purpose becomes a first-class pipeline concept
- the system stays credible with no LLM configured

## 3. Product Positioning

Phase 3 positioning:

> Intent-aware repository navigation for humans and agents, built around folder
> purpose instead of raw file coincidence.

The motivating failure is not "Python support is incomplete". It is:

> repos with many source-like fixtures cause Phase 2 to over-promote local file
> signals into global repo claims.

`fastapi/fastapi` is the validation repo because it exposes a general problem:

- `docs_src/` contains many standalone FastAPI tutorial apps
- `tests/` contains many test-local app surfaces
- the real library code under `fastapi/` is structurally smaller than the
  example corpus
- file-level heuristics alone cannot tell which surfaces are primary

## 4. Phase 3 Scope

### In Scope

- a new Stage B' module for directory intent classification
- folder-level intent recognition for bounded recursive depth
- additive contracts for directory intent and intent maps
- static classification as the required implementation path
- optional LLM classification interface, disabled by default
- Stage C consumption of intent for Python signal filtering
- fixture coverage and real-repo validation for intent-aware extraction

### Out Of Scope

- replacing Phase 2 canonical output contracts
- full file-level intent classification
- mandatory LLM dependency
- rewriting Stage D comprehension policy in the first slice
- broad runtime execution or AST-heavy semantic reconstruction

Phase 4 direction, but not Phase 3 scope:

- making Stage D centrality, ranking, and graph weighting directly consume
  directory intent

## 5. Technology Decision

Phase 3 implementation stack remains TypeScript and Node.js.

Rationale:

- preserves the Phase 2 contract and test infrastructure
- keeps deterministic scan, classification, extraction, and rendering in one
  stack
- allows the LLM-assisted path to be additive rather than architectural
  replacement

## 6. Performance and Evolution Constraints

Phase 3 should preserve bounded behavior.

Target constraints:

- directory intent classification should scale with classified directories, not
  raw file count
- default classification depth should remain bounded at `2`
- no-LLM execution must remain the default path
- LLM classification, when added later, must operate on summarized directory
  evidence packs rather than whole-repo raw code

## 7. Metadata-First Architecture

Phase 3 remains a linear pipeline.

End-to-end flow:

1. repo input
2. structure scan
3. directory intent classification
4. signal extraction
5. comprehension build
6. artifact rendering
7. optional freshness update

### 7.1 Pipeline Stages

#### Stage A: Repo Input

Responsibilities:

- resolve repo root
- normalize options
- preserve include and exclude semantics
- default `intent_depth` to `2`
- default `use_llm_classify` to `false`

#### Stage B: Structure Scan

Responsibilities:

- enumerate files and directories
- classify path roles
- detect manifests, languages, ecosystems, and framework hints

#### Stage B': Directory Intent Classification

Responsibilities:

- classify important directories by repo purpose
- attach confidence, reason, and method
- remain bounded by configured depth
- expose a stable `IntentMap` contract to downstream consumers

#### Stage C: Signal Extraction

Responsibilities:

- continue extracting file-level entrypoints, commands, and edges
- consult `IntentMap` before promoting local file signals into primary
  entrypoints
- suppress example and test fixture surfaces from the main Python entrypoint
  set in the first Phase 3 slice

Phase 3 decision:

- the first implementation commits to suppression, not re-ranking, for files
  that resolve to `example-fixtures` or `test-infrastructure` during primary
  Python entrypoint extraction
- re-ranking is a possible later refinement, but it is not the Phase 3 default
  behavior

#### Stage D: Comprehension Build

Responsibilities:

- continue building canonical repo understanding from upstream artifacts
- remain the sole source for rendering inputs

Phase 3 note:

- Stage D is intentionally not rewritten in this slice
- future phases may use directory intent to lower centrality or ranking weight
  for example and test surfaces
- until then, Phase 3 value comes primarily from better Stage C filtering

#### Stage E: Render

Responsibilities:

- render views from canonical metadata only
- avoid creating a second inference layer

## 8. Core Product Move

Phase 3 does not try to "understand every file better". It raises the unit of
judgment from file to folder.

Phase 3 claim:

- the first navigation question is usually "what are these directories for"
  before it is "what does this file do"

This lets `repo-compass` become an intent-aware navigator instead of a pure
file-signal collector.

## 9. Validation Repositories

Phase 3 should validate against at least:

- `fastapi/fastapi` as the primary fixture-heavy library repo target
- one structurally different repo to prove the new intent layer does not
  over-suppress normal surfaces

The second target should be selected before implementation starts and should
ideally exercise one of:

- monorepo or mixed-repo directory layouts
- application-led repo structures
- tooling-heavy top-level layouts
