import { mkdir, mkdtemp, rm, writeFile, readFile, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildFreshnessState,
  computeFreshness,
  loadPreviousFreshnessState,
  saveFreshnessState,
} from "../../src/freshness/index.js";
import { runPipeline } from "../../src/cli/index.js";
import type { RepoInput, StructureScan } from "../../src/contracts/index.js";

const tempDirectories: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "repo-compass-freshness-"));
  tempDirectories.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function makeInput(repoRoot: string, mode: "off" | "watch" | "ci"): RepoInput {
  return {
    schema_version: "2.0",
    run_id: "run-test",
    repo_root: repoRoot,
    output_root: repoRoot,
    include: [],
    exclude: [],
    max_files: 50_000,
    options: {
      follow_symlinks: false,
      detect_frameworks: true,
      extract_import_graph: true,
      emit_debug_artifacts: false,
      emit_agent_start: true,
      freshness_mode: mode,
    },
  };
}

function makeScan(paths: { path: string; size: number; mtime?: number }[]): StructureScan {
  return {
    schema_version: "2.0",
    run_id: "run-test",
    repo: {
      root: "/repo",
      file_count: paths.filter((p) => !p.path.endsWith("/")).length,
      dir_count: paths.filter((p) => p.path.endsWith("/")).length,
    },
    detected: {
      languages: [],
      ecosystems: [],
      framework_hints: [],
      manifests: [],
    },
    paths: paths.map((p) => ({
      path: p.path,
      kind: p.path.endsWith("/") ? ("directory" as const) : ("file" as const),
      role: "source" as const,
      size: p.size,
      mtime: p.mtime ?? 0,
    })),
    excluded_paths: [],
  };
}

describe("computeFreshness", () => {
  const repoRoot = "/repo";

  it("off mode returns unknown and full", () => {
    const input = makeInput(repoRoot, "off");
    const scan = makeScan([{ path: "a.ts", size: 100 }]);
    const result = computeFreshness(input, scan, undefined);

    expect(result.status).toBe("unknown");
    expect(result.generated_from).toBe("full");
    expect(result.reason).toBe("Freshness tracking is disabled for this run.");
    expect(result.changed_paths).toEqual([]);
  });

  it("ci mode returns fresh and full", () => {
    const input = makeInput(repoRoot, "ci");
    const scan = makeScan([{ path: "a.ts", size: 100 }]);
    const result = computeFreshness(input, scan, undefined);

    expect(result.status).toBe("fresh");
    expect(result.generated_from).toBe("full");
    expect(result.reason).toBe("CI mode performed a trusted full canonical rebuild.");
    expect(result.changed_paths).toEqual([]);
  });

  it("watch mode with no prior state returns degraded and full", () => {
    const input = makeInput(repoRoot, "watch");
    const scan = makeScan([{ path: "a.ts", size: 100 }]);
    const result = computeFreshness(input, scan, undefined);

    expect(result.status).toBe("degraded");
    expect(result.generated_from).toBe("full");
    expect(result.reason).toContain("No prior freshness state available");
    expect(result.changed_paths).toEqual([]);
  });

  it("watch mode with changed repo_root returns degraded and full", () => {
    const input = makeInput("/new-repo", "watch");
    const scan = makeScan([{ path: "a.ts", size: 100 }]);
    const previous = {
      run_id: "run-prev",
      generated_at: "2026-04-21T12:00:00Z",
      snapshot_id: "snap-prev",
      repo_root: "/old-repo",
      path_signatures: { "a.ts": "0:100" },
    };
    const result = computeFreshness(input, scan, previous);

    expect(result.status).toBe("degraded");
    expect(result.generated_from).toBe("full");
    expect(result.reason).toContain("Repository root changed");
    expect(result.changed_paths).toEqual([]);
  });

  it("watch mode with no changes returns fresh and full (always rebuilds for trust)", () => {
    const input = makeInput(repoRoot, "watch");
    const scan = makeScan([{ path: "a.ts", size: 100 }]);
    const previous = {
      run_id: "run-prev",
      generated_at: "2026-04-21T12:00:00Z",
      snapshot_id: "snap-prev",
      repo_root: "/repo",
      path_signatures: { "a.ts": "0:100" },
    };
    const result = computeFreshness(input, scan, previous);

    expect(result.status).toBe("fresh");
    expect(result.generated_from).toBe("full");
    expect(result.reason).toBe(
      "No filesystem changes detected; performed full canonical rebuild for trust.",
    );
    expect(result.changed_paths).toEqual([]);
  });

  it("watch mode with detected changes returns fresh and full", () => {
    const input = makeInput(repoRoot, "watch");
    const scan = makeScan([
      { path: "a.ts", size: 100 },
      { path: "b.ts", size: 200 },
    ]);
    const previous = {
      run_id: "run-prev",
      generated_at: "2026-04-21T12:00:00Z",
      snapshot_id: "snap-prev",
      repo_root: "/repo",
      path_signatures: { "a.ts": "0:100" },
    };
    const result = computeFreshness(input, scan, previous);

    expect(result.status).toBe("fresh");
    expect(result.generated_from).toBe("full");
    expect(result.reason).toContain("Filesystem changes detected in 1 path(s)");
    expect(result.changed_paths).toEqual(["b.ts"]);
  });

  it("watch mode detects size changes as changes", () => {
    const input = makeInput(repoRoot, "watch");
    const scan = makeScan([{ path: "a.ts", size: 200 }]);
    const previous = {
      run_id: "run-prev",
      generated_at: "2026-04-21T12:00:00Z",
      snapshot_id: "snap-prev",
      repo_root: "/repo",
      path_signatures: { "a.ts": "0:100" },
    };
    const result = computeFreshness(input, scan, previous);

    expect(result.status).toBe("fresh");
    expect(result.generated_from).toBe("full");
    expect(result.changed_paths).toEqual(["a.ts"]);
  });

  it("watch mode detects deleted paths as changes", () => {
    const input = makeInput(repoRoot, "watch");
    const scan = makeScan([]);
    const previous = {
      run_id: "run-prev",
      generated_at: "2026-04-21T12:00:00Z",
      snapshot_id: "snap-prev",
      repo_root: "/repo",
      path_signatures: { "a.ts": "0:100" },
    };
    const result = computeFreshness(input, scan, previous);

    expect(result.status).toBe("fresh");
    expect(result.generated_from).toBe("full");
    expect(result.changed_paths).toEqual(["a.ts"]);
  });
});

describe("buildFreshnessState", () => {
  it("produces a state matching the input and scan", () => {
    const input = makeInput("/repo", "watch");
    const scan = makeScan([{ path: "a.ts", size: 100 }]);
    const state = buildFreshnessState(input, scan);

    expect(state.run_id).toBe("run-test");
    expect(state.snapshot_id).toBe("run-test");
    expect(state.repo_root).toBe("/repo");
    expect(state.path_signatures).toEqual({ "a.ts": "0:100" });
    expect(new Date(state.generated_at).toISOString()).toBe(state.generated_at);
  });
});

describe("saveFreshnessState and loadPreviousFreshnessState", () => {
  it("round-trips a freshness state through the filesystem", async () => {
    const tempDir = await makeTempDir();
    const input = makeInput(tempDir, "watch");
    const scan = makeScan([{ path: "a.ts", size: 100 }]);
    const state = buildFreshnessState(input, scan);

    await saveFreshnessState(tempDir, state);
    const loaded = await loadPreviousFreshnessState(tempDir);

    expect(loaded).toEqual(state);
  });

  it("returns undefined when no state file exists", async () => {
    const tempDir = await makeTempDir();
    const loaded = await loadPreviousFreshnessState(tempDir);
    expect(loaded).toBeUndefined();
  });

  it("returns undefined for malformed state file", async () => {
    const tempDir = await makeTempDir();
    const workDir = path.join(tempDir, "work");
    await mkdir(workDir, { recursive: true });
    const statePath = path.join(workDir, "freshness-state.json");
    await writeFile(statePath, "not-json", "utf8");

    const loaded = await loadPreviousFreshnessState(tempDir);
    expect(loaded).toBeUndefined();
  });

  it("returns undefined for empty path_signatures (hand-written/truncated state)", async () => {
    const tempDir = await makeTempDir();
    const workDir = path.join(tempDir, "work");
    await mkdir(workDir, { recursive: true });
    const statePath = path.join(workDir, "freshness-state.json");
    await writeFile(
      statePath,
      JSON.stringify({
        run_id: "run-test",
        generated_at: "2026-04-21T12:00:00Z",
        snapshot_id: "snap-test",
        repo_root: "/repo",
        path_signatures: {},
      }),
      "utf8",
    );

    const loaded = await loadPreviousFreshnessState(tempDir);
    expect(loaded).toBeUndefined();
  });

  it("returns undefined for non-string signature values", async () => {
    const tempDir = await makeTempDir();
    const workDir = path.join(tempDir, "work");
    await mkdir(workDir, { recursive: true });
    const statePath = path.join(workDir, "freshness-state.json");
    await writeFile(
      statePath,
      JSON.stringify({
        run_id: "run-test",
        generated_at: "2026-04-21T12:00:00Z",
        snapshot_id: "snap-test",
        repo_root: "/repo",
        path_signatures: { "a.ts": 100 }, // number instead of string
      }),
      "utf8",
    );

    const loaded = await loadPreviousFreshnessState(tempDir);
    expect(loaded).toBeUndefined();
  });

  it("returns undefined for malformed signature format (not mtime:size)", async () => {
    const tempDir = await makeTempDir();
    const workDir = path.join(tempDir, "work");
    await mkdir(workDir, { recursive: true });
    const statePath = path.join(workDir, "freshness-state.json");
    await writeFile(
      statePath,
      JSON.stringify({
        run_id: "run-test",
        generated_at: "2026-04-21T12:00:00Z",
        snapshot_id: "snap-test",
        repo_root: "/repo",
        path_signatures: { "a.ts": "invalid-format" },
      }),
      "utf8",
    );

    const loaded = await loadPreviousFreshnessState(tempDir);
    expect(loaded).toBeUndefined();
  });

  it("returns undefined for missing snapshot_id field", async () => {
    const tempDir = await makeTempDir();
    const workDir = path.join(tempDir, "work");
    await mkdir(workDir, { recursive: true });
    const statePath = path.join(workDir, "freshness-state.json");
    await writeFile(
      statePath,
      JSON.stringify({
        run_id: "run-test",
        generated_at: "2026-04-21T12:00:00Z",
        repo_root: "/repo",
        path_signatures: { "a.ts": "0:100" },
      }),
      "utf8",
    );

    const loaded = await loadPreviousFreshnessState(tempDir);
    expect(loaded).toBeUndefined();
  });
});

describe("trust signaling end-to-end (7.4)", () => {
  async function makeFixtureCopy(name: string): Promise<string> {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), `repo-compass-trust-`));
    tempDirectories.push(tempDir);
    const source = path.resolve("tests/fixtures", name);
    const destination = path.join(tempDir, name);
    await cp(source, destination, { recursive: true });
    return destination;
  }

  it("ci mode trust signal: fresh and full in context-index.json", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const result = await runPipeline([repoRoot, "--freshness-mode", "ci"]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);

    const content = await readFile(path.join(runRoot, "context-index.json"), "utf8");
    const data = JSON.parse(content) as { freshness: { mode: string; status: string; generated_from: string } };

    expect(data.freshness.mode).toBe("ci");
    expect(data.freshness.status).toBe("fresh");
    expect(data.freshness.generated_from).toBe("full");
  });

  it("off mode trust signal: unknown in context-index.json", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const result = await runPipeline([repoRoot, "--freshness-mode", "off"]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);

    const content = await readFile(path.join(runRoot, "context-index.json"), "utf8");
    const data = JSON.parse(content) as { freshness: { mode: string; status: string; generated_from: string } };

    expect(data.freshness.mode).toBe("off");
    expect(data.freshness.status).toBe("unknown");
    expect(data.freshness.generated_from).toBe("full");
  });

  it("watch mode with no prior state: degraded and full in context-index.json", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const result = await runPipeline([repoRoot, "--freshness-mode", "watch"]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);

    const content = await readFile(path.join(runRoot, "context-index.json"), "utf8");
    const data = JSON.parse(content) as { freshness: { mode: string; status: string; generated_from: string } };

    expect(data.freshness.mode).toBe("watch");
    expect(data.freshness.status).toBe("degraded");
    expect(data.freshness.generated_from).toBe("full");
  });

  it("off mode does not save state that watch mode can reuse (regression)", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    // First run: off mode - should NOT save usable freshness state
    await runPipeline([repoRoot, "--freshness-mode", "off"]);
    // Second run: watch mode - should be degraded because off didn't leave trusted state
    const result = await runPipeline([repoRoot, "--freshness-mode", "watch"]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);

    const content = await readFile(path.join(runRoot, "context-index.json"), "utf8");
    const data = JSON.parse(content) as { freshness: { mode: string; status: string; generated_from: string } };

    // Watch mode should be degraded because off mode didn't save a trusted state
    expect(data.freshness.mode).toBe("watch");
    expect(data.freshness.status).toBe("degraded");
    expect(data.freshness.generated_from).toBe("full");
  });

  it("watch mode bootstraps trust from first degraded run to second fresh run (regression)", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    // First run: watch with no prior state - saves state even though degraded
    await runPipeline([repoRoot, "--freshness-mode", "watch"]);
    // Second run: watch with prior state - should be fresh/full
    const result = await runPipeline([repoRoot, "--freshness-mode", "watch"]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);

    const content = await readFile(path.join(runRoot, "context-index.json"), "utf8");
    const data = JSON.parse(content) as { freshness: { mode: string; status: string; generated_from: string } };

    // Second watch run should be fresh/full because first run saved state
    expect(data.freshness.mode).toBe("watch");
    expect(data.freshness.status).toBe("fresh");
    expect(data.freshness.generated_from).toBe("full");
  });

  it("hand-written empty freshness-state does not make watch report fresh (regression)", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    // Pre-write a malformed/empty state file
    const workDir = path.join(repoRoot, "work");
    await mkdir(workDir, { recursive: true });
    const statePath = path.join(workDir, "freshness-state.json");
    await writeFile(
      statePath,
      JSON.stringify({
        run_id: "run-test",
        generated_at: "2026-04-21T12:00:00Z",
        snapshot_id: "snap-test",
        repo_root: repoRoot,
        path_signatures: {},
      }),
      "utf8",
    );
    // Watch mode should be degraded because empty signatures are rejected
    const result = await runPipeline([repoRoot, "--freshness-mode", "watch"]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);

    const content = await readFile(path.join(runRoot, "context-index.json"), "utf8");
    const data = JSON.parse(content) as { freshness: { mode: string; status: string; generated_from: string } };

    expect(data.freshness.mode).toBe("watch");
    expect(data.freshness.status).toBe("degraded");
    expect(data.freshness.generated_from).toBe("full");
  });
});
