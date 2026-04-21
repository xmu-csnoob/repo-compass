import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadIgnoreRules } from "../../src/shared/ignore.js";
import {
  walkDirectoryStable,
  writeRunArtifact,
  writeRunJsonArtifact,
} from "../../src/shared/fs.js";
import { normalizeAbsolutePath } from "../../src/shared/paths.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { recursive: true, force: true });
    }),
  );
});

describe("fs utilities", () => {
  it("walks directories in stable repo-relative order", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-walk-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"));
    await mkdir(path.join(repoRoot, "docs"));
    await writeFile(path.join(repoRoot, "src", "z.ts"), "", "utf8");
    await writeFile(path.join(repoRoot, "src", "a.ts"), "", "utf8");
    await writeFile(path.join(repoRoot, "docs", "readme.md"), "", "utf8");

    const entries = await walkDirectoryStable(repoRoot);

    expect(entries.map((entry) => entry.repoRelativePath)).toEqual([
      "docs",
      "docs/readme.md",
      "src",
      "src/a.ts",
      "src/z.ts",
    ]);
  });

  it("respects ignore rules while walking", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-walk-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "node_modules"));
    await mkdir(path.join(repoRoot, "src"));
    await writeFile(path.join(repoRoot, "node_modules", "left-pad.js"), "", "utf8");
    await writeFile(path.join(repoRoot, "src", "index.ts"), "", "utf8");

    const ignoreMatcher = await loadIgnoreRules(repoRoot);
    const entries = await walkDirectoryStable(repoRoot, { ignoreMatcher });

    expect(entries.map((entry) => entry.repoRelativePath)).toEqual([
      "src",
      "src/index.ts",
    ]);
  });

  it("writes run artifacts under work/runs/<run-id>", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-write-"));
    temporaryDirectories.push(repoRoot);

    const artifactPath = await writeRunArtifact(
      repoRoot,
      "run-123",
      "outputs/repo.map.md",
      "# repo map\n",
    );

    expect(artifactPath).toBe(
      normalizeAbsolutePath(
        await realpath(`${repoRoot}/work/runs/run-123/outputs/repo.map.md`),
      ),
    );
    await expect(readFile(artifactPath, "utf8")).resolves.toBe("# repo map\n");
  });

  it("writes JSON artifacts with a trailing newline", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-write-"));
    temporaryDirectories.push(repoRoot);

    const artifactPath = await writeRunJsonArtifact(
      repoRoot,
      "run-abc",
      "context-index.json",
      { schema_version: "1.0" },
    );

    await expect(readFile(artifactPath, "utf8")).resolves.toBe(
      '{\n  "schema_version": "1.0"\n}\n',
    );
  });

  it("does not follow symlinked directories outside the repo", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-walk-"));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-outside-"));
    temporaryDirectories.push(repoRoot, outsideRoot);

    await mkdir(path.join(repoRoot, "src"));
    await writeFile(path.join(outsideRoot, "secret.txt"), "secret", "utf8");
    await symlink(outsideRoot, path.join(repoRoot, "src", "outside"));

    const entries = await walkDirectoryStable(repoRoot, { followSymlinks: true });

    expect(entries.map((entry) => entry.repoRelativePath)).toEqual(["src"]);
  });

  it("refuses to write through symlinked work directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-write-"));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-outside-"));
    temporaryDirectories.push(repoRoot, outsideRoot);

    await symlink(outsideRoot, path.join(repoRoot, "work"));

    await expect(
      writeRunArtifact(repoRoot, "run-symlink", "outputs/repo.map.md", "# no\n"),
    ).rejects.toThrow(/symlinked directory/u);
  });
});
