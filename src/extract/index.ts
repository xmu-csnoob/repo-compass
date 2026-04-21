import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  signalExtractionSchema,
  validateContract,
} from "../contracts/index.js";
import { resolveRepoRelativePath } from "../shared/index.js";

import type {
  Command,
  DeferCandidate,
  Entrypoint,
  GraphEdge,
  PriorityCandidate,
  SignalExtraction,
  StructurePath,
  StructureScan,
} from "../contracts/index.js";

type PackageJson = {
  readonly name?: string;
  readonly scripts?: Record<string, string>;
  readonly bin?: string | Record<string, string>;
};

type ExtractedImport = {
  readonly specifier: string;
  readonly kind: "import" | "require" | "reference";
};

const SOURCE_FILE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
] as const;

const COMMON_ENTRYPOINTS = [
  "src/index.ts",
  "src/index.tsx",
  "src/main.tsx",
  "src/app.ts",
  "src/server.ts",
  "src/cli.ts",
  "src/app/page.tsx",
  "src/app/api/hello/route.ts",
] as const;

function makeEntrypointId(pathValue: string, kind: Entrypoint["kind"]): string {
  return `${kind}:${pathValue}`;
}

async function maybeReadJson<TValue>(absolutePath: string): Promise<TValue | undefined> {
  try {
    const content = await readFile(absolutePath, "utf8");
    return JSON.parse(content) as TValue;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function inferEntrypointKind(candidatePath: string, command?: string): Entrypoint["kind"] {
  const normalized = candidatePath.toLowerCase();
  const loweredCommand = command?.toLowerCase() ?? "";

  if (normalized.includes("page.tsx") || loweredCommand.includes("next ")) {
    return "app";
  }

  if (normalized.includes("server") || normalized.includes("app.ts") || loweredCommand.includes("express")) {
    return "server";
  }

  if (normalized.includes("cli") || loweredCommand.includes("tsx ") || loweredCommand.includes("node ")) {
    return "cli";
  }

  return "app";
}

function resolveRelativeImport(
  importerPath: string,
  specifier: string,
  knownFilePaths: ReadonlySet<string>,
): string | undefined {
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  const importerDirectory = path.posix.dirname(importerPath);
  const resolvedBase = path.posix.normalize(path.posix.join(importerDirectory, specifier));
  const directCandidates = [
    resolvedBase,
    ...SOURCE_FILE_EXTENSIONS.map((extension) => `${resolvedBase}${extension}`),
    ...SOURCE_FILE_EXTENSIONS.map((extension) => path.posix.join(resolvedBase, `index${extension}`)),
  ];

  return directCandidates.find((candidate) => knownFilePaths.has(candidate));
}

function normalizeCandidatePath(candidatePath: string): string {
  return path.posix.normalize(candidatePath.replace(/^\.\/+/u, ""));
}

function extractRelativeImports(fileContent: string): ExtractedImport[] {
  const imports = new Map<string, ExtractedImport["kind"]>();
  const patterns: Array<{
    readonly kind: ExtractedImport["kind"];
    readonly pattern: RegExp;
  }> = [
    { kind: "import", pattern: /\bimport\s+[^'"]*?from\s+["']([^"']+)["']/gu },
    { kind: "import", pattern: /\bimport\s+["']([^"']+)["']/gu },
    { kind: "import", pattern: /\bexport\s+[^'"]*?from\s+["']([^"']+)["']/gu },
    { kind: "require", pattern: /\brequire\(\s*["']([^"']+)["']\s*\)/gu },
    { kind: "reference", pattern: /^\/\/\/\s*<reference\s+path=["']([^"']+)["']/gm },
    { kind: "reference", pattern: /^\/\/\/\s*<reference\s+types=["']([^"']+)["']/gm },
  ];

  for (const { kind, pattern } of patterns) {
    for (const match of fileContent.matchAll(pattern)) {
      const specifier = match[1];

      if (specifier !== undefined && !imports.has(specifier)) {
        imports.set(specifier, kind);
      }
    }
  }

  return [...imports.entries()].map(([specifier, kind]) => ({ specifier, kind }));
}

function commandToPath(command: string, knownFilePaths: ReadonlySet<string>): string | undefined {
  const tokens = command
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token !== "");

  for (const token of tokens) {
    const cleaned = token.replace(/^['"]|['"]$/gu, "");

    if (knownFilePaths.has(cleaned)) {
      return cleaned;
    }
  }

  return undefined;
}

function maybeAddPriorityCandidate(
  collection: PriorityCandidate[],
  candidate: PriorityCandidate,
): void {
  if (collection.some((item) => item.path === candidate.path && item.signal === candidate.signal)) {
    return;
  }

  collection.push(candidate);
}

function maybeAddEntrypoint(collection: Entrypoint[], candidate: Entrypoint): void {
  if (collection.some((item) => item.id === candidate.id)) {
    return;
  }

  collection.push(candidate);
}

export async function extractSignals(scan: StructureScan): Promise<SignalExtraction> {
  const knownFilePaths = new Set(
    scan.paths.filter((entry) => entry.kind === "file").map((entry) => entry.path),
  );
  const commands: Command[] = [];
  const entrypoints: Entrypoint[] = [];
  const edges: GraphEdge[] = [];
  const priorityCandidates: PriorityCandidate[] = [];
  const deferCandidates: DeferCandidate[] = [];
  const warnings: string[] = [];
  const fileRoleByPath = new Map(scan.paths.map((entry) => [entry.path, entry.role] satisfies [string, StructurePath["role"]]));
  const manifestPaths = scan.detected.manifests.filter((manifest) => manifest.kind === "package-json");

  for (const manifest of manifestPaths) {
    const packageJson = await maybeReadJson<PackageJson>(
      resolveRepoRelativePath(scan.repo.root, manifest.path),
    );

    if (packageJson === undefined) {
      warnings.push(`Unable to read manifest ${manifest.path}`);
      continue;
    }

    maybeAddPriorityCandidate(priorityCandidates, {
      path: manifest.path,
      signal: "manifest",
      reason: "Package manifest defines the primary Node workspace metadata.",
      confidence: "high",
      evidence: ["package.json"],
    });

    for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
      commands.push({
        source_path: manifest.path,
        name,
        command,
      });

      const commandPath = commandToPath(command, knownFilePaths);

      if (commandPath !== undefined) {
        maybeAddEntrypoint(entrypoints, {
          id: makeEntrypointId(commandPath, inferEntrypointKind(commandPath, command)),
          path: commandPath,
          kind: inferEntrypointKind(commandPath, command),
          reason: `Script "${name}" points to this path.`,
          confidence: name === "dev" || name === "start" ? "high" : "medium",
          evidence: [`scripts.${name}`],
        });
      }
    }

    if (typeof packageJson.bin === "string") {
      const binTarget = commandToPath(packageJson.bin, knownFilePaths) ?? normalizeCandidatePath(packageJson.bin);

      if (!knownFilePaths.has(binTarget)) {
        warnings.push(
          `Skipping bin entrypoint "${packageJson.bin}" because it is not present in the scanned snapshot.`,
        );
        continue;
      }

      maybeAddEntrypoint(entrypoints, {
        id: makeEntrypointId(binTarget, "cli"),
        path: binTarget,
        kind: "cli",
        reason: "package.json exposes a binary entrypoint.",
        confidence: "high",
        evidence: ["bin"],
      });
    } else {
      for (const binTarget of Object.values(packageJson.bin ?? {})) {
        const resolvedTarget = commandToPath(binTarget, knownFilePaths) ?? normalizeCandidatePath(binTarget);

        if (!knownFilePaths.has(resolvedTarget)) {
          warnings.push(
            `Skipping bin entrypoint "${binTarget}" because it is not present in the scanned snapshot.`,
          );
          continue;
        }

        maybeAddEntrypoint(entrypoints, {
          id: makeEntrypointId(resolvedTarget, "cli"),
          path: resolvedTarget,
          kind: "cli",
          reason: "package.json exposes a binary entrypoint.",
          confidence: "high",
          evidence: ["bin"],
        });
      }
    }
  }

  for (const candidatePath of COMMON_ENTRYPOINTS) {
    if (!knownFilePaths.has(candidatePath)) {
      continue;
    }

    const role = fileRoleByPath.get(candidatePath);
    const kind =
      role === "tests"
        ? "test-harness"
        : inferEntrypointKind(candidatePath);

    maybeAddEntrypoint(entrypoints, {
      id: makeEntrypointId(candidatePath, kind),
      path: candidatePath,
      kind,
      reason: "Matched a common JS/TS repo entrypoint convention.",
      confidence: candidatePath === "src/index.ts" || candidatePath === "src/app/page.tsx" ? "high" : "medium",
      evidence: [candidatePath],
    });
  }

  for (const filePath of knownFilePaths) {
    const fileRole = fileRoleByPath.get(filePath);

    if (fileRole !== "source" && fileRole !== "config" && fileRole !== "tests") {
      continue;
    }

    const absolutePath = resolveRepoRelativePath(scan.repo.root, filePath);
    const fileContent = await readFile(absolutePath, "utf8");
    const imports = extractRelativeImports(fileContent);

    for (const extractedImport of imports) {
      const resolvedImportPath = resolveRelativeImport(
        filePath,
        extractedImport.specifier,
        knownFilePaths,
      );

      if (resolvedImportPath === undefined) {
        continue;
      }

      edges.push({
        from: filePath,
        to: resolvedImportPath,
        kind: extractedImport.kind,
      });
    }
  }

  // Pre-index source files by parent directory for efficient config-link resolution
  const sourceFilesByDir = new Map<string, string[]>();
  for (const sourcePath of knownFilePaths) {
    const dir = path.posix.dirname(sourcePath);
    const existing = sourceFilesByDir.get(dir);
    if (existing !== undefined) {
      existing.push(sourcePath);
    } else {
      sourceFilesByDir.set(dir, [sourcePath]);
    }
  }

  for (const pathEntry of scan.paths) {
    if (pathEntry.role !== "config" || pathEntry.kind !== "file") {
      continue;
    }

    const basename = path.posix.basename(pathEntry.path);
    const parentDir = path.posix.dirname(pathEntry.path);

    if (basename.startsWith("tsconfig") || basename === "jsconfig.json") {
      if (parentDir === ".") {
        // Root-level tsconfig applies to all source files
        for (const sourcePath of knownFilePaths) {
          if (sourcePath.startsWith("src/") || sourcePath.match(/\/[cm]?jsx?$/u)) {
            edges.push({
              from: sourcePath,
              to: pathEntry.path,
              kind: "config-link",
            });
          }
        }
      } else {
        // Subdirectory tsconfig only links to source files under that directory
        const sourcesInScope = sourceFilesByDir.get(parentDir) ?? [];
        for (const sourcePath of sourcesInScope) {
          if (sourcePath.startsWith(`${parentDir}/`)) {
            edges.push({
              from: sourcePath,
              to: pathEntry.path,
              kind: "config-link",
            });
          }
        }
      }
    }
  }

  for (const filePath of knownFilePaths) {
    const basename = path.posix.basename(filePath);

    if (basename.includes(".test.") || basename.includes(".spec.")) {
      const targetPath = basename.includes(".test.")
        ? filePath.replace(/\.test\./g, ".")
        : filePath.replace(/\.spec\./g, ".");

      if (knownFilePaths.has(targetPath)) {
        edges.push({
          from: filePath,
          to: targetPath,
          kind: "test-of",
        });
      }
    }
  }

  // Route edges: link route handler files to their parent directory (route hierarchy)
  for (const filePath of knownFilePaths) {
    const basename = path.posix.basename(filePath);

    if (basename === "route.ts" || basename === "route.js" || basename === "route.tsx") {
      const parentDir = path.posix.dirname(filePath);

      edges.push({
        from: filePath,
        to: parentDir,
        kind: "route",
      });
    }
  }

  const fanInCounts = new Map<string, number>();

  for (const edge of edges) {
    fanInCounts.set(edge.to, (fanInCounts.get(edge.to) ?? 0) + 1);
  }

  for (const [targetPath, fanIn] of fanInCounts) {
    if (fanIn < 2) {
      continue;
    }

    maybeAddPriorityCandidate(priorityCandidates, {
      path: targetPath,
      signal: "fan-in",
      reason: "Multiple files depend on this path, so it likely coordinates shared behavior.",
      confidence: fanIn >= 3 ? "high" : "medium",
      evidence: [`fan_in:${fanIn}`],
    });
  }

  for (const entrypoint of entrypoints) {
    maybeAddPriorityCandidate(priorityCandidates, {
      path: entrypoint.path,
      signal: "entrypoint",
      reason: "Likely runtime starting point for the repository.",
      confidence: entrypoint.confidence,
      evidence: [...entrypoint.evidence],
    });
  }

  for (const frameworkHint of scan.detected.framework_hints) {
    if (frameworkHint === "nextjs" && knownFilePaths.has("src/app/page.tsx")) {
      maybeAddPriorityCandidate(priorityCandidates, {
        path: "src/app/page.tsx",
        signal: "framework-core",
        reason: "Next.js app router uses this page as a primary UI surface.",
        confidence: "high",
        evidence: ["nextjs"],
      });
    }

    if (frameworkHint === "express" && knownFilePaths.has("src/app.ts")) {
      maybeAddPriorityCandidate(priorityCandidates, {
        path: "src/app.ts",
        signal: "workflow-core",
        reason: "Express services commonly bootstrap routes and middleware here.",
        confidence: "high",
        evidence: ["express"],
      });
    }
  }

  for (const pathEntry of scan.paths) {
    if (pathEntry.role === "vendor" || pathEntry.role === "generated" || pathEntry.role === "build") {
      deferCandidates.push({
        path: pathEntry.path,
        reason: `Path role "${pathEntry.role}" is usually not helpful during the first read.`,
        confidence: "high",
      });
    }
  }

  const signals: SignalExtraction = {
    schema_version: "1.0",
    run_id: scan.run_id,
    entrypoints,
    commands,
    edges,
    priority_candidates: priorityCandidates,
    defer_candidates: deferCandidates,
    warnings,
  };

  return validateContract(signalExtractionSchema, signals, "signalExtraction");
}
