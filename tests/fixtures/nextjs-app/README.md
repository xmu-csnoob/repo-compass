# Next.js App Fixture

Framework: Next.js (App Router)
Tests: App directory structure, API routes, React components, TypeScript config

## Scan Assertions

- `pages/` → `role: source` (legacy pages router)
- `src/app/` → `role: source` (App Router)
- `next.config.js` → `role: config`
- `src/lib/utils.ts` → `role: source`
- `__tests__/` → `role: tests`

## Expected Detections

- `package.json` → manifest: `package-json`
- `tsconfig.json` → config node
- `next.config.js` → framework hint: next.js
- Language: TypeScript
