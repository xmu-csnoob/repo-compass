# Phase 3 Agent Guide

This document defines the working rules for any agent participating in Phase 3
implementation.

It is not part of the frozen Phase 3 design pack. It exists to ensure all
agents implement against the same source of truth.

## 1. Primary Rule

All Phase 3 implementation work must treat the following four documents as the
authoritative design whitepaper:

- `docs/phase3/foundation.md`
- `docs/phase3/contracts.md`
- `docs/phase3/artifact-spec.md`
- `docs/phase3/repo-structure.md`

If implementation ideas, local notes, or agent discussion conflict with those
four documents, the four documents win.

## 2. Relationship To `AGENTS.md`

This guide is Phase 3-specific.

Global multi-agent coordination rules still come from:

- `AGENTS.md`

This means all Phase 3 agents must still follow:

- worktree-isolated development
- branch naming rules
- conflict avoidance rules
- shared-contract caution rules

This document adds Phase 3-specific implementation discipline on top of those
global rules.

## 3. Frozen Phase 3 Planning Set

For Phase 3, the frozen planning set is exactly:

- `docs/phase3/foundation.md`
- `docs/phase3/contracts.md`
- `docs/phase3/artifact-spec.md`
- `docs/phase3/repo-structure.md`

Rules:

- do not silently redefine Phase 3 scope outside those files
- do not treat ad hoc chat decisions as equal to the frozen planning set
- do not implement around ambiguity by inventing new behavior without updating
  the frozen documents first

## 4. Implementation Priorities

Phase 3 work should stay aligned with the intent-layer goal:

- add a bounded Stage B' directory classification layer
- keep `StructureScan` responsible for observation, not directory purpose
- make `extract/` consume `IntentMap` rather than own repo-specific path hacks
- keep `context-index.json` canonical
- keep LLM usage optional and behind the same typed interface as static
  classification

Phase 3 is not:

- a general rewrite of comprehension
- a renderer-driven fix
- a repo-specific FastAPI patch

## 5. Required Phase 3 Decisions Already Frozen

Agents should treat these Phase 3 decisions as settled unless the frozen design
pack is explicitly changed:

- `IntentMap` is an additive intermediate artifact
- current artifact family version remains `2.0`
- default `intent_depth` is `2`
- Phase 3 first slice uses suppression, not re-ranking, for primary Python
  entrypoint extraction from `example-fixtures` and `test-infrastructure`
- `intent-map.json` is an internal/debug artifact, not a public canonical output
- `fastapi/fastapi` is the primary real-repo validation target

## 6. Scope Discipline

Before making changes, each agent should identify which Phase 3 area the change
belongs to:

- contracts
- classify
- extract
- tests
- docs

Rules:

- if the change affects contracts or frozen behavior, check the four whitepaper
  docs first
- if the change requires behavior not described there, update the docs before or
  alongside the code
- do not smuggle Phase 4 ideas into Phase 3 implementation

## 7. Contract Discipline

Phase 3 introduces new concepts, but contract changes must remain controlled.

Rules:

- treat `src/contracts/` as read-only unless the assigned work explicitly
  includes contract updates
- prefer additive changes over semantic rewrites
- do not use implementation convenience as a reason to weaken contract clarity
- if code and docs disagree, resolve the disagreement explicitly rather than
  letting drift persist

## 8. Expected Module Boundaries

Agents should preserve these module boundaries:

- `scan/` observes filesystem structure and path roles
- `classify/` determines directory purpose
- `extract/` consumes `IntentMap` when promoting signals
- `comprehend/` builds canonical understanding
- `render/` formats derived outputs only

Rules:

- do not move directory intent logic into renderers
- do not bury directory-purpose rules directly inside extraction loops when they
  belong in `classify/`
- do not create a second hidden interpretation path outside the typed pipeline

## 9. Validation Discipline

Phase 3 implementation is not complete until it is validated against:

- `fastapi/fastapi` as the primary fixture-heavy library repo
- at least one structurally different regression target

Agents should optimize for:

- fewer wrong primary entrypoints
- less fixture pollution in read-first and key-path sections
- preserved usefulness on non-fixture-heavy repos

## 10. LLM Discipline

LLM-assisted classification is optional in Phase 3.

Rules:

- no Phase 3 code path may require LLM availability
- any future LLM classifier must implement the same typed interface as the
  static classifier
- LLMs may interpret directory evidence, but they must not replace
  deterministic scan facts

## 11. Practical Workflow

Recommended workflow for a Phase 3 agent:

1. Read `AGENTS.md`.
2. Read the four frozen Phase 3 whitepaper docs.
3. Identify which module boundary the task belongs to.
4. Check whether the requested behavior is already frozen in the docs.
5. Implement only within that boundary.
6. Validate against fixtures and the required real-repo target.
7. If the implementation exposes a gap in the frozen design, update the docs
   explicitly instead of improvising silently.

## 12. Non-Negotiable Rule

No Phase 3 agent should treat local intuition, convenience, or repo-specific
patches as a substitute for the frozen four-document whitepaper.
