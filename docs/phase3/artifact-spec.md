# Phase 3 Artifact Specification

This document defines the Phase 3 outputs and removes ambiguity about what
"done" looks like.

Common rules:

- all user-facing artifacts still derive from canonical metadata
- all paths are repo-relative
- Phase 3 improves navigation by changing upstream interpretation, not by adding
  ad hoc renderer narration
- `intent-map.json` may exist as an intermediate artifact without replacing
  canonical outputs

## 1. ONBOARDING.md

### Purpose

- help a new human contributor or coding agent start safely and quickly

### Phase 3 Role

`ONBOARDING.md` remains the human action-start view, but it should now benefit
from intent-aware filtering.

It should answer:

- where to start reading
- which entrypoints and commands actually matter to the repo's primary surface
- which source areas are safe early edit zones
- which folders or surfaces should be deferred

### Required Backing Behavior

- example and test fixture directories should not dominate `Likely Entrypoints`
- startup guidance should reflect primary repo surfaces, not tutorial corpora
- the first Phase 3 slice achieves this by suppressing fixture-derived primary
  Python entrypoints rather than merely lowering their rank

## 2. repo.map.md

### Purpose

- provide a navigation-first map of the repository

### Phase 3 Role

`repo.map.md` remains the navigation view.

It should answer:

- which repo surfaces appear primary
- which paths matter most for orientation
- which areas are supporting material
- which areas can wait

### Required Backing Behavior

- `First Read Path` should not be flooded by example or test fixture files
- `Key Paths` should surface core library or runtime paths before fixture
  surfaces
- the first Phase 3 slice may still expose fixture surfaces indirectly through
  canonical ranking, but it must not let them dominate the primary navigation
  sections

## 3. context-index.json

### Purpose

- remain the canonical structured comprehension artifact

### Phase 3 Role

`context-index.json` remains the single source of truth for renderers and
integrations.

Phase 3 requirement:

- intent-aware extraction may improve ranking and entrypoint selection, but the
  resulting fields must still be evidence-backed and deterministic by default

Potential Phase 3 additive direction:

- canonical metadata may later expose intent summaries if there is clear
  downstream value
- the first implementation does not require public exposure of the full
  `IntentMap`

## 4. agent-start.md

### Purpose

- provide a fixed-size startup contract for coding agents

### Phase 3 Role

`agent-start.md` remains the compressed startup view.

It should answer:

- what the agent should read first
- which entrypoints and commands matter most
- what is likely support material rather than the primary product surface

### Required Backing Behavior

- intent-aware filtering should materially reduce wrong starts on fixture-heavy
  repos
- the artifact should become more selective, not longer

## 5. intent-map.json

### Purpose

- provide the directory-intent artifact produced by Stage B'

### Primary Consumers

- Stage C extraction
- tests and debug workflows
- future LLM-enhanced classification paths

### Role in Phase 3

`intent-map.json` is an intermediate artifact, not the canonical public repo
  contract.

It should contain:

- bounded directory entries
- intent, confidence, reason, and method
- enough context for deterministic downstream lookup

### Output Rules

- default depth is `2`
- artifact size should scale with classified directories, not all files
- default CLI behavior should not write `intent-map.json` unless debug or an
  equivalent explicit developer mode is enabled
- if written, `intent-map.json` should be treated as an intermediate artifact,
  not a public user-facing contract

## 6. Artifact Relationship Rules

- `context-index.json` remains canonical
- `intent-map.json` is an upstream internal artifact for interpretation
- markdown and startup views must not invent claims not represented in canonical
  metadata
- if intent-aware logic influences user-facing ranking, that influence must flow
  through canonical metadata rather than renderer-local inference

## 7. Phase 3 Done Condition

Phase 3 output quality is acceptable when:

- `fastapi/fastapi` no longer floods user-facing entrypoint and read-first
  sections with `docs_src/**` and `tests/**`
- real core surfaces remain visible
- agent startup views become more selective without losing deterministic trust
- at least one structurally different regression target continues to produce
  credible navigation without over-suppression

Recommended validation targets:

- `fastapi/fastapi` as the primary fixture-heavy library repo
- one non-FastAPI regression repo chosen before implementation to validate that
  the new intent layer does not accidentally suppress primary product surfaces
