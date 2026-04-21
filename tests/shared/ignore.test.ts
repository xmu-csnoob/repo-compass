import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_IGNORE_RULES, loadIgnoreRules } from "../../src/shared/ignore.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await import("node:fs/promises").then(({ rm }) =>
        rm(directory, { recursive: true, force: true }),
      );
    }),
  );
});

describe("ignore", () => {
  it("ships deterministic default ignore rules", () => {
    expect(DEFAULT_IGNORE_RULES).toContain(".git/");
    expect(DEFAULT_IGNORE_RULES).toContain("node_modules/");
  });

  it("loads .gitignore rules and explicit excludes", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-ignore-"));
    temporaryDirectories.push(repoRoot);

    await writeFile(
      path.join(repoRoot, ".gitignore"),
      ["dist/", "*.log", "!keep.log"].join("\n"),
      "utf8",
    );

    const matcher = await loadIgnoreRules(repoRoot, ["custom/"]);

    expect(matcher.isIgnored("dist", true)).toBe(true);
    expect(matcher.isIgnored("server.log", false)).toBe(true);
    expect(matcher.isIgnored("keep.log", false)).toBe(false);
    expect(matcher.isIgnored("custom", true)).toBe(true);
  });

  it("matches basename-only rules at any depth", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-ignore-"));
    temporaryDirectories.push(repoRoot);

    await writeFile(path.join(repoRoot, ".repo-compassignore"), "coverage/\n", "utf8");

    const matcher = await loadIgnoreRules(repoRoot);

    expect(matcher.isIgnored("coverage", true)).toBe(true);
    expect(matcher.isIgnored("packages/web/coverage", true)).toBe(true);
  });

  it("supports rooted ignore rules", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-ignore-"));
    temporaryDirectories.push(repoRoot);

    await writeFile(
      path.join(repoRoot, ".gitignore"),
      ["/dist", "/coverage/**", "!/coverage/keep.txt"].join("\n"),
      "utf8",
    );

    const matcher = await loadIgnoreRules(repoRoot);

    expect(matcher.isIgnored("dist", true)).toBe(true);
    expect(matcher.isIgnored("coverage/reports/out.txt", false)).toBe(true);
    expect(matcher.isIgnored("coverage/keep.txt", false)).toBe(false);
  });
});
