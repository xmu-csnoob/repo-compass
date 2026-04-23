# Artifact Specification

This document defines the Phase 1 outputs and removes ambiguity about what
"done" looks like.

Common rules:

- all artifacts derive from the same canonical metadata model
- all paths are repo-relative
- markdown should stay compact and operational
- agent-facing outputs should prefer precision over coverage
- markdown and agent views must not add claims missing from `context-index.json`

## 1. ONBOARDING.md

### Purpose

- help a new human contributor or coding agent start acting safely and quickly

### Primary Consumers

- first-time human contributor
- first-time coding agent session
- reviewer who needs a fast action-start path

### Role in Phase 1

`ONBOARDING.md` is the action-start view.

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

### Required Backing Fields

- `repo`
- `first_read_path`
- `entrypoints`
- `agent_hints`
- `defer_for_now`

### Confidence Expression

- inline tags are enough: `[high]`, `[medium]`, `[low]`
- directly observed facts may omit tags
- setup or edit guidance should show confidence when inferred
- low-confidence items should usually be omitted
- repo-shape wording must stay coarse and should not claim architectural intent

## 2. repo.map.md

### Purpose

- provide a navigation-first map of the repo for comprehension, not execution

### Primary Consumers

- human reader exploring unfamiliar code
- coding agent selecting context under token limits
- planner choosing where deeper analysis should begin

### Role in Phase 1

`repo.map.md` is the navigation view.

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
5. critical paths when multi-hop graph evidence exists
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

### Required Backing Fields

- `repo`
- `key_paths`
- `entrypoints`
- `critical_paths`
- `defer_for_now`

### Confidence Expression

- inferred entrypoints and critical paths should show confidence unless high
- reasons should be short and attached to each item
- low-confidence items should be rare
- when no multi-hop path is supported by the graph, say so instead of fabricating one

## 3. context-index.json

### Purpose

- serve as the canonical structured comprehension artifact for renderers and
  later agent integrations

### Primary Consumers

- markdown renderers
- static agent-file renderers
- later MCP resources
- external tooling that needs a stable repo context contract

### Role in Phase 1

`context-index.json` is the single source of truth.

It should contain:

- graph-backed structural facts
- evidence-backed inferences
- task-oriented but conservative derived views
- lightweight run metadata for reproducibility

### Required Top-Level Fields

```json
{
  "schema_version": "1.0",
  "repo": {
    "name": "string",
    "root": "string",
    "repo_shape": "application|library|service|tool|mixed",
    "primary_languages": ["string"],
    "detected_ecosystems": ["string"],
    "framework_hints": ["string"]
  },
  "meta": {
    "run_id": "string",
    "snapshot_id": "string",
    "generated_at": "ISO-8601",
    "included_paths": ["string"],
    "excluded_paths": ["string"]
  },
  "artifacts": {
    "manifests": [],
    "commands": []
  },
  "graph": {
    "nodes": [],
    "edges": []
  },
  "entrypoints": [],
  "first_read_path": [],
  "key_paths": [],
  "critical_paths": [],
  "defer_for_now": [],
  "agent_hints": []
}
```

### Optional Fields

- `warnings`
- `unknowns`
- `generator`

### Confidence Expression

- confidence should live per inferred item, not as one file-level score
- inferred claims should carry `reason` and `confidence`
- `entrypoints` and `key_paths` should carry `evidence`
- other inferred sections may carry `evidence` when needed
- directly observed structural facts may omit confidence
- `repo_shape` is a coarse structural classification, not a statement of repo intent

## 4. Artifact Relationship Rules

- `context-index.json` is canonical
- `repo.map.md` is the navigation view
- `ONBOARDING.md` is the action-start view
- markdown files must not add claims that do not exist in the canonical model
- when information is missing, markdown should say the signal was not found

## 5. Minimum Completion Bar

Phase 1 artifact generation is complete only if:

- all three files are produced
- markdown outputs have all required sections
- every inferred prioritized item has a reason
- every inferred item includes confidence and evidence in canonical metadata
- the markdown outputs remain readable in one quick pass
