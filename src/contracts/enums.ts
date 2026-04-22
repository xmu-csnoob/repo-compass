export const PATH_ROLES = [
  "source",
  "config",
  "docs",
  "tests",
  "generated",
  "vendor",
  "build",
  "unknown",
] as const;

export const MANIFEST_KINDS = [
  "package-json",
  "lockfile",
  "pyproject",
  "setup-py",
  "setup-cfg",
  "requirements",
  "other",
] as const;

export const ENTRYPOINT_KINDS = [
  "app",
  "cli",
  "server",
  "library",
  "test-harness",
  "build",
] as const;

export const REPO_SHAPES = [
  "application",
  "library",
  "service",
  "tool",
  "mixed",
] as const;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export const KEY_PATH_ROLES = [
  "entry",
  "core",
  "config",
  "workflow",
  "test",
  "docs",
] as const;

export const GRAPH_NODE_KINDS = [
  "file",
  "directory",
  "manifest",
  "config",
  "test",
  "entrypoint",
] as const;

export const GRAPH_EDGE_KINDS = [
  "contains",
  "import",
  "require",
  "reference",
  "route",
  "config-link",
  "test-of",
  "module-link",
] as const;

export const PRIORITY_SIGNALS = [
  "entrypoint",
  "manifest",
  "fan-in",
  "framework-core",
  "workflow-core",
  "adjacent-test",
  "root-central",
] as const;

export const AGENT_HINT_KINDS = [
  "setup",
  "run",
  "test",
  "safe-edit-zone",
  "watch-out",
] as const;

export const FRESHNESS_MODES = ["off", "watch", "ci"] as const;

export const FRESHNESS_STATUSES = [
  "fresh",
  "stale",
  "degraded",
  "unknown",
] as const;

export const FRESHNESS_GENERATED_FROM = ["full", "incremental"] as const;
