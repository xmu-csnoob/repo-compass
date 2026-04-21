import path from "node:path";

function normalizeSeparators(value: string): string {
  return value.replaceAll("\\", "/");
}

function trimTrailingSlash(value: string): string {
  if (value === "/") {
    return value;
  }

  return value.replace(/\/+$/u, "");
}

export function normalizeRepoRelativePath(value: string): string {
  const normalized = trimTrailingSlash(normalizeSeparators(path.posix.normalize(normalizeSeparators(value))));

  if (normalized === "." || normalized === "") {
    return ".";
  }

  if (normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    throw new Error(`Path "${value}" escapes the repository root`);
  }

  return normalized;
}

export function normalizeAbsolutePath(value: string): string {
  return trimTrailingSlash(normalizeSeparators(path.resolve(value)));
}

export function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  const root = normalizeAbsolutePath(rootPath);
  const candidate = normalizeAbsolutePath(candidatePath);

  if (candidate === root) {
    return true;
  }

  return candidate.startsWith(`${root}/`);
}

export function toRepoRelativePath(repoRoot: string, absolutePath: string): string {
  const root = normalizeAbsolutePath(repoRoot);
  const candidate = normalizeAbsolutePath(absolutePath);

  if (!isWithinRoot(root, candidate)) {
    throw new Error(`Path "${absolutePath}" is outside repository root "${repoRoot}"`);
  }

  const relative = path.relative(root, candidate);

  return normalizeRepoRelativePath(relative);
}

export function resolveRepoRelativePath(repoRoot: string, relativePath: string): string {
  const root = normalizeAbsolutePath(repoRoot);
  const relative = normalizeRepoRelativePath(relativePath);
  const resolved = normalizeAbsolutePath(path.resolve(root, relative));

  if (!isWithinRoot(root, resolved)) {
    throw new Error(`Resolved path "${resolved}" escapes repository root "${repoRoot}"`);
  }

  return resolved;
}

export function stablePathCompare(left: string, right: string): number {
  return normalizeSeparators(left).localeCompare(normalizeSeparators(right), "en");
}
