# Phase 3 Quality Gates

This document records the expected Phase 3 quality gates that must be satisfied
before Phase 3 implementation is considered complete.

## 1. Classifier Quality Gates

Classifier tests (Epic 4) must prove:

- [x] All classify rules are exercised with explicit test cases
- [x] Bounded depth classification (depth 1 and 2 only) is verified
- [x] Parent intent inheritance works correctly at depth boundaries
- [x] Unknown directories emit low-confidence "unknown" intent
- [x] Manifest hints are scoped to direct children only (not descendants)
- [x] Path normalization handles trailing slashes and absolute paths
- [x] Mixed signals (directory name vs parent inheritance) resolve correctly
- [x] Breadth-first classification order is verified (depth-1 before depth-2)

## 2. Suppression Quality Gates

Suppression behavior (Epic 3.4) must prove:

- [x] Python entrypoints in `example-fixtures` directories are suppressed
- [x] Python entrypoints in `test-infrastructure` directories are suppressed
- [x] Python entrypoints in `core-source` directories are NOT suppressed
- [x] Content-inferred entrypoints (e.g., `if __name__ == '__main__'`) are suppressed when in suppressed directories
- [x] `__init__.py` library entrypoints are suppressed in fixtures/tests
- [x] Suppression is disabled when no IntentMap is provided (backwards compatible)
- [x] Intent inheritance works: nested paths inherit suppression from nearest classified ancestor

## 3. Extraction Regression Quality Gates

Extraction regression tests (Epic 5) must prove:

- [x] Python entrypoints are suppressed in `example-fixtures` directories (via IntentMap)
- [x] Python entrypoints are suppressed in `test-infrastructure` directories (via IntentMap)
- [x] No regression: existing JS/TS entrypoint detection continues to work
- [x] No regression: import edge extraction for Python continues to work
- [x] Real FastAPI fixture (`python-fastapi`) surfaces `app/main.py` as server entrypoint
- [x] Real FastAPI fixture (`python-fastapi`) does NOT surface `tests/` files as entrypoints
- [x] Real Flask fixture (`python-flask`) surfaces `app.py` as server entrypoint
- [x] Real Flask fixture (`python-flask`) does NOT surface `tests/` files as entrypoints

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

- [x] `IntentMap` schema validates correctly (schema_version "2.0", unique paths)
- [x] `DirectoryIntent` enum covers all DIRECTORY_INTENTS
- [x] `DirectoryEvidence` interface is stable for classifier implementations
- [x] `DirectoryClassifier` interface can be implemented by future classifiers (e.g., LLM-based)
- [x] Additive compatibility: existing Phase 2 contracts remain valid

## 6. Performance Gates

- [x] Classifier (Stage B') adds negligible overhead to full pipeline
- [x] Bounded depth (maxDepth=2) ensures O(1) classification work per repo
- [x] createFileResolver produces O(depth) lookups, not O(entries)

## 7. Release Gates

Phase 3 should not ship until:

- [x] All classify tests pass (89 tests covering rules, engine, boundary)
- [x] All suppression regression tests pass
- [x] All existing Phase 2 tests continue to pass (no regression)
- [x] Real fixture integration tests pass for FastAPI and Flask
- [x] TypeScript compilation passes with no errors
- [x] Performance baseline is maintained (no regression in scan/extraction times)
