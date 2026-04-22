# Phase 2 Artifact Specification

This document defines the Phase 2 outputs and removes ambiguity about what
"done" looks like.

Common rules:

- all artifacts derive from the same canonical metadata model
- all paths are repo-relative
- markdown should stay compact and operational
- `agent-start.md` should optimize for startup usefulness, not narrative richness
- markdown and agent views must not add claims missing from `context-index.json`

## 1. ONBOARDING.md

### Purpose

- help a new human contributor or coding agent start acting safely and quickly

### Primary Consumers

- first-time human contributor
- coding agent on a first real session
- reviewer who needs a fast action-start path

### Role in Phase 2

`ONBOARDING.md` remains the action-start view for humans.

It should answer:

- where to start reading
- which commands likely matter first
- which observed source areas are safest to touch first
- what to postpone on a first session

### Content Structure

1. repo shape snapshot
2. read-first path
3. likely run and test entrypoints
4. likely source edit areas
5. defer-for-now areas
6. watch-outs

### Required Sections

- `What Was Detected`
- `Read First`
- `Likely Entrypoints`
- `Getting Oriented`
- `Safe Early Edit Zones`
- `Defer For Now`

### Optional Sections

- `How To Run`
- `How To Test`
- `Known Uncertainty`
- `Freshness`

### Required Backing Fields

- `repo`
- `first_read_path`
- `entrypoints`
- `agent_hints`
- `defer_for_now`
- `warnings`

## 2. repo.map.md

### Purpose

- provide a navigation-first map of the repo for comprehension, not execution

### Primary Consumers

- human reader exploring an unfamiliar codebase
- coding agent selecting context under token limits
- planner choosing where deeper analysis should begin

### Role in Phase 2

`repo.map.md` remains the navigation view.

It should answer:

- what the static scan observed
- which paths matter most
- how the visible structure hangs together
- which areas can wait

### Content Structure

1. repo snapshot
2. first-read path
3. key paths
4. entrypoints
5. critical paths when graph evidence exists
6. defer-for-now zones

### Required Sections

- `Repo Snapshot`
- `First Read Path`
- `Key Paths`
- `Entrypoints`
- `Defer For Now`

### Optional Sections

- `Critical Paths`
- `Ecosystem Signals`
- `Open Questions`
- `Freshness`

### Required Backing Fields

- `repo`
- `key_paths`
- `entrypoints`
- `critical_paths`
- `defer_for_now`
- `warnings`

## 3. context-index.json

### Purpose

- serve as the canonical structured comprehension artifact for renderers,
  startup views, and later integrations

### Primary Consumers

- markdown renderers
- `agent-start.md` renderer
- later MCP resources
- external tooling that needs a stable repo context contract

### Role in Phase 2

`context-index.json` remains the single source of truth.

It should contain:

- graph-backed structural facts
- evidence-backed inferences
- task-oriented but conservative derived views
- run and freshness metadata for reproducibility and trust

### Required Top-Level Fields

```json
{
  "schema_version": "2.0",
  "repo": {},
  "meta": {},
  "artifacts": {},
  "graph": {},
  "entrypoints": [],
  "first_read_path": [],
  "key_paths": [],
  "critical_paths": [],
  "defer_for_now": [],
  "agent_hints": [],
  "warnings": [],
  "freshness": {}
}
```

### Optional Fields

- `unknowns`
- `generator`

### Confidence Expression

- confidence should live per inferred item, not as one file-level score
- inferred claims should carry `reason` and `confidence`
- prioritized items should carry `evidence`
- directly observed structural facts may omit confidence
- freshness should communicate trust state, not imply semantic certainty

## 4. agent-start.md

### Purpose

- provide a fixed-size startup contract that an agent can read before touching
  the repository

### Primary Consumers

- coding agent session startup

### Role in Phase 2

`agent-start.md` is the startup view.

It should answer:

- what the agent should distrust or verify first
- where the agent should start reading
- which entrypoints and commands matter most
- which paths are important enough to keep in short-term context
- whether the artifact is fresh enough to trust

### Content Structure

1. warnings and uncertainty
2. entrypoints
3. first-read path
4. commands
5. key paths
6. defer-for-now
7. freshness

### Required Sections

- `Warnings And Uncertainty`
- `Entrypoints`
- `First Read Path`
- `Commands`
- `Key Paths`
- `Defer For Now`
- `Freshness`

### Required Backing Fields

- `warnings`
- `entrypoints`
- `first_read_path`
- `artifacts.commands`
- `key_paths`
- `defer_for_now`
- `freshness`

### Length Budget

- target budget: `<= 2000` tokens

### Overflow Trimming Priority

1. preserve `Warnings And Uncertainty`
2. preserve `Entrypoints`
3. preserve `First Read Path`
4. preserve `Commands`
5. compress `Key Paths`
6. compress or drop `Defer For Now`
7. compress `Freshness`

### Hard Rules

- later sections compress before earlier sections
- renderer must never drop warnings to keep more convenience metadata
- section order is fixed; renderer does not improvise
- every claim must derive from canonical metadata

## 5. Artifact Relationship Rules

- `context-index.json` is canonical
- `repo.map.md` is the navigation view
- `ONBOARDING.md` is the human action-start view
- `agent-start.md` is the fixed-budget startup contract
- markdown files must not add claims that do not exist in the canonical model
- when information is missing, markdown should say the signal was not found or
  is uncertain

## 6. Minimum Completion Bar

Phase 2 artifact generation is complete only if:

- all required files are produced
- markdown outputs have all required sections
- every inferred prioritized item has a reason
- every inferred item includes confidence and evidence in canonical metadata
- `agent-start.md` stays within the budget policy
- startup overflow behavior matches the documented trimming order
