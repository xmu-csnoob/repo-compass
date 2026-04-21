# Node.js CLI Fixture

Framework: Node.js CLI tool
Tests: bin entries, command modules, picocolors usage

## Scan Assertions

- `src/index.ts` → `role: source` (entrypoint)
- `src/commands.ts` → `role: source`
- `package.json` bin field → CLI entrypoint detection
- `package.json` scripts → command extraction

## Expected Detections

- `package.json` → manifest: `package-json`, bin entries for CLI
- `package.json` scripts → dev, build, test commands
- Language: TypeScript
