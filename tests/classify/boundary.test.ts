import { describe, expect, it } from "vitest";

import { buildIntentMap, createFileResolver } from "../../src/classify/index.js";
import type { StructureScan } from "../../src/contracts/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScan(overrides: Partial<StructureScan> & { paths?: StructureScan["paths"] } = {}): StructureScan {
  return {
    schema_version: "2.0",
    run_id: "run-test",
    repo: {
      root: "/tmp/test-repo",
      file_count: 0,
      dir_count: 0,
    },
    detected: {
      languages: [],
      ecosystems: [],
      framework_hints: [],
      manifests: [],
    },
    paths: [],
    excluded_paths: [],
    ...overrides,
  };
}

function dirEntry(path: string): { path: string; kind: "directory"; role: "unknown"; size: 0 } {
  return { path, kind: "directory", role: "unknown", size: 0 };
}

function fileEntry(path: string): { path: string; kind: "file"; role: "source"; size: 0 } {
  return { path, kind: "file", role: "source", size: 0 };
}

// ---------------------------------------------------------------------------
// Flat repo (only root-level files, no directories beyond root)
// ---------------------------------------------------------------------------

describe("boundary - flat repos", () => {
  it("produces empty intent map for a repo with no subdirectories", async () => {
    const scan = makeScan({
      paths: [
        fileEntry("README.md"),
        fileEntry("index.js"),
        fileEntry("package.json"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    expect(intentMap.entries).toHaveLength(0);
  });

  it("resolver returns unknown for all files in a flat repo", async () => {
    const scan = makeScan({
      paths: [
        fileEntry("README.md"),
        fileEntry("index.js"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const resolver = createFileResolver(intentMap);

    expect(resolver("README.md")).toBe("unknown");
    expect(resolver("index.js")).toBe("unknown");
  });

  it("classifies root-level directories in a near-flat repo", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        fileEntry("README.md"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    expect(intentMap.entries).toHaveLength(1);
    const [entry] = intentMap.entries;
    expect(entry!.path).toBe("src");
    expect(entry!.intent).toBe("core-source");
  });
});

// ---------------------------------------------------------------------------
// Unknown-only classification
// ---------------------------------------------------------------------------

describe("boundary - unknown-only classification", () => {
  it("emits unknown entries for unrecognizable directories", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("foobar"),
        dirEntry("custom"),
        dirEntry("internal"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    expect(intentMap.entries).toHaveLength(3);

    for (const entry of intentMap.entries) {
      expect(entry.intent).toBe("unknown");
      expect(entry.confidence).toBe("low");
    }
  });

  it("all entries have unique paths even when all are unknown", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("a"),
        dirEntry("b"),
        dirEntry("c"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const paths = intentMap.entries.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("resolver returns unknown for files in unknown-classified directories", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("custom"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const resolver = createFileResolver(intentMap);

    expect(resolver("custom/file.ts")).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Empty directory tolerance
// ---------------------------------------------------------------------------

describe("boundary - empty directories", () => {
  it("classifies empty directories if their name matches a rule", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("tests"),
        dirEntry("docs"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    expect(byPath.get("tests")?.intent).toBe("test-infrastructure");
    expect(byPath.get("docs")?.intent).toBe("docs");
  });

  it("empty unknown directories are classified as unknown", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("empty-dir"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    expect(intentMap.entries).toHaveLength(1);
    const [entry] = intentMap.entries;
    expect(entry!.intent).toBe("unknown");
    expect(entry!.confidence).toBe("low");
  });

  it("handles mix of empty and non-empty directories", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/utils"),
        dirEntry("tests"),
        dirEntry("empty"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    expect(byPath.get("src")?.intent).toBe("core-source");
    expect(byPath.get("src/utils")?.intent).toBe("core-source"); // inherits
    expect(byPath.get("tests")?.intent).toBe("test-infrastructure");
    expect(byPath.get("empty")?.intent).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Deeply nested paths (beyond maxDepth)
// ---------------------------------------------------------------------------

describe("boundary - deeply nested paths", () => {
  it("does not classify directories deeper than maxDepth", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/a"),
        dirEntry("src/a/b"),
        dirEntry("src/a/b/c"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const paths = intentMap.entries.map((e) => e.path);

    expect(paths).toContain("src");
    expect(paths).toContain("src/a");
    expect(paths).not.toContain("src/a/b");
    expect(paths).not.toContain("src/a/b/c");
  });

  it("resolver resolves deeply nested files via nearest classified ancestor", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/a"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const resolver = createFileResolver(intentMap);

    // src/a is classified, src/a/b/c resolves to src/a even though
    // src/a/b/c is beyond maxDepth
    expect(resolver("src/a/b/c/d.ts")).toBe("core-source");
  });
});

// ---------------------------------------------------------------------------
// Manifest edge cases
// ---------------------------------------------------------------------------

describe("boundary - manifest hints", () => {
  it("only counts manifests directly inside the directory", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("packages"),
        dirEntry("packages/core"),
        dirEntry("packages/core/src"),
      ],
      detected: {
        languages: ["TypeScript"],
        ecosystems: ["node"],
        framework_hints: [],
        manifests: [
          { path: "packages/core/package.json", kind: "package-json" },
          // This manifest is nested inside src/, NOT directly in packages/core/
          { path: "packages/core/src/package.json", kind: "package-json" },
        ],
      },
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    // packages/core should be library-surface because it has a direct manifest
    expect(byPath.get("packages/core")?.intent).toBe("library-surface");
  });

  it("does not count manifests in subdirectories as direct hints", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/sub"),
      ],
      detected: {
        languages: ["TypeScript"],
        ecosystems: ["node"],
        framework_hints: [],
        manifests: [
          { path: "src/sub/package.json", kind: "package-json" },
        ],
      },
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    // src has no direct manifest, so it matches core-source rule (by name)
    expect(byPath.get("src")?.intent).toBe("core-source");
  });
});

// ---------------------------------------------------------------------------
// Path normalization edge cases
// ---------------------------------------------------------------------------

describe("boundary - path normalization", () => {
  it("handles paths with trailing slashes in scan data", async () => {
    // Note: scan data shouldn't have trailing slashes, but the engine normalizes
    const scan = makeScan({
      paths: [
        { path: "src/", kind: "directory", role: "unknown", size: 0 },
        { path: "src/utils/", kind: "directory", role: "unknown", size: 0 },
      ],
    });

    // Should not throw and should produce valid results
    const intentMap = await buildIntentMap(scan);
    expect(intentMap.entries.length).toBeGreaterThan(0);
  });

  it("handles resolver with absolute-style paths without hanging", () => {
    const intentMap = {
      schema_version: "2.0" as const,
      run_id: "run-test",
      entries: [
        {
          path: "src",
          depth: 1 as const,
          intent: "core-source" as const,
          confidence: "medium" as const,
          reason: "source",
          method: "static" as const,
        },
      ],
    };

    const resolver = createFileResolver(intentMap);
    // Absolute paths don't match relative entries — the important thing
    // is that the resolver terminates (no infinite loop at root).
    expect(resolver("/src/index.ts")).toBe("unknown");
    expect(resolver("/other/file.ts")).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Mixed signals (directories that could match multiple rules)
// ---------------------------------------------------------------------------

describe("boundary - mixed signals", () => {
  it("a directory named 'test' inside 'examples/' is classified as test-infrastructure", async () => {
    // test-directory rule (EXACT_MATCH=100) should beat any parent inheritance
    const scan = makeScan({
      paths: [
        dirEntry("examples"),
        dirEntry("examples/test"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    expect(byPath.get("examples")?.intent).toBe("example-fixtures");
    expect(byPath.get("examples/test")?.intent).toBe("test-infrastructure");
  });

  it("a directory named 'docs' inside 'src/' is classified as docs", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/docs"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    expect(byPath.get("src")?.intent).toBe("core-source");
    expect(byPath.get("src/docs")?.intent).toBe("docs");
  });
});
