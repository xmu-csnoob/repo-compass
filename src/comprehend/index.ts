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
} from "../contracts/index.js";

export function buildComprehension(
  input: RepoInput,
  scan: import("../contracts/index.js").StructureScan,
  signals: SignalExtraction,
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

  const repoShape: RepoMetadata["repo_shape"] =
    scan.detected.framework_hints.includes("node-cli")
      ? "tool"
      : scan.detected.framework_hints.includes("express")
        ? "service"
        : scan.detected.framework_hints.includes("nextjs") || scan.detected.framework_hints.includes("react")
          ? "application"
          : "mixed";

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

  for (const keyPath of keyPaths.slice(0, 5)) {
    addFirstRead({
      path: keyPath.path,
      why_now: keyPath.role === "entry" ? "This is likely the first runtime hop." : "This path appears central to repo comprehension.",
      reason: keyPath.reason,
      confidence: keyPath.confidence,
      evidence: keyPath.evidence,
    });
  }

  const criticalPaths: CriticalPath[] = signals.entrypoints.map((entrypoint) => {
    const downstream = signals.edges
      .filter((edge) => edge.from === entrypoint.path)
      .map((edge) => edge.to);

    return {
      name: `${entrypoint.kind}:${entrypoint.path}`,
      steps: [entrypoint.path, ...downstream].slice(0, 5),
      reason: `Shows the first structural hop from ${entrypoint.path}.`,
      confidence: downstream.length > 0 ? "medium" : entrypoint.confidence,
      evidence: [...entrypoint.evidence],
    };
  });

  const deferForNow: DeferForNowItem[] = signals.defer_candidates.map((candidate) => ({
    path: candidate.path,
    reason: candidate.reason,
    confidence: candidate.confidence,
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

  const safeEditPath = keyPaths.find((item) => item.role === "core" || item.role === "entry");

  if (safeEditPath !== undefined) {
    agentHints.push({
      kind: "safe-edit-zone" as const,
      text: `Start edits near ${safeEditPath.path} before touching generated or vendor paths.`,
      reason: "Core source paths are safer than build, generated, or vendor outputs.",
      confidence: "medium" as const,
      evidence: [safeEditPath.path],
    });
  }

  if (deferForNow.length > 0) {
    agentHints.push({
      kind: "watch-out" as const,
      text: `Defer ${deferForNow[0]?.path ?? "generated outputs"} during the first pass.`,
      reason: "Generated, build, and vendor paths tend to distract from primary source logic.",
      confidence: "medium" as const,
      evidence: deferForNow[0]?.path !== undefined ? [deferForNow[0].path] : undefined,
    });
  }

  return {
    schema_version: "1.0",
    run_id: input.run_id,
    repo: {
      name: input.repo_root.split("/").at(-1) ?? "repo",
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
      included_paths: input.include.length > 0 ? [...input.include] : allPathEntries.map((entry) => entry.path),
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
    entrypoints: signals.entrypoints.map((entrypoint) => ({
      ...entrypoint,
      summary: "Likely execution entrypoint.",
    })),
    first_read_path: firstReadPath,
    key_paths: keyPaths,
    critical_paths: criticalPaths,
    defer_for_now: deferForNow,
    agent_hints: agentHints,
  };
}
