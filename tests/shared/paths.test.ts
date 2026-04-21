import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isWithinRoot,
  normalizeAbsolutePath,
  normalizeRepoRelativePath,
  resolveRepoRelativePath,
  stablePathCompare,
  toRepoRelativePath,
} from "../../src/shared/paths.js";

describe("paths", () => {
  it("normalizes repo-relative paths to posix form", () => {
    expect(normalizeRepoRelativePath("src\\contracts\\schemas.ts")).toBe(
      "src/contracts/schemas.ts",
    );
    expect(normalizeRepoRelativePath("./src/index.ts")).toBe("src/index.ts");
  });

  it("rejects repo-relative paths that escape root", () => {
    expect(() => normalizeRepoRelativePath("../secrets.txt")).toThrow(
      /escapes the repository root/u,
    );
  });

  it("converts absolute paths back to repo-relative paths", () => {
    const repoRoot = normalizeAbsolutePath("/tmp/repo");
    const absolutePath = path.join(repoRoot, "src/contracts/schemas.ts");

    expect(toRepoRelativePath(repoRoot, absolutePath)).toBe(
      "src/contracts/schemas.ts",
    );
  });

  it("resolves repo-relative paths inside the repo root", () => {
    const repoRoot = normalizeAbsolutePath("/tmp/repo");

    expect(resolveRepoRelativePath(repoRoot, "src/index.ts")).toBe(
      `${repoRoot}/src/index.ts`,
    );
  });

  it("checks root containment", () => {
    expect(isWithinRoot("/tmp/repo", "/tmp/repo/src/index.ts")).toBe(true);
    expect(isWithinRoot("/tmp/repo", "/tmp/other/index.ts")).toBe(false);
  });

  it("sorts paths deterministically", () => {
    const values = ["src/z.ts", "src/a.ts", "docs/spec.md"];

    values.sort(stablePathCompare);

    expect(values).toEqual(["docs/spec.md", "src/a.ts", "src/z.ts"]);
  });
});
