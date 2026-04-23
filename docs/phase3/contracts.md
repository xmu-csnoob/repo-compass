# Phase 3 Contracts

This document defines the minimum shared language for Phase 3.

Rules:

- all paths are repo-relative unless explicitly marked otherwise
- every artifact carries `schema_version`
- every inferred claim preserves `reason` and `confidence`
- `context-index.json` remains the canonical output contract
- new Phase 3 contracts are additive and must not silently change Phase 2 field
  meanings

## 1. Repo Input Schema

Phase 3 keeps the Phase 2 repo input contract and extends it additively if
needed.

Potential additive options:

- `intent_depth`: `1|2`
- `use_llm_classify`: `boolean`

Rules:

- default `intent_depth` is `2`
- default `use_llm_classify` is `false`
- defaults must preserve credible Phase 2 behavior
- LLM classification must stay optional

## 2. Structure Scan Result

Phase 3 keeps `StructureScan` as the file-system inventory contract.

Phase 3 rule:

- path roles remain file- and path-type classification, not purpose
  classification

`StructureScan` is still responsible for:

- files and directories observed
- path kinds and roles
- manifest detection
- detected languages, ecosystems, and framework hints

## 3. Directory Intent Contract

Phase 3 introduces directory-level purpose classification.

Conceptual enum set:

- `core-source`
- `library-surface`
- `example-fixtures`
- `test-infrastructure`
- `tooling`
- `docs`
- `config`
- `unknown`

Conceptual schema:

```json
{
  "path": "string",
  "depth": 1,
  "intent": "core-source|library-surface|example-fixtures|test-infrastructure|tooling|docs|config|unknown",
  "confidence": "high|medium|low",
  "reason": "string",
  "method": "static|llm"
}
```

Rules:

- `path` must refer to a directory, not a file
- `depth` is the classified directory depth, not the path length of a child file
- `method` must declare how the judgment was produced
- `reason` must be human-readable and evidence-oriented
- exactly one intent is chosen per classified directory

Conflict resolution rules:

- more specific rules beat more general rules
- manifest linkage and explicit package evidence beat name-only heuristics
- if two name-pattern rules conflict at the same specificity,
  `test-infrastructure` beats `example-fixtures`
  because test directories usually have stronger structural markers and are
  easier to validate deterministically than example naming alone
- if ambiguity remains after static rules, the classifier emits one intent with
  reduced confidence rather than multiple intents

## 4. Intent Map Contract

Phase 3 introduces an intermediate artifact:

```json
{
  "schema_version": "2.0",
  "run_id": "string",
  "entries": [
    {
      "path": "string",
      "depth": 1,
      "intent": "string",
      "confidence": "high|medium|low",
      "reason": "string",
      "method": "static|llm"
    }
  ]
}
```

Purpose:

- provide Stage C and later stages with bounded directory-purpose context

Rules:

- `IntentMap` is additive pipeline metadata, not a replacement for
  `StructureScan`
- `IntentMap` uses the same schema version as the rest of the current artifact
  family unless an explicit independent versioning policy is introduced later
- default classification depth is `2`
- deeper descendants resolve intent by nearest classified ancestor
- repository root is not classified as a normal intent entry in the first Phase
  3 slice

## 5. Signal Extraction Result

Phase 3 keeps `SignalExtraction` as the contract for extracted entrypoints,
commands, edges, priority candidates, defer candidates, and warnings.

Phase 3 change:

- Stage C uses `IntentMap` to suppress certain file-level signals before they
  enter the main primary Python entrypoint set

Required behavior:

- files under `example-fixtures` and `test-infrastructure` must not flood the
  primary Python entrypoint list
- intent-aware suppression must remain evidence-backed and deterministic on the
  default path
- this first Phase 3 slice commits to suppression rather than re-ranking for
  those two intents during primary Python entrypoint extraction

## 6. Comprehension Representation

Phase 3 keeps `context-index.json` canonical.

Phase 3 rule:

- renderers must continue to derive from canonical metadata only
- the existence of `IntentMap` must not create a second user-facing truth source

Additive direction for Phase 3:

- intent-aware extraction and ranking may influence `entrypoints`,
  `first_read_path`, `key_paths`, and warnings
- if intent summaries are later exposed in canonical metadata, they must remain
  additive and evidence-backed

## 7. Confidence and Evidence Rules

Phase 3 continues the three-level confidence model:

- `high`
- `medium`
- `low`

Additional rules:

- directory intent must carry explicit confidence
- LLM-assisted intent classification must still emit deterministic-looking,
  schema-valid evidence fields and reasons
- low-confidence directory intent should be allowed without forcing downstream
  promotion into user-facing primary lists

## 8. Compatibility Rules

- Phase 3 extends Phase 2 contracts additively
- existing Phase 2 top-level fields must not silently change meaning
- `IntentMap` may be internal in the first Phase 3 slice
- any future exposure of intent summaries in canonical metadata requires
  additive schema changes only

## 9. Depth Resolution Rules

Phase 3 intent lookup rules:

- classify directories up to bounded depth
- resolve file intent by nearest classified ancestor
- if no ancestor is classified, return `unknown`

This rule keeps the artifact compact and predictable on large repos.

Boundary rules:

- if all directories fall back to `unknown`, extraction degrades toward Phase 2
  behavior rather than failing closed
- flat repositories with no classified top-level subdirectories continue to use
  file-level Phase 2 signals
- empty directories do not require intent entries in the first Phase 3 slice
