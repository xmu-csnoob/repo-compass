# Phase 2 Test Strategy

This document defines how Phase 2 quality is measured before implementation is
considered done.

## 1. Verification Goals

Phase 2 verification must prove:

- compatibility with Phase 1 expectations where contracts overlap
- credible usefulness on common Python repositories
- no regression in deterministic output guarantees
- `agent-start.md` obeys its startup-contract rules
- freshness semantics do not overstate trust

## 2. Test Matrix

Phase 2 should verify at least these repository classes:

- JS/TS baseline fixtures carried forward from Phase 1
- Python CLI repositories
- Python library repositories
- Python web/service repositories using FastAPI, Flask, or Django
- noisy Python repositories with caches, virtualenv artifacts, migrations, and
  package glue
- mixed repositories where Python is primary and JS/TS is secondary

Phase 2 rule:

- Python quality is not established by unit tests alone; at least one
  production-style fixture per class is required

## 3. Test Layers

### Contract Tests

- schema validation for all new fields
- additive compatibility checks for Phase 1 consumers
- freshness enum coverage, including `degraded`
- startup artifact contract coverage for required sections and budget behavior

### Fixture Tests

- Python manifest and packaging detection fixtures
- Python entrypoint detection fixtures
- Python noise suppression fixtures for `__init__.py`, `.venv`, `__pycache__`,
  migrations, and build outputs
- cross-language ranking fixtures that verify structural signals generalize

### Comprehension Tests

- first-read path ranking on Python repos
- key-path stability on noisy Python repos
- warning generation on unsupported or ambiguous repo shapes
- conservative repo-shape behavior when evidence is weak

### Renderer Tests

- `agent-start.md` snapshot tests
- startup artifact overflow tests that verify the exact trimming order
- freshness badge/state rendering tests
- existing markdown outputs must not drift without explicit spec change

### Freshness Tests

- watch-mode regeneration semantics
- CI regeneration semantics
- `fresh`, `stale`, `degraded`, and `unknown` state coverage
- incremental artifact degradation signaling when full equivalence is unproven

### Performance Tests

- baseline comparison against Phase 1
- Python fixture scan times on representative repo sizes
- startup artifact render time and bounded size behavior
- delta-run measurements for incremental mode once freshness is implemented

## 4. Python Quality Gates

Phase 2 should not ship Python support until all of the following are true:

- common Python repos produce at least one credible entrypoint when such an
  entrypoint structurally exists
- key paths include real source or manifest anchors rather than being dominated
  by package glue
- `first_read_path` starts with a justifiable manifest, entrypoint, or central
  source path
- `__init__.py` does not dominate ranked output unless it is genuinely central
- warnings appear when framework or packaging signals are incomplete

P0 failure definition for Python:

- no entrypoint is found in a repo where the main execution path is structurally
  obvious
- low-signal Python glue dominates key ranking output
- startup artifact omits known warnings while presenting strong guidance
- artifact freshness overstates trust on incrementally refreshed output

Phase gate:

- Python repo P0 failures must not exceed the severity of the major Phase 1 Vue
  miss

## 5. End-to-End Report Requirement

Before Phase 2 implementation is considered complete, the repository must
contain a report named:

- `work/reports/phase2-python-e2e-test-report.md`

That report must include:

- fixture set and repository classes covered
- canonical output examples
- startup artifact examples
- false-positive and false-negative findings
- noise-suppression evaluation
- freshness-state evaluation when freshness is implemented
- open gaps and ship/no-ship recommendation

Phase 2 rule:

- shipping readiness is decided from the report plus tests, not from unit-test
  pass rate alone

## 6. Release Gates

Phase 2 should not ship until:

- compatibility tests pass
- targeted Python fixture improvements are measurable
- no unresolved high-severity schema drift remains
- output determinism is preserved
- `agent-start.md` budget and trimming behavior are verified
- Python end-to-end report recommends ship for the scoped repo classes
