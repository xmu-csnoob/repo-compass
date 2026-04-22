# Design Phase Whitepaper

This document defines what the post-Phase-1 design phase should produce if the
team follows the same operating model that worked for Phase 1: freeze intent
first, freeze contracts second, implement only after review gates are clear.

## 1. Purpose

The design phase exists to reduce implementation ambiguity before code starts.

It should answer:

- what problem the next phase is solving
- which user-visible outcomes matter
- what is explicitly in scope and out of scope
- what contracts must stay stable during implementation
- which risks need experiments before full build-out
- what counts as done for the next implementation phase

The design phase should not become:

- open-ended brainstorming without acceptance criteria
- architecture speculation disconnected from user outcomes
- pseudo-implementation hidden inside docs
- a substitute for later test plans and milestone ownership

## 2. Working Model

Follow the same pattern used in Phase 1:

1. foundation first
2. contracts second
3. artifact definitions third
4. repo and module boundaries fourth
5. kanban and milestone plan last

Gate rule:

- no implementation starts until the document set below is internally
  consistent
- schema-level changes after implementation starts require explicit doc updates
- every milestone must trace back to a design document section

## 3. Design-Phase Workstreams

### 3.1 Problem Framing

Produce a crisp statement of:

- target users
- acute pain point
- why Phase 1 is insufficient
- why the next phase is worth building now

### 3.2 Scope And Boundary Control

Define:

- must-have capabilities
- stretch goals
- explicit non-goals
- compatibility promises with Phase 1 artifacts

### 3.3 Architecture And Contract Freezing

Define:

- pipeline or subsystem decomposition
- stable interfaces between modules
- state model and persistence model
- upgrade or migration rules from Phase 1 outputs

### 3.4 Risk Reduction

Identify the few risks that deserve proof before full implementation:

- performance unknowns
- correctness ambiguity
- ecosystem coverage gaps
- UX or adoption uncertainty

Each risk should end with one of:

- spec decision
- spike result
- deferred item with explicit cost

### 3.5 Verification Planning

Decide before coding:

- invariant tests
- fixture strategy
- regression strategy
- performance baseline
- compatibility checks against Phase 1

### 3.6 Delivery Planning

Translate design into:

- epics
- milestone gates
- owner recommendations
- definition of done

## 4. Whitepaper Document Set

If the team wants to mirror the Phase 1 development style, the design phase
should generate this document set.

### Required

- a foundation document
  - in this repo: `docs/phase2-foundation.md`
  - product definition, value boundary, scope, constraints, success condition
- a contracts document
  - in this repo: `docs/phase2-contracts.md`
  - shared language, schemas, lifecycle rules, compatibility requirements
- an artifact-spec document
  - in this repo: `docs/phase2-artifact-spec.md`
  - every durable output, its consumer, backing fields, and done criteria
- a repo-structure document
  - in this repo: `docs/phase2-repo-structure.md`
  - code layout, ownership boundaries, separation rules
- `docs/design-phase-kanban.md`
  - execution plan, milestones, epics, acceptance gates

### Strongly Recommended

- a risk register
  - in this repo: `docs/phase2-risk-register.md`
  - top technical and product risks, spike plan, exit criteria
- a decision log
  - in this repo: `docs/phase2-decisions.md`
  - ADR-style record of major design decisions and rejected alternatives
- a review document
  - in this repo: `docs/phase2-review.md`
  - external critique of the spec before implementation begins
- a test-strategy document
  - in this repo: `docs/phase2-test-strategy.md`
  - fixture plan, compatibility matrix, performance and regression coverage

Naming rule:

- the design phase needs these document roles, not one exact filename prefix
- repo-specific naming such as `phase2-*` is valid as long as the mapping is explicit

## 5. Minimum Content Of Each Whitepaper

Every design-phase whitepaper should answer four questions clearly:

1. what decision is being made
2. why that decision is defensible
3. what is intentionally excluded
4. how implementation will be judged later

Weak documents usually fail because they only describe structure without
decision pressure. Each whitepaper should therefore include:

- a purpose section
- explicit rules or contracts
- failure modes or risks
- concrete acceptance criteria

## 6. Exit Criteria For Design Phase

The design phase is complete only when all of the following are true:

- the next-phase problem statement is stable
- in-scope and out-of-scope lines are explicit
- core contracts are frozen enough for parallel work
- artifact definitions are specific enough for snapshot-style verification
- the repo/module structure is clear enough to avoid ownership collisions
- top risks are either resolved or deliberately deferred
- the kanban can be executed without reopening first-principles debates

## 7. Relationship To Phase 1

Phase 1 established a working pattern:

- stable foundation document
- explicit contracts
- explicit artifact spec
- explicit structure rules
- explicit kanban

The design phase should reuse that pattern, but with a different target:

- Phase 1 optimized for shipping a deterministic product slice
- the design phase optimizes for reducing ambiguity before the next product
  slice starts
