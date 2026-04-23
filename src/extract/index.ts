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
  readonly main?: string;
  readonly scripts?: Record<string, string>;
  readonly bin?: string | Record<string, string>;
};

type PythonScriptEntrypoint = {
  readonly name: string;
  readonly module: string;
  readonly callable: string;
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
  "src/entry-client.ts",
  "src/entry-server.ts",
  "src/entry-base.ts",
  "src/app.ts",
  "src/server.ts",
  "src/cli.ts",
  "src/app/page.tsx",
  "src/app/api/hello/route.ts",
] as const;

const PYTHON_COMMON_ENTRYPOINTS = [
  "src/__main__.py",
  "src/main.py",
  "src/app.py",
  "src/cli.py",
  "src/server.py",
  "app.py",
  "main.py",
  "manage.py",
  "wsgi.py",
  "asgi.py",
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

async function maybeReadText(absolutePath: string): Promise<string | undefined> {
  try {
    return await readFile(absolutePath, "utf8");
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

  if (normalized.includes("entry-client") || normalized.includes("entry-server")) {
    return "app";
  }

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

function inferPythonEntrypointKind(candidatePath: string, frameworkHints: Set<string>): Entrypoint["kind"] {
  const normalized = candidatePath.toLowerCase();

  if (normalized.includes("manage.py") || normalized.includes("wsgi.py") || normalized.includes("asgi.py")) {
    return "server";
  }

  if (normalized.includes("__main__.py") || normalized.includes("cli.py")) {
    return "cli";
  }

  if (normalized.endsWith("/api.py") && frameworkHints.has("fastapi")) {
    return "server";
  }

  if (normalized.includes("app.py") && (frameworkHints.has("fastapi") || frameworkHints.has("flask"))) {
    return "server";
  }

  if (normalized.includes("test_") || normalized.includes("_test.py")) {
    return "test-harness";
  }

  if (normalized.includes("__init__.py") || normalized.includes("src/") || normalized.includes("lib/")) {
    return "library";
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

function resolvePythonModule(
  importerPath: string,
  module: string,
  knownFilePaths: ReadonlySet<string>,
): string | undefined {
  if (module.startsWith(".")) {
    // Relative import
    const importerDir = path.posix.dirname(importerPath);
    const parts = module.split(".");
    let currentDir = importerDir;

    // Handle leading dots
    let dotCount = 0;
    for (const part of parts) {
      if (part === "") {
        dotCount++;
        currentDir = path.posix.dirname(currentDir);
      } else {
        break;
      }
    }

    const moduleParts = parts.filter((p) => p !== "");
    const modulePath = path.posix.join(currentDir, ...moduleParts);

    const candidates = [
      `${modulePath}.py`,
      path.posix.join(modulePath, "__init__.py"),
    ];

    return candidates.find((candidate) => knownFilePaths.has(candidate));
  }

  // Absolute import - try to find in known paths
  const parts = module.split(".");
  const modulePath = parts.join("/");

  const candidates = [
    `${modulePath}.py`,
    path.posix.join(modulePath, "__init__.py"),
    `src/${modulePath}.py`,
    path.posix.join("src", modulePath, "__init__.py"),
  ];

  return candidates.find((candidate) => knownFilePaths.has(candidate));
}

function normalizeCandidatePath(candidatePath: string): string {
  return path.posix.normalize(candidatePath.replace(/^\.\/+/u, ""));
}

function extractPyprojectScripts(pyprojectContent: string): PythonScriptEntrypoint[] {
  const sectionMatch = pyprojectContent.match(/\[project\.scripts\]([\s\S]*?)(?:\n\[|$)/u);

  if (sectionMatch?.[1] === undefined) {
    return [];
  }

  const scripts: PythonScriptEntrypoint[] = [];
  const linePattern = /^\s*([A-Za-z0-9_.-]+)\s*=\s*"([A-Za-z0-9_./-]+):([A-Za-z0-9_]+)"\s*$/gmu;

  for (const match of sectionMatch[1].matchAll(linePattern)) {
    const name = match[1];
    const module = match[2];
    const callable = match[3];

    if (name !== undefined && module !== undefined && callable !== undefined) {
      scripts.push({ name, module, callable });
    }
  }

  return scripts;
}

function pythonModuleToPath(moduleName: string, knownFilePaths: ReadonlySet<string>): string | undefined {
  const modulePath = moduleName.replaceAll(".", "/");
  const candidates = [
    `${modulePath}.py`,
    path.posix.join(modulePath, "__init__.py"),
    `src/${modulePath}.py`,
    path.posix.join("src", modulePath, "__init__.py"),
  ];

  return candidates.find((candidate) => knownFilePaths.has(candidate));
}

function inferPythonFileEntrypointFromContent(
  filePath: string,
  fileContent: string,
  frameworkHints: Set<string>,
): Entrypoint | undefined {
  if (filePath.endsWith("__main__.py")) {
    return {
      id: makeEntrypointId(filePath, "cli"),
      path: filePath,
      kind: "cli",
      reason: "Python __main__.py module supports direct module execution.",
      confidence: "high",
      evidence: [filePath],
    };
  }

  if (
    frameworkHints.has("fastapi") &&
    /(from\s+fastapi\s+import\s+FastAPI|FastAPI\s*\()/u.test(fileContent)
  ) {
    return {
      id: makeEntrypointId(filePath, "server"),
      path: filePath,
      kind: "server",
      reason: "FastAPI application object is defined here.",
      confidence: "high",
      evidence: ["fastapi", filePath],
    };
  }

  if (
    frameworkHints.has("flask") &&
    /(from\s+flask\s+import\s+Flask|Flask\s*\()/u.test(fileContent)
  ) {
    return {
      id: makeEntrypointId(filePath, "server"),
      path: filePath,
      kind: "server",
      reason: "Flask application object is defined here.",
      confidence: "high",
      evidence: ["flask", filePath],
    };
  }

  if (/\bif\s+__name__\s*==\s*["']__main__["']\s*:/u.test(fileContent)) {
    return {
      id: makeEntrypointId(filePath, "cli"),
      path: filePath,
      kind: "cli",
      reason: "Python main-guard indicates direct script execution starts here.",
      confidence: "medium",
      evidence: [filePath],
    };
  }

  return undefined;
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

type PythonImport = {
  readonly module: string;
  readonly names: string[] | undefined;
  readonly isRelative: boolean;
};

function extractPythonImports(fileContent: string): PythonImport[] {
  const imports: PythonImport[] = [];

  // import x.y.z
  const importPattern = /^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/gmu;
  for (const match of fileContent.matchAll(importPattern)) {
    const module = match[1];
    if (module !== undefined) {
      imports.push({ module, names: undefined, isRelative: false });
    }
  }

  // from x.y import z, w
  const fromPattern = /^from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import\s+(.+)$/gmu;
  for (const match of fileContent.matchAll(fromPattern)) {
    const module = match[1];
    const namesStr = match[2];
    if (module !== undefined) {
      const isRelative = module.startsWith(".");
      const names = namesStr
        ? namesStr.split(",").map((s) => s.trim()).filter((s) => s !== "" && s !== "*")
        : undefined;
      imports.push({ module, names, isRelative });
    }
  }

  // from . import x (relative import)
  const relativePattern = /^from\s+(\.+)(?:[a-zA-Z_][a-zA-Z0-9_]*)*\s+import\s+(.+)$/gmu;
  for (const match of fileContent.matchAll(relativePattern)) {
    const dots = match[1];
    const namesStr = match[2];
    if (dots !== undefined) {
      const names = namesStr
        ? namesStr.split(",").map((s) => s.trim()).filter((s) => s !== "" && s !== "*")
        : undefined;
      imports.push({ module: dots, names, isRelative: true });
    }
  }

  return imports;
}

function commandToPath(command: string, knownFilePaths: ReadonlySet<string>): string | undefined {
  const tokens = command
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token !== "");

  for (const token of tokens) {
    const cleaned = token.replace(/^['"]|['"]$/gu, "");
    const normalized = normalizeCandidatePath(cleaned);

    if (cleaned.startsWith("-")) {
      continue;
    }

    // Direct match with a recognized JS/TS extension
    if (/\.[cm]?[jt]sx?$/u.test(normalized) && knownFilePaths.has(normalized)) {
      return normalized;
    }

    // Extensionless resolution: "genesis.dev" → "genesis.dev.ts"
    // Only attempt for tokens that look like paths (contain a dot or slash),
    // not plain command names like "tsx" or "webpack".
    if (normalized.includes(".") || normalized.includes("/")) {
      for (const ext of SOURCE_FILE_EXTENSIONS) {
        const candidate = `${normalized}${ext}`;
        if (knownFilePaths.has(candidate)) {
          return candidate;
        }
      }
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
  const pyprojectManifests = scan.detected.manifests.filter((manifest) => manifest.kind === "pyproject");
  const frameworkHints = new Set(scan.detected.framework_hints);

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

    if (packageJson.main !== undefined) {
      const mainPath = normalizeCandidatePath(packageJson.main);
      if (knownFilePaths.has(mainPath)) {
        maybeAddEntrypoint(entrypoints, {
          id: makeEntrypointId(mainPath, inferEntrypointKind(mainPath)),
          path: mainPath,
          kind: inferEntrypointKind(mainPath),
          reason: "package.json main field points to this path.",
          confidence: "high",
          evidence: ["main"],
        });
      }
    }
  }

  for (const manifest of pyprojectManifests) {
    const pyprojectContent = await maybeReadText(resolveRepoRelativePath(scan.repo.root, manifest.path));

    if (pyprojectContent === undefined) {
      warnings.push(`Unable to read manifest ${manifest.path}`);
      continue;
    }

    for (const script of extractPyprojectScripts(pyprojectContent)) {
      const scriptPath = pythonModuleToPath(script.module, knownFilePaths);

      if (scriptPath === undefined) {
        warnings.push(
          `Skipping Python script entrypoint "${script.module}:${script.callable}" because it is not present in the scanned snapshot.`,
        );
        continue;
      }

      maybeAddEntrypoint(entrypoints, {
        id: makeEntrypointId(scriptPath, "cli"),
        path: scriptPath,
        kind: "cli",
        reason: `pyproject.toml script "${script.name}" points to this module.`,
        confidence: "high",
        evidence: [`project.scripts.${script.name}`],
      });
    }
  }

  const frameworkSpecificEntrypoints = new Set<string>();

  if (frameworkHints.has("vue")) {
    for (const candidatePath of ["src/entry-client.ts", "src/entry-server.ts", "src/entry-base.ts"] as const) {
      if (!knownFilePaths.has(candidatePath)) {
        continue;
      }

      frameworkSpecificEntrypoints.add(candidatePath);
      maybeAddEntrypoint(entrypoints, {
        id: makeEntrypointId(candidatePath, inferEntrypointKind(candidatePath)),
        path: candidatePath,
        kind: inferEntrypointKind(candidatePath),
        reason: "Matched a Vue application entry convention.",
        confidence: candidatePath === "src/entry-base.ts" ? "medium" : "high",
        evidence: ["vue"],
      });
    }
  }

  for (const candidatePath of COMMON_ENTRYPOINTS) {
    if (!knownFilePaths.has(candidatePath)) {
      continue;
    }

    if (frameworkSpecificEntrypoints.has(candidatePath)) {
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

  // Python entrypoint detection
  const pythonFrameworkHints = new Set(
    [...frameworkHints].filter((h) => h.startsWith("python-") || ["fastapi", "flask", "django", "pytest"].includes(h))
  );

  for (const candidatePath of PYTHON_COMMON_ENTRYPOINTS) {
    if (!knownFilePaths.has(candidatePath)) {
      continue;
    }

    const kind = inferPythonEntrypointKind(candidatePath, pythonFrameworkHints);
    const confidence: Entrypoint["confidence"] =
      candidatePath === "manage.py" || candidatePath === "src/__main__.py"
        ? "high"
        : "medium";

    maybeAddEntrypoint(entrypoints, {
      id: makeEntrypointId(candidatePath, kind),
      path: candidatePath,
      kind,
      reason: "Matched a common Python repo entrypoint convention.",
      confidence,
      evidence: [candidatePath],
    });
  }

  for (const filePath of [...knownFilePaths].sort()) {
    if (!filePath.endsWith(".py")) {
      continue;
    }

    const fileContent = await maybeReadText(resolveRepoRelativePath(scan.repo.root, filePath));

    if (fileContent === undefined) {
      continue;
    }

    const inferredEntrypoint = inferPythonFileEntrypointFromContent(
      filePath,
      fileContent,
      pythonFrameworkHints,
    );

    if (inferredEntrypoint !== undefined) {
      maybeAddEntrypoint(entrypoints, inferredEntrypoint);
    }
  }

  for (const filePath of knownFilePaths) {
    const fileRole = fileRoleByPath.get(filePath);

    if (fileRole !== "source" && fileRole !== "config" && fileRole !== "tests") {
      continue;
    }

    const absolutePath = resolveRepoRelativePath(scan.repo.root, filePath);
    const fileContent = await readFile(absolutePath, "utf8");

    if (filePath.endsWith(".py") || filePath.endsWith(".pyi")) {
      // Python import extraction
      const pythonImports = extractPythonImports(fileContent);
      for (const pyImport of pythonImports) {
        const resolvedModule = resolvePythonModule(filePath, pyImport.module, knownFilePaths);
        if (resolvedModule !== undefined) {
          edges.push({
            from: filePath,
            to: resolvedModule,
            kind: "module-link",
          });
        }
      }
    } else {
      // JS/TS import extraction
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
  }

  // Build a focused index of relevant files for config-link generation
  const sourceLikeFiles = [...knownFilePaths].filter(
    (p) => fileRoleByPath.get(p) === "source" || fileRoleByPath.get(p) === "config" || fileRoleByPath.get(p) === "tests",
  );

  for (const pathEntry of scan.paths) {
    if (pathEntry.role !== "config" || pathEntry.kind !== "file") {
      continue;
    }

    const basename = path.posix.basename(pathEntry.path);
    const parentDir = path.posix.dirname(pathEntry.path);

    if (basename.startsWith("tsconfig") || basename === "jsconfig.json") {
      if (parentDir === ".") {
        // Root-level tsconfig applies to all source/config/test files (excluding itself)
        for (const sourcePath of sourceLikeFiles) {
          if (sourcePath !== pathEntry.path) {
            edges.push({
              from: sourcePath,
              to: pathEntry.path,
              kind: "config-link",
            });
          }
        }
      } else {
        // Subdirectory tsconfig links to all source files under that directory (any depth)
        for (const sourcePath of sourceLikeFiles) {
          if (sourcePath !== pathEntry.path && sourcePath.startsWith(`${parentDir}/`)) {
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
  const EDGE_WEIGHTS: Partial<Record<GraphEdge["kind"], number>> = {
    "import": 1,
    "require": 1,
    "reference": 1,
    "route": 1,
    "test-of": 0.5,
    "config-link": 0.1,
  };

  for (const edge of edges) {
    const weight = EDGE_WEIGHTS[edge.kind] ?? 0;
    if (weight === 0) {
      continue;
    }
    fanInCounts.set(edge.to, (fanInCounts.get(edge.to) ?? 0) + weight);
  }

  for (const [targetPath, fanIn] of fanInCounts) {
    if (fanIn < 2) {
      continue;
    }

    if (fileRoleByPath.get(targetPath) === "config") {
      continue;
    }

    maybeAddPriorityCandidate(priorityCandidates, {
      path: targetPath,
      signal: "fan-in",
      reason: "Multiple files depend on this path, so it likely coordinates shared behavior.",
      confidence: fanIn >= 3 ? "high" : "medium",
      evidence: [`fan_in:${fanIn.toFixed(2)}`],
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

    // Python framework-specific priority candidates
    if (frameworkHint === "fastapi" && knownFilePaths.has("app/main.py")) {
      maybeAddPriorityCandidate(priorityCandidates, {
        path: "app/main.py",
        signal: "workflow-core",
        reason: "FastAPI services commonly bootstrap the ASGI application here.",
        confidence: "high",
        evidence: ["fastapi"],
      });
    }

    if (frameworkHint === "fastapi" && knownFilePaths.has("src/main.py")) {
      maybeAddPriorityCandidate(priorityCandidates, {
        path: "src/main.py",
        signal: "workflow-core",
        reason: "FastAPI services commonly bootstrap the ASGI application here.",
        confidence: "high",
        evidence: ["fastapi"],
      });
    }

    if (frameworkHint === "fastapi" && knownFilePaths.has("src/mixed_repo/api.py")) {
      maybeAddPriorityCandidate(priorityCandidates, {
        path: "src/mixed_repo/api.py",
        signal: "workflow-core",
        reason: "FastAPI backend routes and application bootstrap are defined here.",
        confidence: "high",
        evidence: ["fastapi"],
      });
    }

    if (frameworkHint === "flask" && knownFilePaths.has("app.py")) {
      maybeAddPriorityCandidate(priorityCandidates, {
        path: "app.py",
        signal: "workflow-core",
        reason: "Flask applications commonly define the WSGI application here.",
        confidence: "high",
        evidence: ["flask"],
      });
    }

    if (frameworkHint === "django" && knownFilePaths.has("manage.py")) {
      maybeAddPriorityCandidate(priorityCandidates, {
        path: "manage.py",
        signal: "workflow-core",
        reason: "Django management commands and server bootstrap are defined here.",
        confidence: "high",
        evidence: ["django"],
      });
    }
  }

  for (const pathEntry of scan.paths) {
    if (pathEntry.role === "vendor" || pathEntry.role === "generated" || pathEntry.role === "build") {
      deferCandidates.push({
        path: pathEntry.path,
        reason: `Path role "${pathEntry.role}" is usually not helpful during the first read.`,
        confidence: "high",
        evidence: [pathEntry.path],
      });
    }
  }

  for (const pathEntry of scan.paths) {
    const baseName = path.posix.basename(pathEntry.path);
    const shouldDefer =
      pathEntry.path === ".github" ||
      pathEntry.path.startsWith(".github/") ||
      pathEntry.path === ".vscode" ||
      pathEntry.path.startsWith(".vscode/") ||
      baseName === "Dockerfile" ||
      /^docker-.*\.(sh|bash)$/u.test(baseName) ||
      baseName === ".editorconfig";

    if (!shouldDefer || deferCandidates.some((candidate) => candidate.path === pathEntry.path)) {
      continue;
    }

    deferCandidates.push({
      path: pathEntry.path,
      reason: "Infra, editor, or containerization files can usually be deferred during the first read.",
      confidence: "medium",
      evidence: [pathEntry.path],
    });
  }

  // Python manifest priority candidates
  for (const manifest of scan.detected.manifests) {
    if (["pyproject", "setup-py", "setup-cfg", "requirements"].includes(manifest.kind)) {
      maybeAddPriorityCandidate(priorityCandidates, {
        path: manifest.path,
        signal: "manifest",
        reason: `Python manifest (${manifest.kind}) defines the primary workspace metadata.`,
        confidence: "high",
        evidence: [manifest.kind],
      });
    }
  }

  for (const candidatePath of [...knownFilePaths].sort()) {
    if (
      candidatePath.endsWith("/__init__.py") &&
      fileRoleByPath.get(candidatePath) === "source" &&
      !entrypoints.some((entrypoint) => entrypoint.path === candidatePath)
    ) {
      const libraryEntrypoint: Entrypoint = {
        id: makeEntrypointId(candidatePath, "library"),
        path: candidatePath,
        kind: "library",
        reason: "Python package initializer exposes the public import surface.",
        confidence: "medium",
        evidence: [candidatePath],
      };

      maybeAddEntrypoint(entrypoints, {
        ...libraryEntrypoint,
      });
      maybeAddPriorityCandidate(priorityCandidates, {
        path: libraryEntrypoint.path,
        signal: "entrypoint",
        reason: "Likely runtime starting point for the repository.",
        confidence: libraryEntrypoint.confidence,
        evidence: [...libraryEntrypoint.evidence],
      });
    }
  }

  // Python-specific defer candidates
  for (const pathEntry of scan.paths) {
    const baseName = path.posix.basename(pathEntry.path);
    const shouldDeferPython =
      baseName === "__pycache__" ||
      pathEntry.path.startsWith("__pycache__/") ||
      baseName.endsWith(".pyc") ||
      baseName.endsWith(".pyo") ||
      baseName.endsWith(".egg-info") ||
      pathEntry.path.includes(".egg-info/");

    if (!shouldDeferPython || deferCandidates.some((candidate) => candidate.path === pathEntry.path)) {
      continue;
    }

    deferCandidates.push({
      path: pathEntry.path,
      reason: "Python build artifacts and cache files can usually be deferred during the first read.",
      confidence: "high",
      evidence: [pathEntry.path],
    });
  }

  const signals: SignalExtraction = {
    schema_version: "2.0",
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
