import { cp, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { normalizeRepoInput } from "../../src/input/index.js";
import { scanRepository } from "../../src/scan/index.js";
import { extractSignals } from "../../src/extract/index.js";
import { buildComprehension } from "../../src/comprehend/index.js";

const tempDirectories: string[] = [];

async function makeFixtureCopy(name: string): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), `repo-compass-perf-`));
  tempDirectories.push(tempDirectory);
  const source = path.resolve("tests/fixtures", name);
  const destination = path.join(tempDirectory, name);

  await cp(source, destination, { recursive: true });

  return destination;
}

async function createSyntheticLargeRepo(fileCount: number): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), `repo-compass-large-`));
  tempDirectories.push(tempDirectory);

  await mkdir(path.join(tempDirectory, "src"), { recursive: true });
  await writeFile(
    path.join(tempDirectory, "package.json"),
    JSON.stringify({ name: "synthetic", version: "1.0.0" }),
    "utf8",
  );

  for (let i = 0; i < fileCount; i++) {
    const filePath = path.join(tempDirectory, "src", `file${i}.ts`);
    await writeFile(filePath, `export const value${i} = ${i};\n`, "utf8");
  }

  return tempDirectory;
}

async function runFullPipeline(repoRoot: string, runId: string) {
  const input = normalizeRepoInput({
    schema_version: "1.0",
    run_id: runId,
    repo_root: repoRoot,
    output_root: repoRoot,
  });
  const scan = await scanRepository(input);
  const signals = await extractSignals(scan);
  const comprehension = buildComprehension(input, scan, signals);

  return { input, scan, signals, comprehension };
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("performance baseline (7.6)", () => {
  // Phase 1 SLOs: 100 files < 1s, 1000 files < 5s, 10000 files < 30s
  // Using generous upper bounds with 2x factor for CI variance

  it("small repo (node-cli fixture) completes in under 2 seconds", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const start = Date.now();

    await runFullPipeline(repoRoot, "perf-small");

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  }, 10000);

  it("medium repo (nextjs-app fixture) completes in under 5 seconds", async () => {
    const repoRoot = await makeFixtureCopy("nextjs-app");
    const start = Date.now();

    await runFullPipeline(repoRoot, "perf-medium");

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  }, 15000);

  it("synthetic 100-file repo completes in under 2 seconds", async () => {
    const repoRoot = await createSyntheticLargeRepo(100);
    const start = Date.now();

    await runFullPipeline(repoRoot, "perf-100");

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  }, 10000);

  it("synthetic 1000-file repo completes in under 10 seconds", async () => {
    const repoRoot = await createSyntheticLargeRepo(1000);
    const start = Date.now();

    await runFullPipeline(repoRoot, "perf-1000");

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  }, 30000);
});
