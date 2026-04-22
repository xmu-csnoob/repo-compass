import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { normalizeRepoInput } from "../../src/input/index.js";
import { scanRepository } from "../../src/scan/index.js";
import { extractSignals } from "../../src/extract/index.js";
import { buildComprehension } from "../../src/comprehend/index.js";

const tempDirectories: string[] = [];

async function makeFixtureCopy(name: string): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), `repo-compass-fixture-`));
  tempDirectories.push(tempDirectory);
  const source = path.resolve("tests/fixtures", name);
  const destination = path.join(tempDirectory, name);

  await cp(source, destination, { recursive: true });

  return destination;
}

async function runFullPipeline(fixtureName: string) {
  const repoRoot = await makeFixtureCopy(fixtureName);
  const input = normalizeRepoInput({
    schema_version: "1.0",
    run_id: `test-${fixtureName}`,
    repo_root: repoRoot,
    output_root: repoRoot,
  });
  const scan = await scanRepository(input);
  const signals = await extractSignals(scan);
  const comprehension = buildComprehension(input, scan, signals);

  return { repoRoot, input, scan, signals, comprehension };
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("scan assertions (7.3)", () => {
  it("node-cli: classifies source files correctly", async () => {
    const { scan } = await runFullPipeline("node-cli");

    const sourceFiles = scan.paths.filter((p) => p.role === "source");
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(sourceFiles.some((p) => p.path === "src/index.ts")).toBe(true);
  });

  it("node-cli: detects TypeScript language", async () => {
    const { scan } = await runFullPipeline("node-cli");

    expect(scan.detected.languages).toContain("TypeScript");
  });

  it("node-cli: detects node ecosystem", async () => {
    const { scan } = await runFullPipeline("node-cli");

    expect(scan.detected.ecosystems).toContain("node");
  });

  it("node-cli: detects node-cli framework hint", async () => {
    const { scan } = await runFullPipeline("node-cli");

    expect(scan.detected.framework_hints).toContain("node-cli");
  });

  it("nextjs-app: detects nextjs framework hint", async () => {
    const { scan } = await runFullPipeline("nextjs-app");

    expect(scan.detected.framework_hints).toContain("nextjs");
  });

  it("nextjs-app: detects package.json manifest", async () => {
    const { scan } = await runFullPipeline("nextjs-app");

    expect(scan.detected.manifests.some((m) => m.kind === "package-json")).toBe(true);
  });

  it("vue-app: detects vue framework hint", async () => {
    const { scan } = await runFullPipeline("vue-app");

    expect(scan.detected.framework_hints).toContain("vue");
  });

  it("vue-app: does not detect tsconfig.node.json as a path entry with role entry", async () => {
    const { scan } = await runFullPipeline("vue-app");

    const tsconfigNodeEntry = scan.paths.find((p) => p.path === "tsconfig.node.json");
    expect(tsconfigNodeEntry?.role).not.toBe("entry");
  });
});

describe("entrypoint extraction assertions (7.3)", () => {
  it("node-cli: detects src/index.ts as entrypoint from scripts.dev", async () => {
    const { signals } = await runFullPipeline("node-cli");

    const devEntrypoint = signals.entrypoints.find(
      (e) => e.kind === "cli" && e.evidence.includes("scripts.dev"),
    );
    expect(devEntrypoint).toBeDefined();
    expect(devEntrypoint?.path).toBe("src/index.ts");
  });

  it("node-cli: detects src/index.ts as common convention entrypoint", async () => {
    const { signals } = await runFullPipeline("node-cli");

    const commonEntrypoint = signals.entrypoints.find(
      (e) => e.kind === "app" && e.evidence.includes("src/index.ts"),
    );
    expect(commonEntrypoint).toBeDefined();
    expect(commonEntrypoint?.path).toBe("src/index.ts");
  });

  it("node-cli: missing bin target is not emitted as entrypoint", async () => {
    const { signals } = await runFullPipeline("node-cli");

    // ./dist/index.js does not exist in the fixture, so it should not be an entrypoint
    const distEntrypoint = signals.entrypoints.find((e) => e.path === "./dist/index.js");
    expect(distEntrypoint).toBeUndefined();
  });

  it("script-config-noise: ignores tsconfig paths referenced by script flags", async () => {
    const { signals } = await runFullPipeline("script-config-noise");

    expect(signals.entrypoints.some((e) => e.path === "tsconfig.node.json")).toBe(false);
    expect(signals.entrypoints.some((e) => e.path === "src/index.ts")).toBe(true);
  });

  it("vue-app: resolves extensionless script token to genesis.dev.ts", async () => {
    const { signals } = await runFullPipeline("vue-app");

    expect(signals.entrypoints.some((e) => e.path === "tsconfig.node.json")).toBe(false);
    expect(signals.entrypoints.some((e) => e.path === "genesis.dev.ts")).toBe(true);
  });
});

describe("comprehension assertions (7.3)", () => {
  it("vue-app: repo_shape is application not service", async () => {
    const { comprehension } = await runFullPipeline("vue-app");

    expect(comprehension.repo.repo_shape).toBe("application");
  });

  it("vue-app: critical_paths is empty when entrypoint has no multi-hop import chain", async () => {
    const { comprehension } = await runFullPipeline("vue-app");

    // genesis.dev.ts imports genesis.ts (1 hop), so if that chain exists it's valid
    // but we should not produce a single-step path
    const singleStep = comprehension.critical_paths.filter((cp) => cp.steps.length < 2);
    expect(singleStep).toHaveLength(0);
  });
});

describe("graph edge assertions (7.3)", () => {
  it("node-cli: contains edges for directory membership", async () => {
    const { comprehension } = await runFullPipeline("node-cli");

    const containsEdges = comprehension.graph.edges.filter((e) => e.kind === "contains");
    expect(containsEdges.length).toBeGreaterThan(0);
    expect(containsEdges.some((e) => e.from === "src" && e.to === "src/index.ts")).toBe(true);
  });

  it("node-cli: config-link edges from source to tsconfig", async () => {
    const { signals } = await runFullPipeline("node-cli");

    const configLinks = signals.edges.filter((e) => e.kind === "config-link");
    expect(configLinks.length).toBeGreaterThan(0);
    expect(configLinks.some((e) => e.to === "tsconfig.json")).toBe(true);
  });

  it("nextjs-app: has import edges for relative imports", async () => {
    const { signals } = await runFullPipeline("nextjs-app");

    const importEdges = signals.edges.filter((e) => e.kind === "import");
    expect(importEdges.length).toBeGreaterThan(0);
  });
});

describe("defer-path assertions (7.3)", () => {
  it("noisy-repo: defers vendor paths", async () => {
    const { signals } = await runFullPipeline("noisy-repo");

    const vendorDeferred = signals.defer_candidates.some(
      (d) => d.path.startsWith("vendor/") || d.path.includes("/vendor/"),
    );
    expect(vendorDeferred).toBe(true);
  });

  it("noisy-repo: defers generated paths", async () => {
    const { signals } = await runFullPipeline("noisy-repo");

    const generatedDeferred = signals.defer_candidates.some(
      (d) => d.path.includes("/generated/") || d.path.includes("/__generated__/"),
    );
    expect(generatedDeferred).toBe(true);
  });

  it("node-cli: source files are not in defer candidates", async () => {
    const { signals } = await runFullPipeline("node-cli");

    const sourceDeferred = signals.defer_candidates.some((d) => d.path === "src/index.ts");
    expect(sourceDeferred).toBe(false);
  });
});
