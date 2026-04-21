# Vite App Fixture

Framework: Vite (React)
Tests: Vite config, modern React, CSS assets

## Scan Assertions

- `vite.config.ts` → `role: config`
- `src/main.tsx` → `role: source`
- `src/App.tsx` → `role: source`
- `src/style.css` → `role: source`
- `index.html` → `role: config`

## Expected Detections

- `package.json` → manifest: `package-json`
- `vite.config.ts` → framework hint: vite
- Language: TypeScript
