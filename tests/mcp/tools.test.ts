import { describe, expect, it, vi } from "vitest";

import type { PipelineCache } from "../../src/mcp/cache.js";
import type { CacheEntry } from "../../src/mcp/pipeline.js";
import { registerAllTools } from "../../src/mcp/tools.js";

function createMockServer(): {
  registerTool: ReturnType<typeof vi.fn>;
} {
  return {
    registerTool: vi.fn(),
  };
}

function createMockCache(): PipelineCache {
  const resolved: CacheEntry = {
    input: {
      schema_version: "2.0",
      run_id: "test-run",
      repo_root: "/test",
      output_root: "/test",
      include: [],
      exclude: [],
      max_files: 50_000,
      options: {
        follow_symlinks: false,
        detect_frameworks: true,
        extract_import_graph: true,
        emit_debug_artifacts: false,
        emit_agent_start: false,
        freshness_mode: "off",
      },
    },
    scan: {
      schema_version: "2.0",
      run_id: "test-run",
      repo: { root: "/test", file_count: 1, dir_count: 0 },
      detected: {
        languages: ["typescript"],
        ecosystems: ["node"],
        framework_hints: [],
        manifests: [],
      },
      paths: [
        { path: "src/index.ts", kind: "file", role: "source", size: 100 },
      ],
      excluded_paths: [],
    },
    intentMap: {
      schema_version: "2.0",
      run_id: "test-run",
      entries: [],
    },
    signals: {
      schema_version: "2.0",
      run_id: "test-run",
      entrypoints: [
        {
          id: "ep-1",
          path: "src/index.ts",
          kind: "app",
          confidence: "high",
          reason: "has main",
          evidence: ["src/index.ts"],
        },
      ],
      commands: [],
      edges: [{ from: "src/index.ts", to: "src/lib.ts", kind: "import" }],
      priority_candidates: [],
      defer_candidates: [],
      warnings: [],
    },
    comprehension: {
      schema_version: "2.0",
      run_id: "test-run",
      repo: {
        name: "test-repo",
        root: "/test",
        repo_shape: "application",
        primary_languages: ["typescript"],
        detected_ecosystems: ["node"],
        framework_hints: [],
      },
      meta: {
        run_id: "test-run",
        snapshot_id: "snap-1",
        generated_at: "2026-01-01T00:00:00Z",
        included_paths: [],
        excluded_paths: [],
      },
      artifacts: {
        manifests: [],
        commands: [],
      },
      graph: {
        nodes: [
          { id: "n1", path: "src/index.ts", kind: "file", role: "source" },
        ],
        edges: [{ from: "src/index.ts", to: "src/lib.ts", kind: "import" }],
      },
      entrypoints: [
        {
          id: "ep-1",
          path: "src/index.ts",
          kind: "app",
          summary: "Entry point",
          reason: "has main",
          confidence: "high",
          evidence: ["src/index.ts"],
        },
      ],
      first_read_path: [],
      key_paths: [
        {
          path: "src/index.ts",
          kind: "file",
          role: "entry",
          summary: "Entry point",
          priority: "high",
          reason: "main entry",
          confidence: "high",
          evidence: ["src/index.ts"],
        },
      ],
      critical_paths: [],
      defer_for_now: [],
      agent_hints: [
        {
          kind: "run",
          text: "check the main entry",
          reason: "main entrypoint detected",
          confidence: "high",
          evidence: ["src/index.ts"],
        },
      ],
      warnings: [],
      freshness: {
        mode: "off",
        status: "unknown",
        generated_from: "full",
        reason: "Freshness tracking is disabled for this run.",
      },
    },
    contextIndex: {
      schema_version: "2.0",
      repo: {
        name: "test-repo",
        root: "/test",
        repo_shape: "application",
        primary_languages: ["typescript"],
        detected_ecosystems: ["node"],
        framework_hints: [],
      },
      meta: {
        run_id: "test-run",
        snapshot_id: "snap-1",
        generated_at: "2026-01-01T00:00:00Z",
        included_paths: [],
        excluded_paths: [],
      },
      artifacts: {
        manifests: [],
        commands: [],
      },
      graph: {
        nodes: [],
        edges: [],
      },
      entrypoints: [
        {
          id: "ep-1",
          path: "src/index.ts",
          kind: "app",
          summary: "Main entry",
          reason: "has main",
          confidence: "high",
          evidence: ["src/index.ts"],
        },
      ],
      first_read_path: [],
      key_paths: [],
      critical_paths: [],
      defer_for_now: [],
      agent_hints: [
        {
          kind: "run",
          text: "check the main entry",
          reason: "main entrypoint detected",
          confidence: "high",
          evidence: ["src/index.ts"],
        },
      ],
      warnings: [],
      freshness: {
        mode: "off",
        status: "unknown",
        generated_from: "full",
        reason: "Freshness tracking is disabled for this run.",
      },
    },
  };

  return {
    makeKey: () => "test-key",
    get: () => Promise.resolve(resolved),
    set: () => {},
    clear: () => {},
  } as unknown as PipelineCache;
}

describe("registerAllTools", () => {
  it("registers all 7 tools", () => {
    const server = createMockServer() as ReturnType<typeof createMockServer>;
    const cache = createMockCache();

    registerAllTools(server as never, cache);

    expect(server.registerTool).toHaveBeenCalledTimes(7);
  });

  it("registers scan_repo as the first tool", () => {
    const server = createMockServer() as ReturnType<typeof createMockServer>;
    const cache = createMockCache();

    registerAllTools(server as never, cache);

    expect(server.registerTool).toHaveBeenNthCalledWith(
      1,
      "scan_repo",
      expect.objectContaining({
        description: expect.stringContaining("Scan"),
        annotations: { readOnlyHint: true },
      }),
      expect.any(Function),
    );
  });

  it("registers get_file_summary as the last tool", () => {
    const server = createMockServer() as ReturnType<typeof createMockServer>;
    const cache = createMockCache();

    registerAllTools(server as never, cache);

    expect(server.registerTool).toHaveBeenNthCalledWith(
      7,
      "get_file_summary",
      expect.objectContaining({
        description: expect.stringContaining("structured per-file"),
        annotations: { readOnlyHint: true },
      }),
      expect.any(Function),
    );
  });

  it("all tools have readOnlyHint annotation", () => {
    const server = createMockServer() as ReturnType<typeof createMockServer>;
    const cache = createMockCache();

    registerAllTools(server as never, cache);

    const calls = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls;
    for (const [, config] of calls) {
      expect(config.annotations).toEqual({ readOnlyHint: true });
    }
  });
});
