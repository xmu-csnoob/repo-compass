# Phase 2 Contracts

This document defines the minimum shared language for Phase 2.

Rules:

- all paths are repo-relative unless explicitly marked otherwise
- every artifact carries `schema_version`
- every inferred claim preserves `reason` and `confidence`
- `context-index.json` remains the canonical output contract
- facts and derived views must stay distinguishable
- `agent-start.md` is a derived startup contract, not a second source of truth

## 1. Repo Input Schema

Purpose:

- normalize repository analysis requests before scanning
- make freshness mode explicit without making it mandatory for every run

```json
{
  "schema_version": "2.0",
  "run_id": "string",
  "repo_root": "string",
  "output_root": "string",
  "include": ["string"],
  "exclude": ["string"],
  "max_files": 50000,
  "options": {
    "follow_symlinks": false,
    "detect_frameworks": true,
    "extract_import_graph": true,
    "emit_debug_artifacts": false,
    "emit_agent_start": true,
    "freshness_mode": "off|watch|ci"
  }
}
```

Required fields:

- `schema_version`
- `run_id`
- `repo_root`
- `output_root`

## 2. Structure Scan Result

Purpose:

- represent the normalized repository inventory after scan and before higher
  interpretation

```json
{
  "schema_version": "2.0",
  "run_id": "string",
  "repo": {
    "root": "string",
    "file_count": 0,
    "dir_count": 0
  },
  "detected": {
    "languages": ["string"],
    "ecosystems": ["string"],
    "framework_hints": ["string"],
    "manifests": [
      {
        "path": "string",
        "kind": "package-json|lockfile|pyproject|setup-py|setup-cfg|requirements|other"
      }
    ]
  },
  "paths": [
    {
      "path": "string",
      "kind": "file|directory",
      "role": "source|config|docs|tests|generated|vendor|build|unknown",
      "size": 0
    }
  ],
  "excluded_paths": ["string"]
}
```

Required fields:

- `schema_version`
- `run_id`
- `repo`
- `detected`
- `paths`

## 3. Signal Extraction Result

Purpose:

- hold high-confidence structural findings derived from scan data
- support language-agnostic ranking signals plus targeted Python additions

```json
{
  "schema_version": "2.0",
  "run_id": "string",
  "entrypoints": [
    {
      "id": "string",
      "path": "string",
      "kind": "app|cli|server|library|test-harness|build",
      "reason": "string",
      "confidence": "high|medium|low",
      "evidence": ["string"]
    }
  ],
  "commands": [
    {
      "source_path": "string",
      "name": "string",
      "command": "string"
    }
  ],
  "edges": [
    {
      "from": "string",
      "to": "string",
      "kind": "contains|import|require|reference|route|config-link|test-of|module-link"
    }
  ],
  "priority_candidates": [
    {
      "path": "string",
      "signal": "entrypoint|manifest|fan-in|framework-core|workflow-core|adjacent-test|root-central",
      "reason": "string",
      "confidence": "high|medium|low",
      "evidence": ["string"]
    }
  ],
  "defer_candidates": [
    {
      "path": "string",
      "reason": "string",
      "confidence": "high|medium|low",
      "evidence": ["string"]
    }
  ],
  "warnings": ["string"]
}
```

Phase 2 rule:

- targeted Python support should be expressed as evidence-backed signals, not as
  open-ended framework narration

## 4. Comprehension Representation

Purpose:

- express the minimum stable understanding model used by all renderers
- keep Phase 2 output grounded in static structure rather than repo-intent
  inference

```json
{
  "schema_version": "2.0",
  "run_id": "string",
  "meta": {
    "run_id": "string",
    "snapshot_id": "string",
    "generated_at": "ISO-8601",
    "included_paths": ["string"],
    "excluded_paths": ["string"]
  },
  "repo": {
    "name": "string",
    "root": "string",
    "repo_shape": "application|library|service|tool|mixed",
    "primary_languages": ["string"],
    "detected_ecosystems": ["string"],
    "framework_hints": ["string"]
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
  "agent_hints": [],
  "warnings": ["string"],
  "freshness": {
    "mode": "off|watch|ci",
    "status": "fresh|stale|unknown",
    "generated_from": "full|incremental",
    "reason": "string"
  }
}
```

Required behavior:

- new fields should be additive wherever possible
- freshness metadata must not imply correctness beyond what evidence supports
- unknown freshness is preferable to false freshness certainty

## 5. Compatibility Rules

- Phase 2 extends Phase 1 contracts additively where possible
- existing Phase 1 top-level fields must not change meaning silently
- any non-additive change requires explicit migration notes
- renderers must continue to derive from canonical metadata only
- `agent-start.md` must never become the hidden contract behind the JSON

## 6. Confidence and Evidence Rules

Phase 2 still uses a three-level confidence model:

- `high`
- `medium`
- `low`

Rules:

- every new inferred field must preserve `reason` and `confidence`
- evidence should become more specific, not more verbose
- Python framework claims require explicit supporting signals
- low-confidence items should remain suppressible in default user views
- noisy glue files should not gain artificial confidence from repetition alone

## 7. Agent Startup Contract Rules

`agent-start.md` is a derived startup artifact.

It must:

- be rendered from `context-index.json` only
- use a fixed section order defined in artifact spec
- target a budget of `<= 2000` tokens
- compress by contract priority when over budget

Overflow trimming priority:

1. `Warnings And Uncertainty`
2. `Entrypoints`
3. `First Read Path`
4. `Commands`
5. `Key Paths`
6. `Defer For Now`
7. `Freshness`

Hard rule:

- renderer logic must not reorder this policy based on local implementation
  taste
- warnings must never be dropped to preserve lower-priority convenience content

## 8. Freshness Rules

If Phase 2 ships freshness support, contracts must define:

- base snapshot identity
- changed path set identity
- stale versus fresh versus unknown semantics
- watch-mode versus CI regeneration mode
- degraded-mode signaling when freshness confidence is insufficient
- equivalence expectations versus full-run output

Phase 2 sequencing rule:

- freshness implementation follows Python quality gates

## 9. Frozen Enums for Initial Phase 2 Slice

Do not expand without updating this document:

- `manifest.kind`:
  `package-json|lockfile|pyproject|setup-py|setup-cfg|requirements|other`
- `freshness.mode`: `off|watch|ci`
- `freshness.status`: `fresh|stale|unknown`
- `edge.kind`:
  `contains|import|require|reference|route|config-link|test-of|module-link`

## 10. Change Control

Before implementation starts:

- Phase 2 contract changes must be documented here
- schema-affecting decisions must be mirrored in artifact spec and tests
- hidden schema decisions inside implementation PRs are not acceptable
