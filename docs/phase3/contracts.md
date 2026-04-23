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

Frozen enum set for `DIRECTORY_INTENTS`:

- `core-source`
- `library-surface`
- `example-fixtures`
- `test-infrastructure`
- `tooling`
- `docs`
- `config`
- `unknown`

Wave 0 freeze rule:

- this enum set is closed for the interface-freeze wave
- additions, removals, or renames require updates to the frozen Phase 3 docs
  before implementation changes land

Frozen directory intent entry shape:

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
- `depth` is bounded to the configured classification depth; with the default
  Phase 3 configuration, emitted values are `1` or `2`
- `method` must declare how the judgment was produced
- `reason` must be human-readable and evidence-oriented
- each emitted entry must be unique by `path`
- exactly one intent is chosen per classified directory
- `unknown` is valid only for directories that were actually evaluated by the
  classifier; it must not be synthesized for unresolved descendants

Conflict resolution rules:

- more specific rules beat more general rules
- manifest linkage and explicit package evidence beat name-only heuristics
- if two name-pattern rules conflict at the same specificity,
  `test-infrastructure` beats `example-fixtures`
  because test directories usually have stronger structural markers and are
  easier to validate deterministically than example naming alone
- if ambiguity remains after static rules, the classifier emits one intent with
  reduced confidence rather than multiple intents

## 4. Classifier Interface Contract

Wave 0 freezes the typed Stage B' seam used by both static and future LLM
classification paths.

Frozen interface:

```ts
type DirectoryIntent = typeof DIRECTORY_INTENTS[number];

interface DirectoryEvidence {
  path: string;
  depth: 1 | 2;
  children: string[];
  manifest_hints: string[];
  parent_intent?: DirectoryIntent;
}

interface DirectoryIntentEntry {
  path: string;
  depth: 1 | 2;
  intent: DirectoryIntent;
  confidence: "high" | "medium" | "low";
  reason: string;
  method: "static" | "llm";
}

interface DirectoryClassifier {
  readonly method: "static" | "llm";
  classify(dir: DirectoryEvidence): Promise<DirectoryIntentEntry>;
}
```

Rules:

- `DirectoryEvidence` is the only classifier input surface frozen in Phase 3
- `children` contains immediate child names only, not recursive descendants
- `manifest_hints` contains bounded manifest-kind evidence associated with the
  directory, not arbitrary raw manifest payloads
- `parent_intent` is the nearest already-classified ancestor intent when one
  exists
- `classify()` returns exactly one `DirectoryIntentEntry` for the evaluated
  directory and must preserve the same `path` and `depth` it was given
- the static classifier is required for Phase 3
- any future LLM classifier must implement this same interface rather than
  creating a second downstream contract

## 5. Intent Map Contract

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
- `entries` contain `DirectoryIntentEntry` records produced through the frozen
  classifier interface
- `IntentMap` uses the same schema version as the rest of the current artifact
  family unless an explicit independent versioning policy is introduced later
- default classification depth is `2`
- deeper descendants resolve intent by nearest classified ancestor
- unresolved descendants fall back to `unknown` at lookup time; they are not
  materialized as synthetic `unknown` entries
- repository root is not classified as a normal intent entry in the first Phase
  3 slice

## 6. Signal Extraction Result

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
- suppression is scoped to primary Python entrypoint promotion in Stage C; it
  must not mutate `StructureScan` facts or invent a second interpretation path
- if intent resolution returns `unknown` or a non-target intent, extraction
  falls back toward Phase 2 behavior rather than failing closed

## 7. Comprehension Representation

Phase 3 keeps `context-index.json` canonical.

Phase 3 rule:

- renderers must continue to derive from canonical metadata only
- the existence of `IntentMap` must not create a second user-facing truth source

Additive direction for Phase 3:

- intent-aware extraction and ranking may influence `entrypoints`,
  `first_read_path`, `key_paths`, and warnings
- if intent summaries are later exposed in canonical metadata, they must remain
  additive and evidence-backed

## 8. Confidence and Evidence Rules

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

## 9. Compatibility Rules

- Phase 3 extends Phase 2 contracts additively
- existing Phase 2 top-level fields must not silently change meaning
- `IntentMap` may be internal in the first Phase 3 slice
- any future exposure of intent summaries in canonical metadata requires
  additive schema changes only

## 10. Depth Resolution Rules

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
