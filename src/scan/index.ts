import path from "node:path";

import {
  structureScanSchema,
  validateContract,
} from "../contracts/index.js";
import { loadIgnoreRules, walkDirectoryStable } from "../shared/index.js";

import type {
  Manifest,
  RepoInput,
  StructurePath,
  StructureScan,
} from "../contracts/index.js";
import type { WalkEntry } from "../shared/index.js";

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
]);

const PYTHON_LOCKFILE_NAMES = new Set([
  "poetry.lock",
  "Pipfile.lock",
]);

const REQUIREMENTS_PATTERN = /^requirements.*\.txt$/u;

const CONFIG_FILENAMES = [
  "tsconfig.json",
  "jsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "next.config.js",
  "next.config.mjs",
  "eslint.config.js",
  ".eslintrc.js",
  ".eslintrc.cjs",
];

function hasPathPrefix(candidatePath: string, prefixes: readonly string[]): boolean {
  if (prefixes.length === 0) {
    return true;
  }

  return prefixes.some((prefix) => candidatePath === prefix || candidatePath.startsWith(`${prefix}/`));
}

function classifyPathRole(entry: WalkEntry): StructurePath["role"] {
  const baseName = path.posix.basename(entry.repoRelativePath);

  if (
    entry.repoRelativePath.startsWith("docs/") ||
    baseName === "README.md" ||
    (baseName.endsWith(".md") && !entry.repoRelativePath.startsWith("src/") && !entry.repoRelativePath.startsWith("app/"))
  ) {
    return "docs";
  }

  if (
    entry.repoRelativePath.includes("/__tests__/") ||
    entry.repoRelativePath.includes("/test/") ||
    entry.repoRelativePath.includes("/tests/") ||
    entry.repoRelativePath.startsWith("tests/") ||
    entry.repoRelativePath.startsWith("test/") ||
    /\.test\.[cm]?[jt]sx?$/u.test(entry.repoRelativePath) ||
    /\.spec\.[cm]?[jt]sx?$/u.test(entry.repoRelativePath) ||
    baseName === "setupTests.ts" ||
    baseName.startsWith("test_") ||
    baseName.endsWith("_test.py")
  ) {
    return "tests";
  }

  if (
    CONFIG_FILENAMES.includes(baseName) ||
    baseName.startsWith(".eslintrc") ||
    baseName.endsWith(".config.ts") ||
    baseName.endsWith(".config.js") ||
    baseName.endsWith(".config.mjs") ||
    baseName.endsWith(".config.py") ||
    baseName === "pyproject.toml" ||
    baseName === "setup.py" ||
    baseName === "setup.cfg" ||
    baseName === "tox.ini" ||
    baseName === "pytest.ini"
  ) {
    return "config";
  }

  if (
    entry.repoRelativePath.startsWith("vendor/") ||
    entry.repoRelativePath.includes("/vendor/") ||
    entry.repoRelativePath.startsWith(".venv/") ||
    entry.repoRelativePath.startsWith("venv/") ||
    entry.repoRelativePath.startsWith("env/") ||
    entry.repoRelativePath.startsWith(".env/")
  ) {
    return "vendor";
  }

  if (
    entry.repoRelativePath.startsWith(".next/") ||
    entry.repoRelativePath.startsWith(".output/") ||
    entry.repoRelativePath.startsWith("build/") ||
    entry.repoRelativePath.startsWith("dist/") ||
    entry.repoRelativePath.startsWith("__pycache__/") ||
    entry.repoRelativePath.includes("/__pycache__/") ||
    entry.repoRelativePath.startsWith(".pytest_cache/") ||
    entry.repoRelativePath.startsWith(".mypy_cache/")
  ) {
    return "build";
  }

  if (
    entry.repoRelativePath.includes("/generated/") ||
    entry.repoRelativePath.includes("/__generated__/") ||
    entry.repoRelativePath.endsWith(".egg-info") ||
    entry.repoRelativePath.includes(".egg-info/")
  ) {
    return "generated";
  }

  if (
    (entry.kind === "directory" && (
      entry.repoRelativePath === "src" ||
      entry.repoRelativePath === "app" ||
      entry.repoRelativePath === "lib" ||
      entry.repoRelativePath.endsWith("/src") ||
      entry.repoRelativePath.endsWith("/app") ||
      entry.repoRelativePath.endsWith("/lib")
    )) ||
    entry.repoRelativePath.startsWith("src/") ||
    entry.repoRelativePath.startsWith("app/") ||
    entry.repoRelativePath.includes("/src/") ||
    /\.(?:[cm]?[jt]sx?)$/u.test(baseName) ||
    /\.(py|pyi)$/u.test(baseName)
  ) {
    return "source";
  }

  return "unknown";
}

function detectLanguages(entries: readonly WalkEntry[]): string[] {
  const found = new Set<string>();

  for (const entry of entries) {
    if (entry.kind !== "file") {
      continue;
    }

    if (/\.(ts|tsx|mts|cts)$/u.test(entry.repoRelativePath)) {
      found.add("TypeScript");
    } else if (/\.(js|jsx|mjs|cjs)$/u.test(entry.repoRelativePath)) {
      found.add("JavaScript");
    } else if (/\.json$/u.test(entry.repoRelativePath)) {
      found.add("JSON");
    } else if (/\.md$/u.test(entry.repoRelativePath)) {
      found.add("Markdown");
    } else if (/\.(py|pyi|pyx)$/u.test(entry.repoRelativePath)) {
      found.add("Python");
    }
  }

  return [...found].sort();
}

function detectFrameworkHints(entries: readonly WalkEntry[], packageJsonContent?: string, pyprojectContent?: string, requirementsContent?: string): string[] {
  const hints = new Set<string>();
  const allPaths = new Set(entries.map((entry) => entry.repoRelativePath));
  const packageText = packageJsonContent ?? "";
  const pyprojectText = pyprojectContent ?? "";
  const requirementsText = requirementsContent ?? "";
  const hasVueFiles = entries.some((entry) => entry.repoRelativePath.endsWith(".vue"));
  const hasPythonFiles = entries.some((entry) => /\.(py|pyi)$/u.test(entry.repoRelativePath));

  // Node.js framework hints
  if (allPaths.has("next.config.js") || allPaths.has("src/app/page.tsx") || /"next"\s*:/u.test(packageText)) {
    hints.add("nextjs");
  }

  if (
    allPaths.has("vite.config.ts") ||
    allPaths.has("vite.config.js") ||
    /"vite"\s*:/u.test(packageText)
  ) {
    hints.add("vite");
  }

  if (/react/u.test(packageText) || allPaths.has("src/App.tsx") || allPaths.has("src/main.tsx")) {
    hints.add("react");
  }

  if (/"vue"\s*:/u.test(packageText) || hasVueFiles || allPaths.has("src/app.vue")) {
    hints.add("vue");
  }

  if (/express/u.test(packageText) || allPaths.has("src/app.ts")) {
    hints.add("express");
  }

  if (/"bin"\s*:/u.test(packageText)) {
    hints.add("node-cli");
  }

  // CLI detection: scripts.dev/start invoke tsx/node/ts-node/bun directly on a source file
  if (!hints.has("node-cli")) {
    const devScript = /"dev"\s*:\s*"([^"]*)"/u.exec(packageText)?.[1] ?? "";
    const startScript = /"start"\s*:\s*"([^"]*)"/u.exec(packageText)?.[1] ?? "";
    const scriptText = `${devScript} ${startScript}`;
    if (/\b(?:tsx|ts-node|node|bun)\s+(\.\/)?src\//u.test(scriptText)) {
      hints.add("node-cli");
    }
  }

  // Library: has main or exports but no stronger application/service/CLI signal.
  if (
    !/"bin"\s*:/u.test(packageText) &&
    !hints.has("nextjs") &&
    !hints.has("vite") &&
    !hints.has("react") &&
    !hints.has("vue") &&
    !hints.has("express") &&
    !hints.has("node-cli") &&
    (/"main"\s*:/u.test(packageText) || /"exports"\s*:/u.test(packageText))
  ) {
    hints.add("library");
  }

  // Python framework hints
  if (hasPythonFiles || pyprojectText || requirementsText) {
    const allPythonText = `${pyprojectText} ${requirementsText}`;

    if (/fastapi/u.test(allPythonText) || allPaths.has("src/main.py") || allPaths.has("app.py")) {
      hints.add("fastapi");
    }

    if (/flask/u.test(allPythonText) || allPaths.has("app.py") || allPaths.has("application.py")) {
      hints.add("flask");
    }

    if (/django/u.test(allPythonText) || allPaths.has("manage.py")) {
      hints.add("django");
    }

    if (/pytest/u.test(allPythonText) || allPaths.has("pytest.ini") || allPaths.has("conftest.py")) {
      hints.add("pytest");
    }

    if (/poetry/u.test(allPythonText) || allPaths.has("poetry.lock")) {
      hints.add("poetry");
    }

    // Python CLI detection: pyproject.toml [project.scripts] or setup.py console_scripts
    if (/\[project\.scripts\]/u.test(pyprojectText) || /console_scripts/u.test(pyprojectText)) {
      hints.add("python-cli");
    }

    // Python library: has package structure but no stronger app/service/CLI signal
    if (
      !hints.has("fastapi") &&
      !hints.has("flask") &&
      !hints.has("django") &&
      !hints.has("python-cli") &&
      (allPaths.has("src/__init__.py") || allPaths.has("__init__.py"))
    ) {
      hints.add("python-library");
    }
  }

  return [...hints];
}

async function maybeReadFile(repoRoot: string, relativePath: string): Promise<string | undefined> {
  const filePath = path.join(repoRoot, relativePath);

  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function maybeReadPackageJson(repoRoot: string): Promise<string | undefined> {
  return maybeReadFile(repoRoot, "package.json");
}

async function maybeReadPyproject(repoRoot: string): Promise<string | undefined> {
  return maybeReadFile(repoRoot, "pyproject.toml");
}

async function maybeReadRequirements(repoRoot: string): Promise<string | undefined> {
  const requirementsPath = path.join(repoRoot, "requirements.txt");

  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(requirementsPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function collectManifests(entries: readonly WalkEntry[]): Manifest[] {
  const manifests: Manifest[] = [];

  for (const entry of entries) {
    if (entry.kind !== "file") {
      continue;
    }

    const baseName = path.posix.basename(entry.repoRelativePath);

    if (baseName === "package.json") {
      manifests.push({ path: entry.repoRelativePath, kind: "package-json" });
      continue;
    }

    if (baseName === "pyproject.toml") {
      manifests.push({ path: entry.repoRelativePath, kind: "pyproject" });
      continue;
    }

    if (baseName === "setup.py") {
      manifests.push({ path: entry.repoRelativePath, kind: "setup-py" });
      continue;
    }

    if (baseName === "setup.cfg") {
      manifests.push({ path: entry.repoRelativePath, kind: "setup-cfg" });
      continue;
    }

    if (REQUIREMENTS_PATTERN.test(baseName)) {
      manifests.push({ path: entry.repoRelativePath, kind: "requirements" });
      continue;
    }

    if (LOCKFILE_NAMES.has(baseName) || PYTHON_LOCKFILE_NAMES.has(baseName)) {
      manifests.push({ path: entry.repoRelativePath, kind: "lockfile" });
    }
  }

  return manifests;
}

export async function scanRepository(input: RepoInput): Promise<StructureScan> {
  const ignoreMatcher = await loadIgnoreRules(input.repo_root, input.exclude);
  const ignoredPaths = new Set<string>();
  const walkedEntries = await walkDirectoryStable(input.repo_root, {
    ignoreMatcher,
    followSymlinks: input.options.follow_symlinks,
    onIgnoredEntry(entry) {
      ignoredPaths.add(entry.repoRelativePath);
    },
  });
  const filteredEntries = walkedEntries.filter((entry) =>
    hasPathPrefix(entry.repoRelativePath, input.include),
  );

  const paths: StructurePath[] = filteredEntries.map((entry) => ({
    path: entry.repoRelativePath,
    kind: entry.kind,
    role: classifyPathRole(entry),
    size: entry.kind === "file" ? entry.size : 0,
    mtime: entry.mtimeMs,
  }));
  const fileCount = paths.filter((entry) => entry.kind === "file").length;
  const dirCount = paths.filter((entry) => entry.kind === "directory").length;

  if (fileCount > input.max_files) {
    throw new Error(
      `Scan exceeded max_files: found ${fileCount} files, limit is ${input.max_files}`,
    );
  }

  const packageJsonContent = await maybeReadPackageJson(input.repo_root);
  const pyprojectContent = await maybeReadPyproject(input.repo_root);
  const requirementsContent = await maybeReadRequirements(input.repo_root);
  const manifests = collectManifests(filteredEntries);

  const ecosystems: string[] = [];
  if (manifests.some((manifest) => manifest.kind === "package-json")) {
    ecosystems.push("node");
  }
  if (manifests.some((manifest) => ["pyproject", "setup-py", "setup-cfg", "requirements"].includes(manifest.kind))) {
    ecosystems.push("python");
  }

  const scan: StructureScan = {
    schema_version: "2.0",
    run_id: input.run_id,
    repo: {
      root: input.repo_root,
      file_count: fileCount,
      dir_count: dirCount,
    },
    detected: {
      languages: detectLanguages(filteredEntries),
      ecosystems,
      framework_hints: input.options.detect_frameworks
        ? detectFrameworkHints(filteredEntries, packageJsonContent, pyprojectContent, requirementsContent)
        : [],
      manifests,
    },
    paths,
    excluded_paths: [...ignoredPaths].sort(),
  };

  return validateContract(structureScanSchema, scan, "structureScan");
}

// Reproducibility metadata for Python repositories
export interface PythonReproducibilityMetadata {
  readonly python_version: string | undefined;
  readonly package_manager: "pip" | "poetry" | "pipenv" | "unknown";
  readonly has_lockfile: boolean;
  readonly lockfile_path: string | undefined;
  readonly virtual_env_path: string | undefined;
  readonly requirements_files: string[];
}

export function buildPythonReproducibilityMetadata(
  scan: StructureScan,
): PythonReproducibilityMetadata | undefined {
  const hasPython = scan.detected.ecosystems.includes("python");
  if (!hasPython) {
    return undefined;
  }

  const packageManager: PythonReproducibilityMetadata["package_manager"] =
    scan.detected.manifests.some((m) => m.kind === "pyproject" && scan.detected.framework_hints.includes("poetry"))
      ? "poetry"
      : scan.detected.manifests.some((m) => m.path === "Pipfile")
        ? "pipenv"
        : scan.detected.manifests.some((m) => m.kind === "requirements")
          ? "pip"
          : "unknown";

  const lockfile = scan.detected.manifests.find((m) => m.kind === "lockfile");
  const requirementsFiles = scan.detected.manifests
    .filter((m) => m.kind === "requirements")
    .map((m) => m.path);

  const venvPaths = scan.paths
    .filter((p) => p.kind === "directory" && (p.path === ".venv" || p.path === "venv" || p.path === "env"))
    .map((p) => p.path);

  return {
    python_version: undefined,
    package_manager: packageManager,
    has_lockfile: lockfile !== undefined,
    lockfile_path: lockfile?.path,
    virtual_env_path: venvPaths[0],
    requirements_files: requirementsFiles,
  };
}
