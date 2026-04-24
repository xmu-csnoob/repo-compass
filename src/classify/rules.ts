import path from "node:path";

import type {
  DirectoryClassifierMethod,
  DirectoryEvidence,
  DirectoryIntent,
} from "../contracts/index.js";

/** Priority tiers for classification rules. Higher wins. */
const Priority = {
  EXACT_MATCH: 100,
  STRONG_CONVENTION: 95,
  CONVENTION: 90,
  LIKELY: 80,
  HEURISTIC: 70,
  STRUCTURAL: 60,
  FALLBACK: 50,
} as const;

/**
 * Classification rule with priority-based evaluation.
 * Rules are sorted by descending priority at evaluation time;
 * declaration order serves as the tie-breaker for equal priorities.
 */
interface ClassifyRule {
  readonly name: string;
  readonly priority: number;
  readonly match: (evidence: DirectoryEvidence) => boolean;
  readonly intent: DirectoryIntent;
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
}

/** Result of a successful rule match — decoupled from contract types. */
interface RuleMatch {
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
  // doc-example surfaces (e.g. FastAPI's docs_src, docs_src_*)
  "docs_src",
  "doc_src",
  "docs_examples",
  "doc_examples",
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

const PACKAGE_ROOT_NAMES = new Set([
  "packages",
  "libs",
  "libraries",
]);

/**
 * Static classification rules.
 *
 * Conflict resolution:
 * - higher priority wins
 * - if same priority, earlier declaration wins (tie-breaker)
 * - "test-infrastructure" beats "example-fixtures" at same specificity
 *   per Phase 3 contract §3
 */
const STATIC_RULES: readonly ClassifyRule[] = [
  // Highest priority: explicit structural markers
  {
    name: "test-directory",
    priority: Priority.EXACT_MATCH,
    match: (evidence) => TEST_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "test-infrastructure",
    confidence: "high",
    reason: "directory name matches known test convention",
  },
  {
    name: "example-directory",
    priority: Priority.STRONG_CONVENTION,
    match: (evidence) =>
      EXAMPLE_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "example-fixtures",
    confidence: "high",
    reason: "directory name matches known example convention",
  },
  {
    name: "docs-directory",
    priority: Priority.STRONG_CONVENTION,
    match: (evidence) =>
      DOCS_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "docs",
    confidence: "high",
    reason: "directory name matches known documentation convention",
  },
  {
    name: "fixture-directory",
    priority: Priority.CONVENTION,
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
    priority: Priority.LIKELY,
    match: (evidence) =>
      TOOLING_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "tooling",
    confidence: "medium",
    reason: "directory name matches known tooling convention",
  },
  {
    name: "config-directory",
    priority: Priority.LIKELY,
    match: (evidence) =>
      CONFIG_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "config",
    confidence: "medium",
    reason: "directory name matches known configuration convention",
  },

  // Lower priority: source and library surface
  {
    name: "source-directory",
    priority: Priority.HEURISTIC,
    match: (evidence) =>
      SOURCE_DIR_NAMES.has(path.posix.basename(evidence.path)),
    intent: "core-source",
    confidence: "medium",
    reason: "directory name matches known source convention",
  },

  // Library surface: directories inside a known package root (e.g. packages/)
  // that contain a manifest. This is a weak signal, so it runs after
  // explicit conventions.
  {
    name: "library-surface-directory",
    priority: Priority.STRUCTURAL,
    match: (evidence) =>
      PACKAGE_ROOT_NAMES.has(path.posix.dirname(evidence.path)) &&
      evidence.manifest_hints.length > 0,
    intent: "library-surface",
    confidence: "medium",
    reason: "directory is a package inside a known package root containing a manifest",
  },

  // Root-level Python package (depth-1 directory containing __init__.py).
  // Identifies library namespaces such as fastapi/ or flask/ that sit at the
  // repo root and are not covered by any stronger naming convention.
  // Priority STRUCTURAL (60) — weaker than any explicit naming convention so
  // that test/example/docs directories are not accidentally reclassified.
  {
    name: "python-package-directory",
    priority: Priority.STRUCTURAL,
    match: (evidence) => evidence.python_package === true,
    intent: "library-surface",
    confidence: "medium",
    reason: "directory is a Python package (contains __init__.py)",
  },
];

// Pre-sort rules once at module initialization so evaluation is O(n)
// rather than O(n log n) per call.
const SORTED_RULES: readonly ClassifyRule[] = [...STATIC_RULES].sort(
  (a, b) => b.priority - a.priority,
);

/**
 * Evaluate static rules against directory evidence and return the best match.
 *
 * Rules are evaluated in descending priority order; declaration order breaks
 * ties for rules with equal priority.
 *
 * Returns undefined if no rule matches.
 */
export function evaluateRules(
  evidence: DirectoryEvidence,
): RuleMatch | undefined {
  for (const rule of SORTED_RULES) {
    if (!rule.match(evidence)) {
      continue;
    }

    return {
      intent: rule.intent,
      confidence: rule.confidence,
      reason: rule.reason,
    };
  }

  return undefined;
}

/**
 * Exported rule set for introspection and testing.
 */
export const classifyRules = STATIC_RULES;
