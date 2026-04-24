import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { PipelineCache } from "./cache.js";
import { runFullPipeline } from "./pipeline.js";
import type { CacheEntry } from "./pipeline.js";

// ---------------------------------------------------------------------------
// FileSummary — per-file structured summary returned by get_file_summary
// ---------------------------------------------------------------------------

export interface FileSummary {
  path: string;
  role: string;
  is_entrypoint: boolean;
  entrypoint_kind?: string;
  is_key_path: boolean;
  key_path_role?: string;
  fan_in_count: number;
  fan_out_count: number;
  framework_signals: string[];
  in_first_read_path: boolean;
  first_read_why?: string;
  is_deferred: boolean;
  agent_hints: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

function getOrCreateEntry(
  cache: PipelineCache,
  repoRoot: string,
  include: readonly string[],
  exclude: readonly string[],
): Promise<CacheEntry> {
  const key = cache.makeKey(repoRoot, include, exclude);
  let entry = cache.get(key);

  if (!entry) {
    entry = runFullPipeline(repoRoot, include, exclude);
    cache.set(key, entry);
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

export function registerAllTools(
  server: McpServer,
  cache: PipelineCache,
): void {
  // ---- Tool 1: scan_repo ------------------------------------------------
  server.registerTool(
    "scan_repo",
    {
      description: "Scan a repository's directory tree structure. Returns raw file tree, language detection, ecosystem detection, and framework hints. Does NOT return entrypoints, import graph, key paths, or agent hints. Use before get_signals if you need intermediate scan data.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        include: z
          .array(z.string())
          .optional()
          .describe("Restrict analysis to repo-relative subtrees"),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Add explicit exclude rules"),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(
          cache,
          params.repo_root,
          params.include ?? [],
          params.exclude ?? [],
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(entry.scan, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---- Tool 2: get_signals ----------------------------------------------
  server.registerTool(
    "get_signals",
    {
      description: "Extract signals from a repository: entrypoints, commands, import edges, priority candidates, and defer candidates. Does NOT return key paths, first-read recommendations, or agent hints. Use get_context_index if you need the full canonical analysis.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        include: z
          .array(z.string())
          .optional()
          .describe("Restrict analysis to repo-relative subtrees"),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Add explicit exclude rules"),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(
          cache,
          params.repo_root,
          params.include ?? [],
          params.exclude ?? [],
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(entry.signals, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---- Tool 3: get_context_index ----------------------------------------
  server.registerTool(
    "get_context_index",
    {
      description: "Run the complete repo-compass pipeline and return the ContextIndex — the canonical comprehensive analysis artifact. Returns repo shape, entrypoints with summaries, key paths with priorities, first-read path, critical paths, defer-for-now, and agent hints. This is the recommended one-stop tool for full repo analysis. Does NOT return raw file contents.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        include: z
          .array(z.string())
          .optional()
          .describe("Restrict analysis to repo-relative subtrees"),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Add explicit exclude rules"),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(
          cache,
          params.repo_root,
          params.include ?? [],
          params.exclude ?? [],
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(entry.contextIndex, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---- Tool 4: get_entrypoints ------------------------------------------
  server.registerTool(
    "get_entrypoints",
    {
      description: "Return only the entrypoints array from a full repo analysis. Each entrypoint includes path, kind, confidence, reason, and evidence. Smaller payload than get_context_index. Does NOT return commands, import graph, key paths, or first-read path.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        include: z
          .array(z.string())
          .optional()
          .describe("Restrict analysis to repo-relative subtrees"),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Add explicit exclude rules"),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(
          cache,
          params.repo_root,
          params.include ?? [],
          params.exclude ?? [],
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(entry.contextIndex.entrypoints, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---- Tool 5: get_import_graph -----------------------------------------
  server.registerTool(
    "get_import_graph",
    {
      description: "Return only the import graph (nodes and edges) from a full repo analysis. Nodes include path, kind, and role. Edges include import kind. Does NOT return entrypoints, commands, or key paths.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        include: z
          .array(z.string())
          .optional()
          .describe("Restrict analysis to repo-relative subtrees"),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Add explicit exclude rules"),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(
          cache,
          params.repo_root,
          params.include ?? [],
          params.exclude ?? [],
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(entry.contextIndex.graph, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---- Tool 6: get_key_paths --------------------------------------------
  server.registerTool(
    "get_key_paths",
    {
      description: "Return only the key paths array from a full repo analysis. Each key path includes role (entry/core/config/workflow/test/docs), summary, priority, and confidence. Does NOT return entrypoints or import graph.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        include: z
          .array(z.string())
          .optional()
          .describe("Restrict analysis to repo-relative subtrees"),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Add explicit exclude rules"),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(
          cache,
          params.repo_root,
          params.include ?? [],
          params.exclude ?? [],
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(entry.contextIndex.key_paths, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---- Tool 7: get_file_summary -----------------------------------------
  server.registerTool(
    "get_file_summary",
    {
      description: "Return a structured per-file summary: role, entrypoint status, key path status, import fan-in/fan-out counts, framework relevance, and whether the file is in the first-read path or deferred. Use to get targeted context about a specific file without reading raw file. Does NOT return file contents or line-level analysis.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        path: z.string().describe("Repo-relative path to the file or directory"),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(cache, params.repo_root, [], []);
        const { contextIndex, signals } = entry;
        const filePath = params.path;

        // Role from scan
        const pathEntry = entry.scan.paths.find(
          (p) => p.path === filePath,
        );
        const role = pathEntry?.role ?? "unknown";
        const isDirectory = pathEntry?.kind === "directory";

        // Entrypoint info (only for files)
        const entrypoint = isDirectory
          ? undefined
          : contextIndex.entrypoints.find((e) => e.path === filePath);
        const isEntrypoint = entrypoint !== undefined;

        // Key path info
        const keyPath = contextIndex.key_paths.find(
          (k) => k.path === filePath,
        );
        const isKeyPath = keyPath !== undefined;

        // Fan-in/fan-out from edges (only meaningful for files)
        const fanInCount = isDirectory
          ? 0
          : signals.edges.filter((e) => e.to === filePath).length;
        const fanOutCount = isDirectory
          ? 0
          : signals.edges.filter((e) => e.from === filePath).length;

        // File-specific framework signals (not repo-level)
        const frameworkSignals: string[] = [];
        const frameworkCandidate = signals.priority_candidates.find(
          (c) => c.path === filePath && c.signal === "framework-core",
        );
        if (frameworkCandidate) {
          frameworkSignals.push(frameworkCandidate.reason);
        }
        // Also include repo-level hints if this file is an entrypoint
        // (entrypoints are likely to be the framework's main files)
        if (isEntrypoint && contextIndex.repo.framework_hints.length > 0) {
          frameworkSignals.push(...contextIndex.repo.framework_hints);
        }

        // First-read path
        const firstReadItem = contextIndex.first_read_path.find(
          (f) => f.path === filePath,
        );
        const inFirstReadPath = firstReadItem !== undefined;

        // Deferred
        const isDeferred = contextIndex.defer_for_now.some(
          (d) => d.path === filePath,
        );

        // Agent hints referencing this file
        const agentHints = contextIndex.agent_hints
          .filter((h) => h.evidence?.includes(filePath) ?? false)
          .map((h) => h.text);

        const summary: FileSummary = {
          path: filePath,
          role,
          is_entrypoint: isEntrypoint,
          ...(isEntrypoint ? { entrypoint_kind: entrypoint.kind } : {}),
          is_key_path: isKeyPath,
          ...(isKeyPath ? { key_path_role: keyPath.role } : {}),
          fan_in_count: fanInCount,
          fan_out_count: fanOutCount,
          framework_signals: frameworkSignals,
          in_first_read_path: inFirstReadPath,
          ...(inFirstReadPath
            ? { first_read_why: firstReadItem.why_now }
            : {}),
          is_deferred: isDeferred,
          agent_hints: agentHints,
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(summary, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
