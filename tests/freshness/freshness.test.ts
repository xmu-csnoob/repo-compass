import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildFreshnessState,
  computeFreshness,
  loadPreviousFreshnessState,
  saveFreshnessState,
} from "../../src/freshness/index.js";
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

function makeScan(paths: { path: string; size: number }[]): StructureScan {
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
      path_signatures: { "a.ts": 100 },
    };
    const result = computeFreshness(input, scan, previous);

    expect(result.status).toBe("degraded");
    expect(result.generated_from).toBe("full");
    expect(result.reason).toContain("Repository root changed");
    expect(result.changed_paths).toEqual([]);
  });

  it("watch mode with no changes returns fresh and incremental", () => {
    const input = makeInput(repoRoot, "watch");
    const scan = makeScan([{ path: "a.ts", size: 100 }]);
    const previous = {
      run_id: "run-prev",
      generated_at: "2026-04-21T12:00:00Z",
      snapshot_id: "snap-prev",
      repo_root: "/repo",
      path_signatures: { "a.ts": 100 },
    };
    const result = computeFreshness(input, scan, previous);

    expect(result.status).toBe("fresh");
    expect(result.generated_from).toBe("incremental");
    expect(result.reason).toBe("No filesystem changes detected since last run.");
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
      path_signatures: { "a.ts": 100 },
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
      path_signatures: { "a.ts": 100 },
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
      path_signatures: { "a.ts": 100 },
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
    expect(state.path_signatures).toEqual({ "a.ts": 100 });
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
});
