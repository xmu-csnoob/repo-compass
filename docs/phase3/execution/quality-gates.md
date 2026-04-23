# Phase 3 Quality Gates

This document records the expected Phase 3 quality gates that must be satisfied
before Phase 3 implementation is considered complete.

## 1. Classifier Quality Gates

Classifier tests (Epic 4) must prove:

- [ ] All classify rules are exercised with explicit test cases
- [ ] Bounded depth classification (depth 1 and 2 only) is verified
- [ ] Parent intent inheritance works correctly at depth boundaries
- [ ] Unknown directories emit low-confidence "unknown" intent
- [ ] Manifest hints are scoped to direct children only (not descendants)
- [ ] Path normalization handles trailing slashes and absolute paths
- [ ] Mixed signals (directory name vs parent inheritance) resolve correctly
- [ ] Breadth-first classification order is verified (depth-1 before depth-2)

## 2. Suppression Quality Gates

Suppression behavior (Epic 3.4) must prove:

- [ ] Python entrypoints in `example-fixtures` directories are suppressed
- [ ] Python entrypoints in `test-infrastructure` directories are suppressed
- [ ] Python entrypoints in `core-source` directories are NOT suppressed
- [ ] Content-inferred entrypoints (e.g., `if __name__ == '__main__'`) are suppressed when in suppressed directories
- [ ] `__init__.py` library entrypoints are suppressed in fixtures/tests
- [ ] Suppression is disabled when no IntentMap is provided (backwards compatible)
- [ ] Intent inheritance works: nested paths inherit suppression from nearest classified ancestor

## 3. Extraction Regression Quality Gates

Extraction regression tests (Epic 5) must prove:

- [ ] Python entrypoints are suppressed in `example-fixtures` directories (via IntentMap)
- [ ] Python entrypoints are suppressed in `test-infrastructure` directories (via IntentMap)
- [ ] No regression: existing JS/TS entrypoint detection continues to work
- [ ] No regression: import edge extraction for Python continues to work
- [ ] Real FastAPI fixture (`python-fastapi`) surfaces `app/main.py` as server entrypoint
- [ ] Real FastAPI fixture (`python-fastapi`) does NOT surface `tests/` files as entrypoints
- [ ] Real Flask fixture (`python-flask`) surfaces `app.py` as server entrypoint
- [ ] Real Flask fixture (`python-flask`) does NOT surface `tests/` files as entrypoints

## 4. Structural Coverage

Phase 3 must exercise at least these repository classes:

- Python web services using FastAPI (router-based structure)
- Python web services using Flask (single-app WSGI structure)
- Python web services using Django (manage.py + apps pattern)
- Python CLI tools
- Python library packages
- Mixed Python/JS repositories
- Noisy Python repositories with caches, virtualenvs, migrations

## 5. Contract Quality Gates

- [ ] `IntentMap` schema validates correctly (schema_version "2.0", unique paths)
- [ ] `DirectoryIntent` enum covers all DIRECTORY_INTENTS
- [ ] `DirectoryEvidence` interface is stable for classifier implementations
- [ ] `DirectoryClassifier` interface can be implemented by future classifiers (e.g., LLM-based)
- [ ] Additive compatibility: existing Phase 2 contracts remain valid

## 6. Performance Gates

- [ ] Classifier (Stage B') adds negligible overhead to full pipeline
- [ ] Bounded depth (maxDepth=2) ensures O(1) classification work per repo
- [ ] createFileResolver produces O(depth) lookups, not O(entries)

## 7. Release Gates

Phase 3 should not ship until:

- [ ] All classify tests pass (75+ tests covering rules, engine, boundary)
- [ ] All suppression regression tests pass (11+ tests)
- [ ] All existing Phase 2 tests continue to pass (no regression)
- [ ] Real fixture integration tests pass for FastAPI and Flask
- [ ] TypeScript compilation passes with no errors
- [ ] Performance baseline is maintained (no regression in scan/extraction times)
