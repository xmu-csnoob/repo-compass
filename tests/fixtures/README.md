# Fixture Repos

This directory contains minimal but realistic fixture repos for testing repo-compass scanning and signal extraction.

## Fixtures

| Fixture | Type | Purpose |
|---------|------|---------|
| `nextjs-app/` | Next.js application | Tests app router, API routes, React components |
| `react-app/` | React app (CRA-style) | Tests class components, setup files |
| `vite-app/` | Vite React app | Tests Vite config, modern React |
| `node-cli/` | Node.js CLI tool | Tests bin entries, commander-style CLI |
| `express-service/` | Express.js service | Tests REST routes, middleware |
| `noisy-repo/` | Noisy/edge-case repo | Tests exclusion logic, vendor/build detection |

## Scan Assertions

Each fixture exercises different `path.role` values:
- `source` — actual source code
- `config` — configuration files
- `tests` — test files/directories
- `generated` — build output directories
- `vendor` — vendor-like paths
- `docs` — documentation

## Usage

These fixtures are used by:
- `tests/contracts/` — schema validation tests
- `tests/scan/` — structure scan assertions
- `tests/extract/` — signal extraction assertions
