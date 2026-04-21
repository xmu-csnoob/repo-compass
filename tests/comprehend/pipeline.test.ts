import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildComprehension } from "../../src/comprehend/index.js";
import { extractSignals } from "../../src/extract/index.js";
import { normalizeRepoInput } from "../../src/input/index.js";
import { renderContextIndex, renderOnboarding, renderRepoMap } from "../../src/render/index.js";
import { scanRepository } from "../../src/scan/index.js";

function fixturePath(name: string): string {
  return path.resolve("tests/fixtures", name);
}

describe("phase 1 comprehension pipeline", () => {
  it("builds a repo map for the node CLI fixture", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-node-cli",
      repo_root: fixturePath("node-cli"),
      output_root: fixturePath("node-cli"),
      options: {
        emit_agent_views: true,
      },
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
    const contextIndex = renderContextIndex(comprehension);

    expect(contextIndex.repo.repo_shape).toBe("tool");
    expect(contextIndex.repo.framework_hints).toContain("node-cli");
    expect(contextIndex.entrypoints.some((item) => item.path === "src/index.ts")).toBe(true);
    expect(contextIndex.entrypoints.some((item) => item.path.startsWith("./"))).toBe(false);
    expect(contextIndex.entrypoints.some((item) => item.path === "dist/index.js")).toBe(false);
    expect(contextIndex.artifacts.commands.some((command) => command.name === "dev")).toBe(true);
    expect(contextIndex.key_paths.some((item) => item.path === "package.json")).toBe(true);
    expect(contextIndex.agent_hints.some((hint) => hint.kind === "run")).toBe(true);
  });

  it("renders onboarding and repo map for the nextjs fixture", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-nextjs",
      repo_root: fixturePath("nextjs-app"),
      output_root: fixturePath("nextjs-app"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
    const contextIndex = renderContextIndex(comprehension);

    const repoMap = renderRepoMap(contextIndex);
    const onboarding = renderOnboarding(contextIndex);

    expect(contextIndex.repo.framework_hints).toContain("nextjs");
    expect(repoMap).toContain("## Repo Snapshot");
    expect(repoMap).toContain("src/app/page.tsx");
    expect(onboarding).toContain("## Likely Entrypoints");
    expect(onboarding).toContain("## Defer For Now");
  });

  it("preserves ignored paths in published metadata", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-noisy",
      repo_root: fixturePath("noisy-repo"),
      output_root: fixturePath("noisy-repo"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
    const contextIndex = renderContextIndex(comprehension);

    expect(contextIndex.meta.excluded_paths).toEqual(
      expect.arrayContaining([".next", ".output", "coverage", "dist"]),
    );
  });
});
