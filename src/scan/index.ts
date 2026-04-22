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
    baseName === "setupTests.ts"
  ) {
    return "tests";
  }

  if (
    CONFIG_FILENAMES.includes(baseName) ||
    baseName.startsWith(".eslintrc") ||
    baseName.endsWith(".config.ts") ||
    baseName.endsWith(".config.js") ||
    baseName.endsWith(".config.mjs")
  ) {
    return "config";
  }

  if (
    entry.repoRelativePath.startsWith("vendor/") ||
    entry.repoRelativePath.includes("/vendor/")
  ) {
    return "vendor";
  }

  if (
    entry.repoRelativePath.startsWith(".next/") ||
    entry.repoRelativePath.startsWith(".output/") ||
    entry.repoRelativePath.startsWith("build/") ||
    entry.repoRelativePath.startsWith("dist/")
  ) {
    return "build";
  }

  if (
    entry.repoRelativePath.includes("/generated/") ||
    entry.repoRelativePath.includes("/__generated__/")
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
    /\.(?:[cm]?[jt]sx?)$/u.test(baseName)
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
    }
  }

  return [...found].sort();
}

function detectFrameworkHints(entries: readonly WalkEntry[], packageJsonContent?: string): string[] {
  const hints = new Set<string>();
  const allPaths = new Set(entries.map((entry) => entry.repoRelativePath));
  const packageText = packageJsonContent ?? "";
  const hasVueFiles = entries.some((entry) => entry.repoRelativePath.endsWith(".vue"));

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

  // Library: has main or exports but no bin (and not already detected as app/service)
  if (
    !/"bin"\s*:/u.test(packageText) &&
    (/"main"\s*:/u.test(packageText) || /"exports"\s*:/u.test(packageText))
  ) {
    hints.add("library");
  }

  return [...hints];
}

async function maybeReadPackageJson(repoRoot: string): Promise<string | undefined> {
  const packageJsonPath = path.join(repoRoot, "package.json");

  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(packageJsonPath, "utf8");
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

    if (LOCKFILE_NAMES.has(baseName)) {
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
  }));
  const fileCount = paths.filter((entry) => entry.kind === "file").length;
  const dirCount = paths.filter((entry) => entry.kind === "directory").length;

  if (fileCount > input.max_files) {
    throw new Error(
      `Scan exceeded max_files: found ${fileCount} files, limit is ${input.max_files}`,
    );
  }

  const packageJsonContent = await maybeReadPackageJson(input.repo_root);
  const manifests = collectManifests(filteredEntries);

  const scan: StructureScan = {
    schema_version: "1.0",
    run_id: input.run_id,
    repo: {
      root: input.repo_root,
      file_count: fileCount,
      dir_count: dirCount,
    },
    detected: {
      languages: detectLanguages(filteredEntries),
      // Phase 1: Only Node ecosystem detection is implemented.
      // Python/pip, Rust/cargo, Go modules, etc. are known Phase 1 limitations.
      ecosystems: manifests.some((manifest) => manifest.kind === "package-json") ? ["node"] : [],
      framework_hints: input.options.detect_frameworks
        ? detectFrameworkHints(filteredEntries, packageJsonContent)
        : [],
      manifests,
    },
    paths,
    excluded_paths: [...ignoredPaths].sort(),
  };

  return validateContract(structureScanSchema, scan, "structureScan");
}
