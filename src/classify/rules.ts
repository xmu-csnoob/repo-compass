import path from "node:path";

import type {
  DirectoryEvidence,
  DirectoryIntent,
  DirectoryIntentEntry,
} from "../contracts/index.js";

/**
 * Classification rule with priority-based evaluation.
 * Higher priority numbers win over lower ones.
 */
interface ClassifyRule {
  readonly name: string;
  readonly priority: number;
  readonly match: (evidence: DirectoryEvidence) => boolean;
  readonly intent: DirectoryIntent;
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
}

// Known directory name conventions, mapped to their canonical intent.

const TEST_DIR_NAMES = new Set([
  "tests",
  "test",
  "__tests__",
  "testing",
  "specs",
  "spec",
  "_tests",
  "test_",
  "pytest",
]);

const EXAMPLE_DIR_NAMES = new Set([
  "examples",
  "example",
  "examples_",
  "samples",
  "sample",
  "demo",
  "demos",
  "tutorials",
  "tutorial",
  "snippets",
]);

const DOCS_DIR_NAMES = new Set([
  "docs",
  "doc",
  "documentation",
  "guides",
  "guide",
  "wiki",
  "readme",
]);

const TOOLING_DIR_NAMES = new Set([
  "scripts",
  "tools",
  "tooling",
  ".github",
  "ci",
  ".ci",
  ".husky",
  ".vscode",
  ".idea",
  "workflows",
  "actions",
  "benchmarks",
  "benchmark",
  "perf",
  "profiling",
]);

const CONFIG_DIR_NAMES = new Set([
  "config",
  "configs",
  "configuration",
  "settings",
  "conf",
  "env",
  "environments",
]);

const SOURCE_DIR_NAMES = new Set([
  "src",
  "source",
  "package",
  "packages",
  "app",
  "lib",
]);

/**
 * Static classification rules, ordered by priority (highest first).
 *
 * Conflict resolution:
 * - higher priority wins
 * - if same priority, rules are evaluated in declaration order
 * - "test-infrastructure" beats "example-fixtures" at same specificity
 *   per Phase 3 contract §3
 */
const STATIC_RULES: readonly ClassifyRule[] = [
  // Highest priority: explicit structural markers
  {
    name: "test-directory",
    priority: 100,
    match: (evidence) => TEST_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "test-infrastructure",
    confidence: "high",
    reason: "directory name matches known test convention",
  },
  {
    name: "example-directory",
    priority: 95,
    match: (evidence) =>
      EXAMPLE_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "example-fixtures",
    confidence: "high",
    reason: "directory name matches known example convention",
  },
  {
    name: "docs-directory",
    priority: 95,
    match: (evidence) =>
      DOCS_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "docs",
    confidence: "high",
    reason: "directory name matches known documentation convention",
  },
  {
    name: "fixture-directory",
    priority: 90,
    match: (evidence) =>
      path.posix.basename(evidence.path) === "fixtures" ||
      path.posix.basename(evidence.path) === "fixture",
    intent: "example-fixtures",
    confidence: "high",
    reason: "directory name matches known fixture convention",
  },

  // Medium priority: tooling and config
  {
    name: "tooling-directory",
    priority: 80,
    match: (evidence) =>
      TOOLING_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "tooling",
    confidence: "medium",
    reason: "directory name matches known tooling convention",
  },
  {
    name: "config-directory",
    priority: 80,
    match: (evidence) =>
      CONFIG_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "config",
    confidence: "medium",
    reason: "directory name matches known configuration convention",
  },

  // Lower priority: source and library surface
  {
    name: "source-directory",
    priority: 70,
    match: (evidence) =>
      SOURCE_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "core-source",
    confidence: "medium",
    reason: "directory name matches known source convention",
  },

  // Library surface: directory that shares name with a manifest package hint.
  // This is a weak signal, so it runs after explicit conventions.
  {
    name: "library-surface-directory",
    priority: 60,
    match: (evidence) =>
      evidence.manifest_hints.length > 0 &&
      evidence.manifest_hints.some(
        (hint) => hint.toLowerCase() === path.posix.basename(evidence.path).toLowerCase(),
      ),
    intent: "library-surface",
    confidence: "medium",
    reason: "directory name matches package manifest hint",
  },

  // Parent intent inheritance: directories inside already-classified parents
  // inherit the parent's intent at reduced confidence.
  {
    name: "parent-inheritance",
    priority: 50,
    match: (evidence) => evidence.parent_intent !== undefined,
    intent: "unknown", // resolved dynamically in the engine
    confidence: "medium",
    reason: "inherits intent from parent directory",
  },
];

/**
 * Evaluate static rules against directory evidence and return the best match.
 *
 * Returns undefined if no rule matches.
 */
export function evaluateRules(
  evidence: DirectoryEvidence,
): Omit<DirectoryIntentEntry, "path" | "depth"> | undefined {
  for (const rule of STATIC_RULES) {
    if (!rule.match(evidence)) {
      continue;
    }

    // Parent inheritance rule: use the parent's intent dynamically.
    if (rule.name === "parent-inheritance" && evidence.parent_intent) {
      return {
        intent: evidence.parent_intent,
        confidence: "medium",
        reason: rule.reason,
        method: "static",
      };
    }

    return {
      intent: rule.intent,
      confidence: rule.confidence,
      reason: rule.reason,
      method: "static",
    };
  }

  return undefined;
}

/**
 * Exported rule set for introspection and testing.
 */
export const classifyRules = STATIC_RULES;
