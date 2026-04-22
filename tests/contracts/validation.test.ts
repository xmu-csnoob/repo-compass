import { describe, expect, it } from "vitest";
import {
  comprehensionSchema,
  contextIndexSchema,
  repoInputSchema,
  signalExtractionSchema,
  structureScanSchema,
} from "../../src/contracts/index.js";
import { ContractValidationError, validateContract } from "../../src/contracts/validate.js";

// ---------------------------------------------------------------------------
// Helper: ISO datetime string for meta.generated_at
// ---------------------------------------------------------------------------
const VALID_DATETIME = "2026-04-21T12:00:00Z";

// ---------------------------------------------------------------------------
// repoInputSchema
// ---------------------------------------------------------------------------
describe("repoInputSchema", () => {
  const minimalValid = {
    schema_version: "2.0",
    run_id: "run-001",
    repo_root: "/home/user/repo",
    output_root: "/home/user/repo-compass/output",
  };

  it("parses a minimal valid repoInput", () => {
    expect(validateContract(repoInputSchema, minimalValid, "repoInput")).toMatchObject(minimalValid);
  });

  it("parses a valid repoInput with all optional fields", () => {
    const full = {
      ...minimalValid,
      include: ["src/", "lib/"],
      exclude: ["node_modules/", ".git/"],
      max_files: 100_000,
      options: {
        follow_symlinks: true,
        detect_frameworks: false,
        extract_import_graph: false,
        emit_debug_artifacts: true,
        emit_agent_start: false,
        freshness_mode: "ci",
      },
    };
    expect(validateContract(repoInputSchema, full, "repoInput")).toMatchObject(full);
  });

  it("throws on missing required field run_id", () => {
    const invalid = { ...minimalValid, run_id: undefined };
    expect(() => validateContract(repoInputSchema, invalid, "repoInput")).toThrow(
      ContractValidationError,
    );
  });

  it("throws on wrong schema_version literal", () => {
    const invalid = { ...minimalValid, schema_version: "1.0" };
    expect(() => validateContract(repoInputSchema, invalid, "repoInput")).toThrow(
      ContractValidationError,
    );
  });

  it("throws on negative max_files", () => {
    const invalid = { ...minimalValid, max_files: -1 };
    expect(() => validateContract(repoInputSchema, invalid, "repoInput")).toThrow(
      ContractValidationError,
    );
  });

  it("throws on invalid options shape", () => {
    const invalid = { ...minimalValid, options: { follow_symlinks: "yes" } };
    expect(() => validateContract(repoInputSchema, invalid, "repoInput")).toThrow(
      ContractValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// structureScanSchema
// ---------------------------------------------------------------------------
describe("structureScanSchema", () => {
  const minimalValid = {
    schema_version: "2.0",
    run_id: "run-001",
    repo: {
      root: "/home/user/repo",
      file_count: 42,
      dir_count: 7,
    },
    detected: {
      languages: ["TypeScript"],
      ecosystems: ["node"],
      framework_hints: [],
      manifests: [],
    },
    paths: [
      { path: "src/index.ts", kind: "file", role: "source", size: 256 },
    ],
    excluded_paths: ["node_modules"],
  };

  it("parses a minimal valid structureScan", () => {
    expect(
      validateContract(structureScanSchema, minimalValid, "structureScan"),
    ).toMatchObject(minimalValid);
  });

  it("parses structureScan with manifests", () => {
    const withManifests = {
      ...minimalValid,
      detected: {
        ...minimalValid.detected,
        manifests: [
          { path: "package.json", kind: "package-json" },
          { path: "yarn.lock", kind: "lockfile" },
        ],
      },
    };
    expect(
      validateContract(structureScanSchema, withManifests, "structureScan"),
    ).toMatchObject(withManifests);
  });

  it("throws on missing nested required field repo.root", () => {
    const invalid = { ...minimalValid, repo: { ...minimalValid.repo, root: undefined } };
    expect(() => validateContract(structureScanSchema, invalid, "structureScan")).toThrow(
      ContractValidationError,
    );
  });

  it("throws on invalid manifest.kind", () => {
    const invalid = {
      ...minimalValid,
      detected: {
        ...minimalValid.detected,
        manifests: [{ path: "Cargo.toml", kind: "not-a-kind" }],
      },
    };
    expect(() => validateContract(structureScanSchema, invalid, "structureScan")).toThrow(
      ContractValidationError,
    );
  });

  it("throws on invalid path.role", () => {
    const invalid = {
      ...minimalValid,
      paths: [{ path: "src/index.ts", kind: "file", role: "not-a-role", size: 256 }],
    };
    expect(() => validateContract(structureScanSchema, invalid, "structureScan")).toThrow(
      ContractValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// signalExtractionSchema
// ---------------------------------------------------------------------------
describe("signalExtractionSchema", () => {
  const minimalValid = {
    schema_version: "2.0",
    run_id: "run-001",
    entrypoints: [
      {
        id: "ep-1",
        path: "src/cli.ts",
        kind: "cli",
        reason: "has shebang",
        confidence: "high",
        evidence: ["#!/usr/bin/env node"],
      },
    ],
    commands: [{ source_path: "package.json", name: "build", command: "tsc" }],
    edges: [{ from: "src/index.ts", to: "src/cli.ts", kind: "import" }],
    priority_candidates: [
      {
        path: "package.json",
        signal: "manifest",
        reason: "contains scripts",
        confidence: "high",
        evidence: ["scripts"],
      },
    ],
    defer_candidates: [
      { path: "docs/", reason: "documentation only", confidence: "medium" },
    ],
    warnings: [],
  };

  it("parses a minimal valid signalExtraction", () => {
    expect(
      validateContract(signalExtractionSchema, minimalValid, "signalExtraction"),
    ).toMatchObject(minimalValid);
  });

  it("throws when entrypoint is missing required evidence", () => {
    const invalid = {
      ...minimalValid,
      entrypoints: [
        {
          id: "ep-1",
          path: "src/cli.ts",
          kind: "cli",
          reason: "has shebang",
          confidence: "high",
          evidence: [], // must have at least 1 item
        },
      ],
    };
    expect(() =>
      validateContract(signalExtractionSchema, invalid, "signalExtraction"),
    ).toThrow(ContractValidationError);
  });

  it("throws on invalid confidence enum", () => {
    const invalid = {
      ...minimalValid,
      entrypoints: [
        {
          id: "ep-1",
          path: "src/cli.ts",
          kind: "cli",
          reason: "has shebang",
          confidence: "guaranteed", // not a valid confidence level
          evidence: ["#!/usr/bin/env node"],
        },
      ],
    };
    expect(() =>
      validateContract(signalExtractionSchema, invalid, "signalExtraction"),
    ).toThrow(ContractValidationError);
  });

  it("throws on entrypoint missing required fields", () => {
    const invalid = {
      ...minimalValid,
      entrypoints: [
        {
          id: "ep-1",
          path: "src/cli.ts",
          // kind, reason, confidence, evidence all missing
        },
      ],
    };
    expect(() =>
      validateContract(signalExtractionSchema, invalid, "signalExtraction"),
    ).toThrow(ContractValidationError);
  });
});

// ---------------------------------------------------------------------------
// comprehensionSchema
// ---------------------------------------------------------------------------
describe("comprehensionSchema", () => {
  const minimalValid = {
    schema_version: "2.0",
    run_id: "run-001",
    repo: {
      name: "my-repo",
      root: "/home/user/repo",
      repo_shape: "application",
      primary_languages: ["TypeScript"],
      detected_ecosystems: ["node"],
      framework_hints: [],
    },
    meta: {
      run_id: "run-001",
      snapshot_id: "snap-abc",
      generated_at: VALID_DATETIME,
      included_paths: ["src/"],
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
  };

  it("parses a minimal valid comprehension", () => {
    expect(
      validateContract(comprehensionSchema, minimalValid, "comprehension"),
    ).toMatchObject(minimalValid);
  });

  it("throws on missing required derived views section critical_paths", () => {
    const invalid = { ...minimalValid, critical_paths: undefined };
    expect(() =>
      validateContract(comprehensionSchema, invalid, "comprehension"),
    ).toThrow(ContractValidationError);
  });

  it("throws on missing required derived views section agent_hints", () => {
    const invalid = { ...minimalValid, agent_hints: undefined };
    expect(() =>
      validateContract(comprehensionSchema, invalid, "comprehension"),
    ).toThrow(ContractValidationError);
  });

  it("throws on missing required derived views section key_paths", () => {
    const invalid = { ...minimalValid, key_paths: undefined };
    expect(() =>
      validateContract(comprehensionSchema, invalid, "comprehension"),
    ).toThrow(ContractValidationError);
  });
});

// ---------------------------------------------------------------------------
// contextIndexSchema
// ---------------------------------------------------------------------------
describe("contextIndexSchema", () => {
  // contextIndexSchema is comprehensionSchema.omit({ run_id: true })
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
      generated_at: VALID_DATETIME,
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
  };

  it("parses a minimal valid contextIndex", () => {
    expect(
      validateContract(contextIndexSchema, minimalValid, "contextIndex"),
    ).toMatchObject(minimalValid);
  });

  it("throws when extra top-level field is present", () => {
    const invalid = { ...minimalValid, run_id: "run-001" }; // run_id is not allowed
    expect(() =>
      validateContract(contextIndexSchema, invalid, "contextIndex"),
    ).toThrow(ContractValidationError);
  });

  it("throws on missing required field repo", () => {
    const invalid = { ...minimalValid, repo: undefined };
    expect(() =>
      validateContract(contextIndexSchema, invalid, "contextIndex"),
    ).toThrow(ContractValidationError);
  });
});
