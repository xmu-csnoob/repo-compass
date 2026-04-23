import { describe, expect, it } from "vitest";

import {
  AGENT_HINT_KINDS,
  GRAPH_EDGE_KINDS,
  MANIFEST_KINDS,
  DIRECTORY_INTENTS,
  intentMapSchema,
  contextIndexSchema,
  validateContract,
} from "../../src/contracts/index.js";

const PHASE1_CONTEXT_INDEX_KEYS = [
  "schema_version",
  "repo",
  "meta",
  "artifacts",
  "graph",
  "entrypoints",
  "first_read_path",
  "key_paths",
  "critical_paths",
  "defer_for_now",
  "agent_hints",
] as const;

describe("phase 2 compatibility", () => {
  it("keeps all Phase 1 context-index sections and adds only warnings and freshness", () => {
    const minimalValid = {
      schema_version: "2.0",
      repo: {
        name: "my-repo",
        root: "/home/user/repo",
        repo_shape: "library",
        primary_languages: ["TypeScript"],
        detected_ecosystems: ["node"],
        framework_hints: [],
      },
      meta: {
        run_id: "run-001",
        snapshot_id: "snap-abc",
        generated_at: "2026-04-21T12:00:00Z",
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
      entrypoints: [],
      first_read_path: [],
      key_paths: [],
      critical_paths: [],
      defer_for_now: [],
      agent_hints: [],
      warnings: [],
      freshness: {
        mode: "off",
        status: "unknown",
        generated_from: "full",
        reason: "Freshness tracking is disabled for this run.",
      },
    } as const;

    const validated = validateContract(contextIndexSchema, minimalValid, "contextIndex");
    const keys = Object.keys(validated);

    expect(keys).toEqual([
      ...PHASE1_CONTEXT_INDEX_KEYS,
      "warnings",
      "freshness",
    ]);
  });

  it("preserves all Phase 1 manifest, edge, and agent-hint enum values", () => {
    expect(MANIFEST_KINDS).toEqual(
      expect.arrayContaining(["package-json", "lockfile", "other"]),
    );
    expect(GRAPH_EDGE_KINDS).toEqual(
      expect.arrayContaining(["contains", "import", "require", "reference", "route", "config-link", "test-of"]),
    );
    expect(AGENT_HINT_KINDS).toEqual(
      expect.arrayContaining(["setup", "run", "test", "safe-edit-zone", "watch-out"]),
    );
  });

  it("keeps the phase 3 intent artifact on schema version 2.0", () => {
    const validated = validateContract(
      intentMapSchema,
      {
        schema_version: "2.0",
        run_id: "run-001",
        entries: [],
      },
      "intentMap",
    );

    expect(validated.schema_version).toBe("2.0");
  });

  it("freezes the phase 3 directory-intent enum set", () => {
    expect(DIRECTORY_INTENTS).toEqual([
      "core-source",
      "library-surface",
      "example-fixtures",
      "test-infrastructure",
      "tooling",
      "docs",
      "config",
      "unknown",
    ]);
  });
});
