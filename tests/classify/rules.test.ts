import { describe, expect, it } from "vitest";

import { evaluateRules, classifyRules } from "../../src/classify/index.js";
import type { DirectoryEvidence } from "../../src/contracts/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function evidence(overrides: Partial<DirectoryEvidence> = {}): DirectoryEvidence {
  return {
    path: "src",
    depth: 1,
    children: [],
    manifest_hints: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rule introspection
// ---------------------------------------------------------------------------

describe("classifyRules", () => {
  it("exports a non-empty rule set", () => {
    expect(classifyRules.length).toBeGreaterThan(0);
  });

  it("has unique rule names", () => {
    const names = classifyRules.map((r) => r.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// Exact-match rules (highest priority)
// ---------------------------------------------------------------------------

describe("evaluateRules - exact match", () => {
  it("matches 'tests' as test-infrastructure", () => {
    const result = evaluateRules(evidence({ path: "tests" }));
    expect(result).toBeDefined();
    expect(result!.intent).toBe("test-infrastructure");
    expect(result!.confidence).toBe("high");
  });

  it("matches '__tests__' as test-infrastructure", () => {
    const result = evaluateRules(evidence({ path: "__tests__" }));
    expect(result?.intent).toBe("test-infrastructure");
  });

  it("matches 'test_' as test-infrastructure", () => {
    const result = evaluateRules(evidence({ path: "test_" }));
    expect(result?.intent).toBe("test-infrastructure");
  });

  it("matches 'examples' as example-fixtures", () => {
    const result = evaluateRules(evidence({ path: "examples" }));
    expect(result?.intent).toBe("example-fixtures");
    expect(result?.confidence).toBe("high");
  });

  it("matches 'demo' as example-fixtures", () => {
    const result = evaluateRules(evidence({ path: "demo" }));
    expect(result?.intent).toBe("example-fixtures");
  });

  it("matches 'snippets' as example-fixtures", () => {
    const result = evaluateRules(evidence({ path: "snippets" }));
    expect(result?.intent).toBe("example-fixtures");
  });

  it("matches 'docs' as docs", () => {
    const result = evaluateRules(evidence({ path: "docs" }));
    expect(result?.intent).toBe("docs");
    expect(result?.confidence).toBe("high");
  });

  it("matches 'wiki' as docs", () => {
    const result = evaluateRules(evidence({ path: "wiki" }));
    expect(result?.intent).toBe("docs");
  });
});

// ---------------------------------------------------------------------------
// Convention rules
// ---------------------------------------------------------------------------

describe("evaluateRules - convention", () => {
  it("matches 'fixtures' as example-fixtures", () => {
    const result = evaluateRules(evidence({ path: "fixtures" }));
    expect(result?.intent).toBe("example-fixtures");
  });

  it("matches 'fixture' as example-fixtures", () => {
    const result = evaluateRules(evidence({ path: "fixture" }));
    expect(result?.intent).toBe("example-fixtures");
  });
});

// ---------------------------------------------------------------------------
// Tooling and config rules
// ---------------------------------------------------------------------------

describe("evaluateRules - tooling and config", () => {
  it("matches '.github' as tooling", () => {
    const result = evaluateRules(evidence({ path: ".github" }));
    expect(result?.intent).toBe("tooling");
    expect(result?.confidence).toBe("medium");
  });

  it("matches 'scripts' as tooling", () => {
    const result = evaluateRules(evidence({ path: "scripts" }));
    expect(result?.intent).toBe("tooling");
  });

  it("matches 'benchmarks' as tooling", () => {
    const result = evaluateRules(evidence({ path: "benchmarks" }));
    expect(result?.intent).toBe("tooling");
  });

  it("matches 'config' as config", () => {
    const result = evaluateRules(evidence({ path: "config" }));
    expect(result?.intent).toBe("config");
    expect(result?.confidence).toBe("medium");
  });

  it("matches 'env' as config", () => {
    const result = evaluateRules(evidence({ path: "env" }));
    expect(result?.intent).toBe("config");
  });
});

// ---------------------------------------------------------------------------
// Source directory rules
// ---------------------------------------------------------------------------

describe("evaluateRules - source", () => {
  it("matches 'src' as core-source", () => {
    const result = evaluateRules(evidence({ path: "src" }));
    expect(result?.intent).toBe("core-source");
    expect(result?.confidence).toBe("medium");
  });

  it("matches 'lib' as core-source", () => {
    const result = evaluateRules(evidence({ path: "lib" }));
    expect(result?.intent).toBe("core-source");
  });

  it("matches 'app' as core-source", () => {
    const result = evaluateRules(evidence({ path: "app" }));
    expect(result?.intent).toBe("core-source");
  });
});

// ---------------------------------------------------------------------------
// Library surface (structural rule)
// ---------------------------------------------------------------------------

describe("evaluateRules - library surface", () => {
  it("matches a directory inside 'packages/' with a manifest", () => {
    const result = evaluateRules(evidence({
      path: "packages/core",
      depth: 2,
      manifest_hints: ["package-json"],
    }));
    expect(result?.intent).toBe("library-surface");
  });

  it("does not match a directory inside 'packages/' without a manifest", () => {
    const result = evaluateRules(evidence({
      path: "packages/core",
      depth: 2,
      manifest_hints: [],
    }));
    expect(result).toBeUndefined();
  });

  it("does not match a directory inside 'libs/' with a manifest at depth 1", () => {
    // library-surface requires parent to be packages/libs/libraries
    const result = evaluateRules(evidence({
      path: "libs",
      depth: 1,
      manifest_hints: ["package-json"],
    }));
    expect(result?.intent).not.toBe("library-surface");
  });
});

// ---------------------------------------------------------------------------
// Priority and conflict resolution
// ---------------------------------------------------------------------------

describe("evaluateRules - priority", () => {
  it("test-directory beats example-directory at same path", () => {
    // "test" is in both TEST_DIR_NAMES and could theoretically overlap;
    // but per priority, test (EXACT_MATCH=100) should win if both match.
    // In practice they have disjoint name sets, so test the priority directly.
    const testResult = evaluateRules(evidence({ path: "test" }));
    expect(testResult?.intent).toBe("test-infrastructure");
  });

  it("docs-directory beats source-directory", () => {
    // "docs" would match docs-directory (STRONG=95) not source-directory
    const result = evaluateRules(evidence({ path: "docs" }));
    expect(result?.intent).toBe("docs");
  });

  it("example-directory beats fixture-directory", () => {
    // "examples" matches example-directory (95), not fixture (90)
    const result = evaluateRules(evidence({ path: "examples" }));
    expect(result?.intent).toBe("example-fixtures");
  });

  it("test-infrastructure beats tooling for a test name", () => {
    const result = evaluateRules(evidence({ path: "tests" }));
    expect(result?.intent).toBe("test-infrastructure");
  });
});

// ---------------------------------------------------------------------------
// No match
// ---------------------------------------------------------------------------

describe("evaluateRules - no match", () => {
  it("returns undefined for unknown directory names", () => {
    const result = evaluateRules(evidence({ path: "foobar" }));
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty path segments", () => {
    const result = evaluateRules(evidence({ path: "" }));
    expect(result).toBeUndefined();
  });

  it("returns undefined for deeply nested unknown directories", () => {
    const result = evaluateRules(evidence({ path: "a/b/c/d" }));
    expect(result).toBeUndefined();
  });
});
