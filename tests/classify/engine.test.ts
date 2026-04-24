import { describe, expect, it } from "vitest";

import {
  StaticClassifier,
  buildIntentMap,
  createFileResolver,
  resolveFileIntent,
} from "../../src/classify/index.js";
import type {
  DirectoryEvidence,
  IntentMap,
  StructureScan,
} from "../../src/contracts/index.js";

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
// StaticClassifier
// ---------------------------------------------------------------------------

describe("StaticClassifier", () => {
  const classifier = new StaticClassifier();

  it("has method 'static'", () => {
    expect(classifier.method).toBe("static");
  });

  it("classifies a matching directory with high confidence", async () => {
    const evidence: DirectoryEvidence = {
      path: "tests",
      depth: 1,
      children: [],
      manifest_hints: [],
    };

    const result = await classifier.classify(evidence);
    expect(result).toMatchObject({
      path: "tests",
      depth: 1,
      intent: "test-infrastructure",
      confidence: "high",
      method: "static",
    });
    expect(result.reason).toBeDefined();
  });

  it("inherits parent intent when no rule matches", async () => {
    const evidence: DirectoryEvidence = {
      path: "tests/unit",
      depth: 2,
      children: [],
      manifest_hints: [],
      parent_intent: "test-infrastructure",
    };

    const result = await classifier.classify(evidence);
    expect(result).toMatchObject({
      path: "tests/unit",
      depth: 2,
      intent: "test-infrastructure",
      confidence: "medium",
      reason: "inherits intent from parent directory",
      method: "static",
    });
  });

  it("returns unknown when no rule matches and no parent intent", async () => {
    const evidence: DirectoryEvidence = {
      path: "foobar",
      depth: 1,
      children: [],
      manifest_hints: [],
    };

    const result = await classifier.classify(evidence);
    expect(result).toMatchObject({
      path: "foobar",
      depth: 1,
      intent: "unknown",
      confidence: "low",
      reason: "no matching classification rule",
      method: "static",
    });
  });

  it("ignores parent_intent when a rule matches", async () => {
    const evidence: DirectoryEvidence = {
      path: "src",
      depth: 1,
      children: [],
      manifest_hints: [],
      parent_intent: "config",
    };

    const result = await classifier.classify(evidence);
    // src matches core-source rule, should NOT inherit config
    expect(result.intent).toBe("core-source");
    expect(result.confidence).toBe("medium");
  });

  it("suppression-grade parent overrides a non-suppression rule match", async () => {
    // A Python package (python_package=true) nested inside docs_src/ should
    // stay example-fixtures, not become library-surface.
    const evidence: DirectoryEvidence = {
      path: "docs_src/app",
      depth: 2,
      children: [],
      manifest_hints: [],
      parent_intent: "example-fixtures",
      python_package: true,
    };

    const result = await classifier.classify(evidence);
    expect(result.intent).toBe("example-fixtures");
    expect(result.confidence).toBe("high");
    expect(result.reason).toBe("inherits suppression intent from parent directory");
  });

  it("suppression-grade rule overrides a suppression-grade parent", async () => {
    // tests/fixtures: parent is test-infrastructure, rule gives example-fixtures.
    // Both are suppression intents — the rule (example-fixtures) wins.
    const evidence: DirectoryEvidence = {
      path: "tests/fixtures",
      depth: 2,
      children: [],
      manifest_hints: [],
      parent_intent: "test-infrastructure",
    };

    const result = await classifier.classify(evidence);
    expect(result.intent).toBe("example-fixtures");
  });
});

// ---------------------------------------------------------------------------
// buildIntentMap
// ---------------------------------------------------------------------------

describe("buildIntentMap", () => {
  it("classifies depth-1 directories", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("tests"),
        dirEntry("docs"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    expect(intentMap.schema_version).toBe("2.0");
    expect(intentMap.run_id).toBe("run-test");
    expect(intentMap.entries).toHaveLength(3);

    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));
    expect(byPath.get("src")?.intent).toBe("core-source");
    expect(byPath.get("tests")?.intent).toBe("test-infrastructure");
    expect(byPath.get("docs")?.intent).toBe("docs");
  });

  it("classifies depth-2 directories with parent inheritance", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/components"),
        dirEntry("src/utils"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    expect(byPath.get("src")?.intent).toBe("core-source");
    expect(byPath.get("src/components")?.intent).toBe("core-source");
    expect(byPath.get("src/components")?.reason).toBe("inherits intent from parent directory");
    expect(byPath.get("src/utils")?.intent).toBe("core-source");
  });

  it("classifies depth-2 with explicit rules over parent inheritance", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("tests"),
        dirEntry("tests/fixtures"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    expect(byPath.get("tests")?.intent).toBe("test-infrastructure");
    // fixtures matches example-fixtures rule, not inherited test-infrastructure
    expect(byPath.get("tests/fixtures")?.intent).toBe("example-fixtures");
  });

  it("uses manifest hints for library-surface classification", async () => {
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
        ],
      },
    });

    const intentMap = await buildIntentMap(scan);
    const byPath = new Map(intentMap.entries.map((e) => [e.path, e]));

    expect(byPath.get("packages/core")?.intent).toBe("library-surface");
  });

  it("excludes root directory from classification", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("."),
        dirEntry("src"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const paths = intentMap.entries.map((e) => e.path);

    expect(paths).not.toContain(".");
    expect(paths).toContain("src");
  });

  it("ignores files and only classifies directories", async () => {
    const scan = makeScan({
      paths: [
        fileEntry("README.md"),
        dirEntry("src"),
        fileEntry("src/index.ts"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const paths = intentMap.entries.map((e) => e.path);

    expect(paths).toContain("src");
    expect(paths).not.toContain("README.md");
    expect(paths).not.toContain("src/index.ts");
  });

  it("defaults maxDepth to 2", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/a"),
        dirEntry("src/a/b"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const paths = intentMap.entries.map((e) => e.path);

    expect(paths).toContain("src");
    expect(paths).toContain("src/a");
    expect(paths).not.toContain("src/a/b");
  });

  it("respects maxDepth option when set to 1", async () => {
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/a"),
      ],
    });

    const intentMap = await buildIntentMap(scan, { maxDepth: 1 });
    const paths = intentMap.entries.map((e) => e.path);

    expect(paths).toContain("src");
    expect(paths).not.toContain("src/a");
  });

  it("throws RangeError for maxDepth < 1", async () => {
    const scan = makeScan({ paths: [dirEntry("src")] });
    await expect(buildIntentMap(scan, { maxDepth: 0 })).rejects.toThrow(RangeError);
  });

  it("throws RangeError for maxDepth > 2", async () => {
    const scan = makeScan({ paths: [dirEntry("src")] });
    await expect(buildIntentMap(scan, { maxDepth: 3 })).rejects.toThrow(RangeError);
  });

  it("uses custom runId when provided", async () => {
    const scan = makeScan({
      run_id: "scan-run",
      paths: [dirEntry("src")],
    });

    const intentMap = await buildIntentMap(scan, { runId: "custom-run" });
    expect(intentMap.run_id).toBe("custom-run");
  });

  it("falls back to scan.run_id when runId option is omitted", async () => {
    const scan = makeScan({
      run_id: "scan-run",
      paths: [dirEntry("src")],
    });

    const intentMap = await buildIntentMap(scan);
    expect(intentMap.run_id).toBe("scan-run");
  });

  it("validates output against intentMapSchema", async () => {
    const scan = makeScan({ paths: [dirEntry("src")] });
    const intentMap = await buildIntentMap(scan);

    // Should have valid schema_version and no duplicate paths
    expect(intentMap.schema_version).toBe("2.0");
    expect(new Set(intentMap.entries.map((e) => e.path)).size).toBe(
      intentMap.entries.length,
    );
  });

  it("processes directories in breadth-first order", async () => {
    // This ensures parent intents are available before children
    const scan = makeScan({
      paths: [
        dirEntry("src"),
        dirEntry("src/deep"),
        dirEntry("docs"),
        dirEntry("docs/guides"),
      ],
    });

    const intentMap = await buildIntentMap(scan);
    const depths = intentMap.entries.map((e) => e.depth);

    // All depth-1 entries should come before depth-2 entries
    const firstDepth2 = depths.indexOf(2);
    const lastDepth1 = depths.lastIndexOf(1);
    expect(firstDepth2).toBeGreaterThan(lastDepth1);
  });
});

// ---------------------------------------------------------------------------
// createFileResolver
// ---------------------------------------------------------------------------

describe("createFileResolver", () => {
  const intentMap: IntentMap = {
    schema_version: "2.0",
    run_id: "run-test",
    entries: [
      {
        path: "src",
        depth: 1,
        intent: "core-source",
        confidence: "medium",
        reason: "source directory",
        method: "static",
      },
      {
        path: "tests",
        depth: 1,
        intent: "test-infrastructure",
        confidence: "high",
        reason: "test directory",
        method: "static",
      },
      {
        path: "tests/unit",
        depth: 2,
        intent: "test-infrastructure",
        confidence: "medium",
        reason: "inherits from parent",
        method: "static",
      },
    ],
  };

  it("resolves a file in a classified directory", () => {
    const resolver = createFileResolver(intentMap);
    expect(resolver("src/index.ts")).toBe("core-source");
  });

  it("resolves a deeply nested file by nearest ancestor", () => {
    const resolver = createFileResolver(intentMap);
    expect(resolver("src/components/button.tsx")).toBe("core-source");
  });

  it("resolves a file in a depth-2 classified directory", () => {
    const resolver = createFileResolver(intentMap);
    expect(resolver("tests/unit/math.test.ts")).toBe("test-infrastructure");
  });

  it("returns unknown for unclassified paths", () => {
    const resolver = createFileResolver(intentMap);
    expect(resolver("unclassified/file.txt")).toBe("unknown");
  });

  it("returns unknown for root-level files", () => {
    const resolver = createFileResolver(intentMap);
    expect(resolver("README.md")).toBe("unknown");
  });

  it("handles path normalization", () => {
    const resolver = createFileResolver(intentMap);
    expect(resolver("./src/index.ts")).toBe("core-source");
    expect(resolver("src//utils/helper.ts")).toBe("core-source");
  });

  it("returns the exact match for a classified directory path", () => {
    const resolver = createFileResolver(intentMap);
    expect(resolver("src")).toBe("core-source");
    expect(resolver("tests")).toBe("test-infrastructure");
  });
});

// ---------------------------------------------------------------------------
// resolveFileIntent
// ---------------------------------------------------------------------------

describe("resolveFileIntent", () => {
  const intentMap: IntentMap = {
    schema_version: "2.0",
    run_id: "run-test",
    entries: [
      {
        path: "src",
        depth: 1,
        intent: "core-source",
        confidence: "medium",
        reason: "source directory",
        method: "static",
      },
    ],
  };

  it("resolves file intent via nearest classified ancestor", () => {
    expect(resolveFileIntent("src/app.ts", intentMap)).toBe("core-source");
  });

  it("returns unknown when no ancestor is classified", () => {
    expect(resolveFileIntent("other/file.ts", intentMap)).toBe("unknown");
  });
});
