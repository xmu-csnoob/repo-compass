# ONBOARDING

## What Was Detected
- Structural shape (coarse): `tool`.
- Framework hints: node-cli
- Phase 1 output is limited to static structural signals and conservative derived views.

## Read First
- `package.json`: Start here to understand workspace shape, scripts, and dependencies.
- `src/index.ts`: This is likely the first runtime hop.
- `README.md` [medium]: This path appears central to repo comprehension.

## Likely Entrypoints
- `src/index.ts` (cli): CLI entrypoint — invoked directly from the command line.

## Getting Oriented
- Use npm run dev to start the primary workflow.
- Use npm test to exercise the existing test workflow.

## Safe Early Edit Zones
- Prefer edits under src before touching config, build, generated, or vendor paths.

## Defer For Now
