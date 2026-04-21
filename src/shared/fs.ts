import {
  lstat,
  mkdir,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  isWithinRoot,
  normalizeAbsolutePath,
  normalizeRepoRelativePath,
  resolveRepoRelativePath,
  stablePathCompare,
  toRepoRelativePath,
} from "./paths.js";
import type { IgnoreMatcher } from "./ignore.js";

export type WalkEntry = {
  readonly absolutePath: string;
  readonly repoRelativePath: string;
  readonly kind: "file" | "directory";
  readonly size: number;
};

export type WalkDirectoryOptions = {
  readonly ignoreMatcher?: IgnoreMatcher;
  readonly followSymlinks?: boolean;
};

async function canonicalizeRepoRoot(repoRoot: string): Promise<string> {
  return normalizeAbsolutePath(await realpath(repoRoot));
}

async function ensureRealDirectory(directoryPath: string): Promise<void> {
  const directoryStat = await lstat(directoryPath);

  if (directoryStat.isSymbolicLink()) {
    throw new Error(`Refusing to use symlinked directory "${directoryPath}"`);
  }

  if (!directoryStat.isDirectory()) {
    throw new Error(`Expected directory at "${directoryPath}"`);
  }
}

async function ensureSafeDirectoryChain(
  repoRoot: string,
  relativeDirectoryPath: string,
): Promise<string> {
  const root = await canonicalizeRepoRoot(repoRoot);
  const normalizedRelativePath = normalizeRepoRelativePath(relativeDirectoryPath);

  await ensureRealDirectory(root);

  if (normalizedRelativePath === ".") {
    return root;
  }

  const parts = normalizedRelativePath.split("/");
  let currentPath = root;

  for (const part of parts) {
    currentPath = path.join(currentPath, part);
    await mkdir(currentPath, { recursive: true });
    await ensureRealDirectory(currentPath);
  }

  return currentPath;
}

export async function walkDirectoryStable(
  repoRoot: string,
  options: WalkDirectoryOptions = {},
): Promise<WalkEntry[]> {
  const root = await canonicalizeRepoRoot(repoRoot);
  const entries: WalkEntry[] = [];
  const queue = [root];
  const visitedDirectories = new Set<string>();

  while (queue.length > 0) {
    const currentDirectory = queue.shift();

    if (currentDirectory === undefined) {
      continue;
    }

    const currentDirectoryRealPath = normalizeAbsolutePath(
      await realpath(currentDirectory),
    );

    if (!isWithinRoot(root, currentDirectoryRealPath)) {
      continue;
    }

    if (visitedDirectories.has(currentDirectoryRealPath)) {
      continue;
    }

    visitedDirectories.add(currentDirectoryRealPath);

    const directoryEntries = await readdir(currentDirectory, {
      withFileTypes: true,
    });

    directoryEntries.sort((left, right) => stablePathCompare(left.name, right.name));

    for (const directoryEntry of directoryEntries) {
      const absolutePath = path.join(currentDirectory, directoryEntry.name);
      const repoRelativePath = toRepoRelativePath(root, absolutePath);
      const isDirectory = directoryEntry.isDirectory();

      if (options.ignoreMatcher?.isIgnored(repoRelativePath, isDirectory)) {
        continue;
      }

      if (directoryEntry.isSymbolicLink() && !options.followSymlinks) {
        continue;
      }

      if (directoryEntry.isSymbolicLink()) {
        const symlinkRealPath = normalizeAbsolutePath(await realpath(absolutePath));

        if (!isWithinRoot(root, symlinkRealPath)) {
          continue;
        }
      }

      const fileStat = await stat(absolutePath);

      if (fileStat.isDirectory()) {
        queue.push(absolutePath);
        entries.push({
          absolutePath: normalizeAbsolutePath(absolutePath),
          repoRelativePath,
          kind: "directory",
          size: 0,
        });
        continue;
      }

      if (fileStat.isFile()) {
        entries.push({
          absolutePath: normalizeAbsolutePath(absolutePath),
          repoRelativePath,
          kind: "file",
          size: fileStat.size,
        });
      }
    }

    queue.sort(stablePathCompare);
  }

  return entries.sort((left, right) =>
    stablePathCompare(left.repoRelativePath, right.repoRelativePath),
  );
}

async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
  const parentDirectory = path.dirname(targetPath);
  const temporaryPath = path.join(
    parentDirectory,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  await mkdir(parentDirectory, { recursive: true });

  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, targetPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function writeRunArtifact(
  repoRoot: string,
  runId: string,
  relativeArtifactPath: string,
  content: string,
): Promise<string> {
  const normalizedRunId = runId.trim();

  if (normalizedRunId === "") {
    throw new Error("runId must not be empty");
  }

  const artifactRelativePath = normalizeRepoRelativePath(
    path.posix.join("work", "runs", normalizedRunId, relativeArtifactPath),
  );
  const root = await canonicalizeRepoRoot(repoRoot);
  const artifactParentPath = path.posix.dirname(artifactRelativePath);
  const absoluteParentPath = await ensureSafeDirectoryChain(root, artifactParentPath);
  const absoluteArtifactPath = resolveRepoRelativePath(root, artifactRelativePath);

  try {
    const targetStat = await lstat(absoluteArtifactPath);

    if (targetStat.isSymbolicLink()) {
      throw new Error(`Refusing to overwrite symlinked artifact "${absoluteArtifactPath}"`);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      throw error;
    }
  }

  if (path.dirname(absoluteArtifactPath) !== absoluteParentPath) {
    throw new Error(`Artifact parent mismatch for "${absoluteArtifactPath}"`);
  }

  await writeFileAtomic(absoluteArtifactPath, content);

  return absoluteArtifactPath;
}

export async function writeRunJsonArtifact(
  repoRoot: string,
  runId: string,
  relativeArtifactPath: string,
  value: unknown,
): Promise<string> {
  const content = `${JSON.stringify(value, null, 2)}${os.EOL}`;

  return writeRunArtifact(repoRoot, runId, relativeArtifactPath, content);
}
