# Core Contracts

This document defines the minimum shared language for Phase 1.

Rules:

- all paths are repo-relative unless explicitly marked otherwise
- every artifact carries `schema_version`
- every inferred claim preserves `reason` and `confidence`
- `context-index.json` is the canonical output contract
- facts and derived views must stay distinguishable

## 1. Repo Input Schema

Purpose:

- normalize repository analysis requests before scanning

```json
{
  "schema_version": "1.0",
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
    "emit_agent_views": true
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
  "schema_version": "1.0",
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
        "kind": "package-json|lockfile|other"
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

```json
{
  "schema_version": "1.0",
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
      "kind": "contains|import|require|reference|route|config-link|test-of"
    }
  ],
  "priority_candidates": [
    {
      "path": "string",
      "signal": "entrypoint|manifest|fan-in|framework-core|workflow-core|adjacent-test",
      "reason": "string",
      "confidence": "high|medium|low",
      "evidence": ["string"]
    }
  ],
  "defer_candidates": [
    {
      "path": "string",
      "reason": "string",
      "confidence": "high|medium|low"
    }
  ],
  "warnings": ["string"]
}
```

## 4. Comprehension Representation

Purpose:

- express the minimum stable understanding model used by all renderers

```json
{
  "schema_version": "1.0",
  "run_id": "string",
  "repo": {
    "name": "string",
    "root": "string",
    "repo_shape": "application|library|service|tool|mixed",
    "primary_languages": ["string"],
    "detected_ecosystems": ["string"],
    "framework_hints": ["string"]
  },
  "artifacts": {
    "manifests": [
      {
        "path": "string",
        "kind": "package-json|lockfile|other"
      }
    ],
    "commands": [
      {
        "source_path": "string",
        "name": "string",
        "command": "string"
      }
    ]
  },
  "graph": {
    "nodes": [
      {
        "id": "string",
        "path": "string",
        "kind": "file|directory|manifest|config|test|entrypoint",
        "role": "source|config|docs|tests|generated|vendor|build|unknown"
      }
    ],
    "edges": [
      {
        "from": "string",
        "to": "string",
        "kind": "contains|import|require|reference|route|config-link|test-of"
      }
    ]
  },
  "entrypoints": [
    {
      "id": "string",
      "path": "string",
      "kind": "app|cli|server|library|test-harness|build",
      "summary": "string",
      "reason": "string",
      "confidence": "high|medium|low",
      "evidence": ["string"]
    }
  ],
  "first_read_path": [
    {
      "path": "string",
      "why_now": "string",
      "reason": "string",
      "confidence": "high|medium|low"
    }
  ],
  "key_paths": [
    {
      "path": "string",
      "kind": "file|directory",
      "role": "entry|core|config|workflow|test|docs",
      "summary": "string",
      "priority": "high|medium|low",
      "reason": "string",
      "confidence": "high|medium|low",
      "evidence": ["string"]
    }
  ],
  "critical_paths": [
    {
      "name": "string",
      "steps": ["string"],
      "reason": "string",
      "confidence": "high|medium|low"
    }
  ],
  "defer_for_now": [
    {
      "path": "string",
      "reason": "string",
      "confidence": "high|medium|low"
    }
  ],
  "agent_hints": [
    {
      "kind": "setup|run|test|safe-edit-zone|watch-out",
      "text": "string",
      "reason": "string",
      "confidence": "high|medium|low"
    }
  ]
}
```

Required sections:

- `repo`
- `artifacts`
- `graph`
- `entrypoints`
- `first_read_path`
- `key_paths`
- `defer_for_now`
- `agent_hints`

## 5. context-index.json Schema

`context-index.json` is the published form of the comprehension representation.

Phase 1 rule:

- keep this file equal to the canonical comprehension model or a strict superset
- markdown and static agent renderers must derive from this file

Minimum published schema:

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

## 6. Confidence and Evidence Rules

Phase 1 uses a three-level confidence model for published outputs.

Guidelines:

- `high`: directly observable or rule-backed with near-zero ambiguity
- `medium`: conservative inference from stable structural evidence
- `low`: weak or speculative inference; prefer omission in default agent views

Rules:

- all inferred items must include `reason`
- all inferred items must include `confidence`
- summaries must not introduce unsupported conclusions

Evidence guidance:

- `entrypoints` must include `evidence`
- `key_paths` must include `evidence`
- `first_read_path`, `critical_paths`, `defer_for_now`, and `agent_hints` may
  include `evidence` when it materially improves explainability
- directly observed facts do not need `evidence`

## 7. Artifact I/O Definitions

Phase 1 pipeline artifacts:

### `work/runs/<run-id>/input.json`

- input: external request
- output of: input normalization
- input to: scanner

### `work/runs/<run-id>/context-index.json`

- input: comprehension representation in memory
- output of: canonical renderer
- input to: markdown and static agent renderers

### `work/runs/<run-id>/outputs/repo.map.md`

- input: `context-index.json`
- output of: repo map renderer
- consumer: human and coding agent navigation

### `work/runs/<run-id>/outputs/ONBOARDING.md`

- input: `context-index.json`
- output of: onboarding renderer
- consumer: new contributor or first-session agent

### `work/runs/<run-id>/outputs/agent-context.md`

- input: `context-index.json`
- output of: static agent renderer
- consumer: coding agent bootstrap
- emitted only when agent views are enabled

Optional debug artifacts when enabled:

- `work/runs/<run-id>/scan.json`
- `work/runs/<run-id>/signals.json`
- `work/runs/<run-id>/comprehension.json`

## 8. Frozen Enums for Phase 1

These should be frozen early to avoid renderer drift.

`manifest.kind`

- `package-json`
- `lockfile`
- `other`

`path.role`

- `source`
- `config`
- `docs`
- `tests`
- `generated`
- `vendor`
- `build`
- `unknown`

`key_paths.role`

- `entry`
- `core`
- `config`
- `workflow`
- `test`
- `docs`

`entrypoints.kind`

- `app`
- `cli`
- `server`
- `library`
- `test-harness`
- `build`

`confidence`

- `high`
- `medium`
- `low`
