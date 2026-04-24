# repo-compass MCP Server

repo-compass can run as an MCP (Model Context Protocol) server, providing 7 tools for codebase analysis to LLM clients like Claude Code.

## Startup

```bash
# Start MCP server over stdio
node dist/cli/index.js --mcp
```

### Claude Code Configuration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "repo-compass": {
      "command": "node",
      "args": ["dist/cli/index.js", "--mcp"]
    }
  }
}
```

## Tools

### 1. `scan_repo`

Scan a repository's directory tree structure.

**Input:** `{ repo_root: string, include?: string[], exclude?: string[] }`

**Returns:** `StructureScan` — raw file tree, language detection, ecosystem detection, and framework hints.

Does NOT return entrypoints, import graph, key paths, or agent hints. Use before `get_signals` if you need intermediate scan data.

### 2. `get_signals`

Extract signals from a repository.

**Input:** `{ repo_root: string, include?: string[], exclude?: string[] }`

**Returns:** `SignalExtraction` — entrypoints, commands, import edges, priority candidates, and defer candidates.

Does NOT return key paths, first-read recommendations, or agent hints. Use `get_context_index` for the full analysis.

### 3. `get_context_index` (recommended one-stop tool)

Run the complete pipeline and return the canonical analysis artifact.

**Input:** `{ repo_root: string, include?: string[], exclude?: string[] }`

**Returns:** `ContextIndex` — repo shape, entrypoints with summaries, key paths with priorities, first-read path, critical paths, defer-for-now, and agent hints.

### 4. `get_entrypoints`

**Input:** `{ repo_root: string }`

**Returns:** `entrypoint[]` — each with path, kind, confidence, reason, and evidence. Smaller payload than `get_context_index`.

### 5. `get_import_graph`

**Input:** `{ repo_root: string }`

**Returns:** `{ nodes: GraphNode[], edges: GraphEdge[] }` — import graph from the full analysis.

### 6. `get_key_paths`

**Input:** `{ repo_root: string }`

**Returns:** `key_path[]` — each with role (entry/core/config/workflow/test/docs), summary, priority, and confidence.

### 7. `get_file_summary`

Per-file structured summary for targeted context without reading raw file.

**Input:** `{ repo_root: string, path: string }`

**Returns:** `FileSummary` — role, entrypoint status, key path status, import fan-in/fan-out counts, framework relevance, first-read path status, defer status, and agent hints.

## Caching

The MCP server uses a session-scoped `PipelineCache`:

- Each unique `(repo_root, include, exclude)` tuple is scanned once
- Subsequent tool calls reuse cached intermediate results
- Cache is cleared on session end (SIGINT/SIGTERM)
- Freshness mode is always `"off"` in MCP mode (no persisted state between sessions)

## Architecture

```
User calls scan_repo
  → cache miss → normalizeRepoInput → scanRepository
  → cache.set → return StructureScan

User calls get_signals (same repo)
  → cache hit (scan) → buildIntentMap → extractSignals
  → cache.set → return SignalExtraction

User calls get_context_index (same repo)
  → cache hit (signals) → buildComprehension → renderContextIndex
  → cache.set → return ContextIndex

User calls get_entrypoints (same repo)
  → cache hit (contextIndex) → extract entrypoints subset → return entrypoints[]
```

## Error Handling

All tools return structured error responses (not exceptions):

```json
{
  "content": [{ "type": "text", "text": "Error: <message>" }],
  "isError": true
}
```

Common error cases:
- Invalid `repo_root`: directory not accessible
- Pipeline error: exceeds max files, scan failure
- Input validation: Zod schema violations

## CLI vs MCP Mode

| Aspect | CLI Mode | MCP Mode |
|--------|---------|----------|
| Command | `node dist/cli/index.js <path>` | `node dist/cli/index.js --mcp` |
| Output | Writes artifacts to `work/runs/` | Returns JSON via stdio |
| Freshness | Configurable (off/watch/ci) | Always `off` |
| Use case | CI/CD, batch analysis | Interactive LLM analysis |
| MCP SDK loaded | No (dynamic import) | Yes |

## Development

```bash
# Build
npm run build

# Run tests
npx vitest run tests/mcp/

# Run with MCP Inspector (for testing)
npx @modelcontextprotocol/inspector node dist/cli/index.js --mcp
```
