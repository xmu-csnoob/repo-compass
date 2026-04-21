# Noisy Repo Fixture

Purpose: Failure-path and edge-case testing
Tests: Exclusion logic, vendor/build/generated path detection

## Structure

Exercises all the "noise" that a real repo has but should be excluded or handled gracefully:

- `node_modules/` — should be excluded (vendor-like)
- `dist/` — build output (generated)
- `.next/` — Next.js build output (generated)
- `.output/` — Vercel build output (generated)
- `vendor/` — third-party vendored code
- `coverage/` — test coverage output
- `.git/` — version control (excluded by default)

## Scan Assertions

- `dist/index.js` → `role: generated`
- `vendor/library.js` → `role: vendor`
- `.next/cache.json` → `role: generated`
- `node_modules/.bin/script` → `role: vendor`
- `src/index.ts` → `role: source` (signal, should not be masked by noise)

## Expected Behavior

- High file count but most should be in `excluded_paths`
- Source files in `src/` should still be detected correctly
- No crashes on malformed or deep directory structures
