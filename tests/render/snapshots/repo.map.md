# Repo Map

## Repo Snapshot
- Name: `node-cli`
- Shape: `tool`
- Languages: JSON, Markdown, TypeScript
- Framework hints: node-cli

## First Read Path
- `package.json`: Start here to understand workspace shape, scripts, and dependencies.
- `src/index.ts`: This is likely the first runtime hop.
- `README.md` [medium]: This path appears central to repo comprehension.

## Key Paths
- `src/index.ts` (entry): Likely runtime entrypoint.
- `package.json` (config): Package manifest defines the primary Node workspace metadata.
- `tsconfig.json` (core) [medium]: Multiple files depend on this path, so it likely coordinates shared behavior.
- `README.md` (docs) [medium]: Repository overview and contributor-facing orientation.

## Entrypoints
- `src/index.ts` (cli): Script "dev" points to this path.

## Critical Paths
- No multi-hop structural path was inferred from the current static graph.

## Defer For Now
