import path from "node:path";

import { describe, expect, it } from "vitest";

import { runFullPipeline } from "../../src/mcp/pipeline.js";

describe("runFullPipeline", () => {
  it("returns a complete CacheEntry for node-cli fixture", async () => {
    const repoRoot = path.resolve("tests/fixtures/node-cli");
    const entry = await runFullPipeline(repoRoot, [], []);

    expect(entry.input).toBeDefined();
    expect(entry.input.run_id).toMatch(/^mcp-/);
    expect(entry.input.repo_root).toBe(repoRoot);

    expect(entry.scan).toBeDefined();
    expect(entry.scan.paths.length).toBeGreaterThan(0);

    expect(entry.intentMap).toBeDefined();

    expect(entry.signals).toBeDefined();

    expect(entry.comprehension).toBeDefined();

    expect(entry.contextIndex).toBeDefined();
    expect(entry.contextIndex.entrypoints).toBeDefined();
    expect(entry.contextIndex.graph).toBeDefined();
    expect(entry.contextIndex.key_paths).toBeDefined();
    expect(entry.contextIndex.repo).toBeDefined();
  });

  it("uses empty include/exclude arrays when omitted", async () => {
    const repoRoot = path.resolve("tests/fixtures/node-cli");
    const entry = await runFullPipeline(repoRoot, [], []);

    expect(entry.input.include).toEqual([]);
    expect(entry.input.exclude).toEqual([]);
  });

  it("always has freshness_mode off", async () => {
    const repoRoot = path.resolve("tests/fixtures/node-cli");
    const entry = await runFullPipeline(repoRoot, [], []);

    expect(entry.input.options.freshness_mode).toBe("off");
  });

  it("produces a context-index with entrypoints from node-cli", async () => {
    const repoRoot = path.resolve("tests/fixtures/node-cli");
    const entry = await runFullPipeline(repoRoot, [], []);
    const { contextIndex } = entry;

    expect(contextIndex.entrypoints.length).toBeGreaterThanOrEqual(1);
    expect(contextIndex.repo.framework_hints).toBeDefined();
  });

  it("is reusable (no side effects on cache)", async () => {
    const repoRoot = path.resolve("tests/fixtures/node-cli");
    const [a, b] = await Promise.all([
      runFullPipeline(repoRoot, [], []),
      runFullPipeline(repoRoot, [], []),
    ]);

    expect(a.contextIndex.entrypoints).toEqual(b.contextIndex.entrypoints);
  });
});
