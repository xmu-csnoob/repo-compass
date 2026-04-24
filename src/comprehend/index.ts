import path from "node:path";

import { createFileResolver } from "../classify/index.js";
import type {
  Comprehension,
  RepoInput,
  SignalExtraction,
  GraphNode,
  GraphEdge,
  KeyPath,
  FirstReadPathItem,
  CriticalPath,
  DeferForNowItem,
  RepoMetadata,
  IntentMap,
  DirectoryIntent,
} from "../contracts/index.js";
import type { FreshnessResult } from "../freshness/index.js";

export function buildComprehension(
  input: RepoInput,
  scan: import("../contracts/index.js").StructureScan,
  signals: SignalExtraction,
  freshnessResult?: FreshnessResult,
  intentMap?: IntentMap,
): Comprehension {
  const allPathEntries = scan.paths;
  const pathSet = new Set(allPathEntries.map((entry) => entry.path));
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  function addNode(node: GraphNode): void {
    if (nodeIds.has(node.id)) {
      return;
    }

    nodeIds.add(node.id);
    nodes.push(node);
  }

  function addEdge(edge: GraphEdge): void {
    const edgeId = `${edge.kind}:${edge.from}->${edge.to}`;

    if (edgeIds.has(edgeId)) {
      return;
    }

    edgeIds.add(edgeId);
    edges.push(edge);
  }

  for (const pathEntry of allPathEntries) {
    const isManifest = scan.detected.manifests.some((manifest) => manifest.path === pathEntry.path);
    const isEntrypoint = signals.entrypoints.some((entrypoint) => entrypoint.path === pathEntry.path);
    const nodeKind: GraphNode["kind"] = isEntrypoint
      ? "entrypoint"
      : isManifest
        ? "manifest"
        : pathEntry.role === "config"
          ? "config"
          : pathEntry.role === "tests"
            ? "test"
            : pathEntry.kind;

    addNode({
      id: pathEntry.path,
      path: pathEntry.path,
      kind: nodeKind,
      role: pathEntry.role,
    });

    if (pathEntry.path.includes("/")) {
      const parentPath = pathEntry.path.slice(0, pathEntry.path.lastIndexOf("/"));

      if (pathSet.has(parentPath)) {
        addEdge({
          from: parentPath,
          to: pathEntry.path,
          kind: "contains",
        });
      }
    }
  }

  for (const signalEdge of signals.edges) {
    addEdge(signalEdge);
  }

  const hints = scan.detected.framework_hints;
  const appSignals = ["nextjs", "react", "vite", "vue"];
  const hasAppHint = appSignals.some((hint) => hints.includes(hint));
  const hasServiceHint = hints.includes("express");
  const hasToolHint = hints.includes("node-cli");
  const hasLibraryHint = hints.includes("library");
  const hasServerEntrypoint = signals.entrypoints.some((entrypoint) => entrypoint.kind === "server");
  const hasCliEntrypoint = signals.entrypoints.some((entrypoint) => entrypoint.kind === "cli");
  const hasLibraryEntrypoint = signals.entrypoints.some((entrypoint) => entrypoint.kind === "library");
  const structuralShapes = [
    hasAppHint ? "application" : null,
    hasServiceHint && hasServerEntrypoint && !hasAppHint ? "service" : null,
    hasToolHint && hasCliEntrypoint && !hasAppHint && !hasServiceHint ? "tool" : null,
    hasLibraryHint && (hasLibraryEntrypoint || !hasCliEntrypoint) && !hasAppHint && !hasServiceHint ? "library" : null,
  ].filter((shape): shape is RepoMetadata["repo_shape"] => shape !== null);
  const repoShape: RepoMetadata["repo_shape"] =
    structuralShapes.length === 1 ? (structuralShapes[0] ?? "mixed") : "mixed";
  const resolveIntent = intentMap ? createFileResolver(intentMap) : undefined;

  function pathDepth(pathValue: string): number {
    return pathValue.split("/").filter(Boolean).length;
  }

  function topLevelDir(pathValue: string): string | undefined {
    const first = pathValue.split("/").find(Boolean);
    return first === undefined ? undefined : first;
  }

  function isSuppressionIntent(intent: DirectoryIntent | undefined): boolean {
    return intent === "example-fixtures" || intent === "test-infrastructure";
  }

  function isPrimaryEditIntent(intent: DirectoryIntent | undefined): boolean {
    return intent === "core-source" || intent === "library-surface";
  }

  const topLevelLibrarySurface = intentMap?.entries.find(
    (entry) => entry.depth === 1 && entry.intent === "library-surface",
  );
  const topLevelLibraryDir = topLevelLibrarySurface?.path;
  const isPythonLibraryLikeRepo = topLevelLibraryDir !== undefined;

  const keyPaths: KeyPath[] = [];
  const seenKeyPaths = new Set<string>();

  function addKeyPath(item: KeyPath): void {
    if (seenKeyPaths.has(item.path)) {
      return;
    }

    seenKeyPaths.add(item.path);
    keyPaths.push(item);
  }

  for (const entrypoint of signals.entrypoints) {
    const pathEntry = allPathEntries.find((entry) => entry.path === entrypoint.path);

    addKeyPath({
      path: entrypoint.path,
      kind: pathEntry?.kind ?? "file",
      role: "entry",
      summary: "Likely runtime entrypoint.",
      priority: entrypoint.confidence,
      reason: entrypoint.reason,
      confidence: entrypoint.confidence,
      evidence: [...entrypoint.evidence],
    });
  }

  for (const candidate of signals.priority_candidates) {
    const pathEntry = allPathEntries.find((entry) => entry.path === candidate.path);
    const role: KeyPath["role"] =
      candidate.signal === "manifest"
        ? "config"
        : candidate.signal === "adjacent-test"
          ? "test"
          : candidate.signal === "workflow-core"
            ? "workflow"
            : "core";

    addKeyPath({
      path: candidate.path,
      kind: pathEntry?.kind ?? "file",
      role,
      summary: candidate.reason,
      priority: candidate.confidence,
      reason: candidate.reason,
      confidence: candidate.confidence,
      evidence: [...candidate.evidence],
    });
  }

  if (pathSet.has("README.md")) {
    addKeyPath({
      path: "README.md",
      kind: "file",
      role: "docs",
      summary: "Repository overview and contributor-facing orientation.",
      priority: "medium",
      reason: "README is usually the shortest path to global project context.",
      confidence: "medium",
      evidence: ["README.md"],
    });
  }

  const firstReadPath: FirstReadPathItem[] = [];
  const firstReadSeen = new Set<string>();

  function addFirstRead(item: FirstReadPathItem): void {
    if (firstReadSeen.has(item.path)) {
      return;
    }

    firstReadSeen.add(item.path);
    firstReadPath.push(item);
  }

  for (const manifest of scan.detected.manifests) {
    addFirstRead({
      path: manifest.path,
      why_now: "Start here to understand workspace shape, scripts, and dependencies.",
      reason: "Manifest files anchor the repository's install and run workflows.",
      confidence: "high",
      evidence: [manifest.kind],
    });
  }

  for (const keyPath of keyPaths
    .filter((item) => item.role !== "config")
    .filter((item) => allPathEntries.find((entry) => entry.path === item.path)?.role !== "config")
    .slice(0, 5)) {
    addFirstRead({
      path: keyPath.path,
      why_now: keyPath.role === "entry" ? "This is likely the first runtime hop." : "This path appears central to repo comprehension.",
      reason: keyPath.reason,
      confidence: keyPath.confidence,
      evidence: keyPath.evidence,
    });
  }

  // Build adjacency map for transitive graph walk
  // Only include semantically meaningful edge kinds for traversal
  const TRAVERSABLE_EDGE_KINDS = new Set(["import", "require", "reference", "route"]);
  const adjacency = new Map<string, string[]>();
  for (const edge of signals.edges) {
    if (!TRAVERSABLE_EDGE_KINDS.has(edge.kind)) {
      continue;
    }
    const existing = adjacency.get(edge.from);
    if (existing !== undefined) {
      existing.push(edge.to);
    } else {
      adjacency.set(edge.from, [edge.to]);
    }
  }

  // Deduplicate entrypoints by path, keeping highest confidence or most specific kind
  const KIND_PRIORITY = ["cli", "server", "app", "library", "test-harness", "build"] as const;
  const seenEntrypoints = new Map<string, (typeof signals.entrypoints)[number]>();
  for (const entrypoint of signals.entrypoints) {
    const existing = seenEntrypoints.get(entrypoint.path);
    if (!existing) {
      seenEntrypoints.set(entrypoint.path, entrypoint);
    } else {
      const existingPriority = KIND_PRIORITY.indexOf(existing.kind as typeof KIND_PRIORITY[number]);
      const newPriority = KIND_PRIORITY.indexOf(entrypoint.kind as typeof KIND_PRIORITY[number]);
      if (
        newPriority < existingPriority ||
        (newPriority === existingPriority && entrypoint.confidence === "high" && existing.confidence !== "high")
      ) {
        seenEntrypoints.set(entrypoint.path, entrypoint);
      }
    }
  }
  const uniqueEntrypoints = [...seenEntrypoints.values()];
  const criticalKindPriority = ["app", "server", "cli", "library", "build", "test-harness"] as const;
  const selectedCriticalKind = criticalKindPriority.find((kind) =>
    uniqueEntrypoints.some((entrypoint) => entrypoint.kind === kind),
  );
  const criticalEntrypoints = selectedCriticalKind === undefined
    ? uniqueEntrypoints
    : uniqueEntrypoints.filter((entrypoint) => entrypoint.kind === selectedCriticalKind);

  const criticalPaths: CriticalPath[] = criticalEntrypoints.flatMap((entrypoint) => {
    // BFS up to 5 steps from the entrypoint
    const steps: string[] = [entrypoint.path];
    const visited = new Set<string>([entrypoint.path]);
    const queue: string[] = [entrypoint.path];

    while (queue.length > 0 && steps.length < 5) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) ?? [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && steps.length < 5) {
          visited.add(neighbor);
          steps.push(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (steps.length < 2) {
      return [];
    }

    return [{
      name: `${entrypoint.kind}:${entrypoint.path}`,
      steps,
      reason: `Shows a multi-hop structural path reachable from ${entrypoint.path}.`,
      confidence: "medium",
      evidence: [...entrypoint.evidence],
    }];
  });

  const deferForNow: DeferForNowItem[] = signals.defer_candidates.map((candidate) => ({
    path: candidate.path,
    reason: candidate.reason,
    confidence: candidate.confidence,
    evidence: candidate.evidence,
  }));

  const agentHints = [];

  if (scan.detected.manifests.some((manifest) => manifest.kind === "package-json")) {
    agentHints.push({
      kind: "setup" as const,
      text: "Run npm install before editing or executing scripts.",
      reason: "The repository uses a package.json-based Node workflow.",
      confidence: "high" as const,
      evidence: ["package.json"],
    });
  }

  for (const command of signals.commands) {
    if (command.name === "dev" || command.name === "start") {
      agentHints.push({
        kind: "run" as const,
        text: `Use npm run ${command.name} to start the primary workflow.`,
        reason: `package.json defines the ${command.name} script.`,
        confidence: "high" as const,
        evidence: [`scripts.${command.name}`],
      });
    }

    if (command.name === "test") {
      agentHints.push({
        kind: "test" as const,
        text: "Use npm test to exercise the existing test workflow.",
        reason: "package.json exposes a test script.",
        confidence: "high" as const,
        evidence: ["scripts.test"],
      });
    }
  }

  // Python setup hints
  const hasPyproject = scan.detected.manifests.some((m) => m.kind === "pyproject");
  const hasRequirements = scan.detected.manifests.some((m) => m.kind === "requirements");
  const hasSetupPy = scan.detected.manifests.some((m) => m.kind === "setup-py");
  const hasSetupCfg = scan.detected.manifests.some((m) => m.kind === "setup-cfg");

  if (hasPyproject || hasSetupPy || hasSetupCfg) {
    agentHints.push({
      kind: "setup" as const,
      text: "Run pip install -e . to install the package in development mode.",
      reason: "The repository uses a Python package manifest.",
      confidence: "high" as const,
      evidence: [hasPyproject ? "pyproject.toml" : hasSetupPy ? "setup.py" : "setup.cfg"],
    });
  }

  if (hasRequirements) {
    agentHints.push({
      kind: "setup" as const,
      text: "Run pip install -r requirements.txt to install dependencies.",
      reason: "The repository lists dependencies in requirements.txt.",
      confidence: "high" as const,
      evidence: ["requirements.txt"],
    });
  }

  const pythonEntrypoints = signals.entrypoints.filter((e) => e.path.endsWith(".py"));
  const pythonModuleEntrypoint = isPythonLibraryLikeRepo
    ? pythonEntrypoints.find((e) => e.path === `${topLevelLibraryDir}/__main__.py`)
    : undefined;
  // Python run hints — library-like repos prefer module/CLI guidance over
  // generic "run the application" hints from package internals.
  const pythonRunEntrypoint =
    pythonModuleEntrypoint ??
    pythonEntrypoints.find((e) => e.kind === "cli") ??
    pythonEntrypoints.find((e) => e.kind === "server") ??
    pythonEntrypoints.find((e) => e.kind === "app") ??
    pythonEntrypoints[0];

  if (pythonRunEntrypoint !== undefined) {
    const { path: epPath, kind: epKind } = pythonRunEntrypoint;
    const hasDjango = hints.includes("django");
    const hasFastapi = hints.includes("fastapi");
    const hasFlask = hints.includes("flask");

    if (epPath === "manage.py" && hasDjango) {
      agentHints.push({
        kind: "run" as const,
        text: "Use python manage.py runserver to start the Django development server.",
        reason: "Detected a Django manage.py entrypoint.",
        confidence: "high" as const,
        evidence: ["manage.py", "django"],
      });
    } else if ((epPath === "src/main.py" || epPath === "main.py") && hasFastapi) {
      agentHints.push({
        kind: "run" as const,
        text: "Use uvicorn main:app --reload to start the FastAPI server.",
        reason: "Detected a FastAPI main.py entrypoint.",
        confidence: "high" as const,
        evidence: ["fastapi", epPath],
      });
    } else if (epPath === "app.py" && hasFlask) {
      agentHints.push({
        kind: "run" as const,
        text: "Use flask run to start the Flask development server.",
        reason: "Detected a Flask app.py entrypoint.",
        confidence: "high" as const,
        evidence: ["flask", "app.py"],
      });
    } else if (epPath.endsWith("__main__.py")) {
      const parts = epPath.split("/");
      const pkgName = parts.length >= 2 ? parts[parts.length - 2] : "package";
      agentHints.push({
        kind: "run" as const,
        text: `Use python -m ${pkgName} to run the CLI.`,
        reason: "Detected a Python __main__.py entrypoint.",
        confidence: "medium" as const,
        evidence: [epPath],
      });
    } else if ((epKind === "server" || epKind === "app") && !isPythonLibraryLikeRepo) {
      agentHints.push({
        kind: "run" as const,
        text: `Use python ${epPath} to run the application.`,
        reason: "Detected a Python application entrypoint.",
        confidence: "medium" as const,
        evidence: [epPath],
      });
    }
  }

  // Python test hints
  if (hints.includes("pytest") || allPathEntries.some((e) => e.path === "pytest.ini")) {
    agentHints.push({
      kind: "test" as const,
      text: "Use pytest to exercise the test suite.",
      reason: "pytest configuration or test files detected.",
      confidence: "high" as const,
      evidence: ["pytest"],
    });
  }

  if (hints.includes("django")) {
    agentHints.push({
      kind: "test" as const,
      text: "Use python manage.py test to run Django tests.",
      reason: "Django project detected.",
      confidence: "high" as const,
      evidence: ["django"],
    });
  }

  const preferredIntentDirectory = allPathEntries
    .filter((entry) => entry.kind === "directory")
    .filter((entry) => isPrimaryEditIntent(resolveIntent?.(entry.path)))
    .sort((a, b) => {
      const aPreferred = ["src", "app", "lib"].includes(a.path) ? 0 : 1;
      const bPreferred = ["src", "app", "lib"].includes(b.path) ? 0 : 1;

      if (aPreferred !== bPreferred) {
        return aPreferred - bPreferred;
      }

      return pathDepth(a.path) - pathDepth(b.path) || a.path.localeCompare(b.path);
    })[0];
  const sourceDirectory = allPathEntries.find(
    (entry) => entry.kind === "directory" && entry.role === "source" && ["src", "app", "lib"].includes(entry.path),
  );
  const fallbackSourceDirectory = allPathEntries.find(
    (entry) =>
      entry.kind === "directory" &&
      entry.role === "source" &&
      !isSuppressionIntent(resolveIntent?.(entry.path)) &&
      !["docs", "tooling", "config"].includes(resolveIntent?.(entry.path) ?? ""),
  );
  const safeEditPath = preferredIntentDirectory
    ?? sourceDirectory
    ?? fallbackSourceDirectory
    ?? allPathEntries.find((entry) => entry.kind === "file" && entry.role === "source");

  if (safeEditPath !== undefined) {
    agentHints.push({
      kind: "safe-edit-zone" as const,
      text: `Prefer edits under ${safeEditPath.path} before touching config, build, generated, or vendor paths.`,
      reason: "Observed source paths are a safer first edit area than config, build, generated, or vendor outputs.",
      confidence: safeEditPath.kind === "directory" ? "high" as const : "medium" as const,
      evidence: [safeEditPath.path],
    });
  }

  if (deferForNow.length > 0) {
    agentHints.push({
      kind: "watch-out" as const,
      text: `Defer ${deferForNow[0]?.path ?? "generated outputs"} during the first pass.`,
      reason: "Generated, build, and vendor paths tend to distract from primary source logic.",
      confidence: "medium" as const,
      evidence: [deferForNow[0]!.path],
    });
  }

  function entrypointSummary(kind: string): string {
    switch (kind) {
      case "cli": return "CLI entrypoint — invoked directly from the command line.";
      case "server": return "Server entrypoint — starts the HTTP/network service.";
      case "app": return "Application entrypoint — bootstraps the UI or app runtime.";
      case "library": return "Library entrypoint — public API surface for consumers.";
      case "test-harness": return "Test harness entrypoint — runs the test suite.";
      case "build": return "Build entrypoint — drives the compilation or bundling step.";
      default: return "Likely execution entrypoint.";
    }
  }

  return {
    schema_version: "2.0",
    run_id: input.run_id,
    repo: {
      name: path.basename(input.repo_root) || "repo",
      root: input.repo_root,
      repo_shape: repoShape,
      primary_languages: scan.detected.languages,
      detected_ecosystems: scan.detected.ecosystems,
      framework_hints: scan.detected.framework_hints,
    },
    meta: {
      run_id: input.run_id,
      snapshot_id: input.run_id,
      generated_at: new Date().toISOString(),
      included_paths: [...input.include],
      excluded_paths: scan.excluded_paths,
    },
    artifacts: {
      manifests: scan.detected.manifests,
      commands: signals.commands,
    },
    graph: {
      nodes,
      edges,
    },
    entrypoints: uniqueEntrypoints.map((entrypoint) => ({
      ...entrypoint,
      summary: entrypointSummary(entrypoint.kind),
    })),
    first_read_path: firstReadPath,
    key_paths: keyPaths,
    critical_paths: criticalPaths,
    defer_for_now: deferForNow,
    agent_hints: agentHints,
    warnings: [...signals.warnings],
    freshness: freshnessResult
      ? {
          mode: input.options.freshness_mode,
          status: freshnessResult.status,
          generated_from: freshnessResult.generated_from,
          reason: freshnessResult.reason,
        }
      : {
          mode: input.options.freshness_mode,
          status: "unknown",
          generated_from: "full",
          reason:
            input.options.freshness_mode === "off"
              ? "Freshness tracking is disabled for this run."
              : "Freshness mode is declared, but verified freshness regeneration is not implemented yet.",
        },
  };
}
