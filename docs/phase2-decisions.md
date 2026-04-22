# Phase 2 Decisions

This document records major design decisions for Phase 2.

## D-001 Keep TypeScript And Node.js

Decision:

- Phase 2 stays on the existing implementation stack

Reason:

- preserves delivery speed and compatibility with Phase 1

Rejected alternative:

- rewriting the core engine before Phase 2 value is proven

## D-002 Keep `context-index.json` Canonical

Decision:

- richer views do not replace the canonical metadata artifact

Reason:

- avoids split-brain logic between renderers and machine integrations

## D-003 Treat Incremental Analysis As Optional Until Proven

Decision:

- incremental execution is in scope for design, but should ship only with clear
  equivalence semantics

Reason:

- performance upside is real, but correctness risk is higher than for additive
  extraction improvements

## D-004 Schema 2.0 Is a Hard Break from 1.0

Decision:

- `context-index.json` schema version bumps from `"1.0"` to `"2.0"` with no
  backward-compatibility reader. Old `"1.0"` files will fail schema validation
  under the new parser.

Reason:

- Phase 2 introduces `warnings` and `freshness` as required top-level fields.
  Supporting both shapes simultaneously would add complexity without clear value
  for a pre-release tool.

Migration path:

- Re-run `repo-compass` on the target repository to regenerate a `"2.0"`
  `context-index.json`.
