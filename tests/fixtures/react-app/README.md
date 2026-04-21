# React App Fixture

Framework: React (CRA-style)
Tests: Class components, setup files, public assets

## Scan Assertions

- `src/App.tsx` → `role: source`
- `src/index.tsx` → `role: source`
- `src/setupTests.ts` → `role: tests`
- `public/index.html` → `role: config`
- `package.json` → manifest: `package-json`

## Expected Detections

- `package.json` → manifest: `package-json`
- Language: JavaScript/TypeScript
