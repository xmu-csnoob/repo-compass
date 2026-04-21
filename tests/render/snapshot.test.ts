import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runPipeline } from "../../src/cli/index.js";

const tempDirectories: string[] = [];

async function makeFixtureCopy(name: string): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), `repo-compass-snapshot-`));
  tempDirectories.push(tempDirectory);
  const source = path.resolve("tests/fixtures", name);
  const destination = path.join(tempDirectory, name);

  await cp(source, destination, { recursive: true });

  return destination;
}

function normalizeContextIndex(content: string, runId: string): string {
  let normalized = content
    .replace(/"root":\s*"[^"]*"/g, `"root": "<FIXTURE_ROOT>"`)
    .replace(/"run_id":\s*"[^"]*"/g, `"run_id": "<RUN_ID>"`)
    .replace(/"snapshot_id":\s*"[^"]*"/g, `"snapshot_id": "<RUN_ID>"`)
    .replace(/"generated_at":\s*"[^"]*"/g, `"generated_at": "<GENERATED_AT>"`);
  return normalized;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("renderer snapshots (7.4)", () => {
  it("repo.map.md matches golden snapshot", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const result = await runPipeline([repoRoot]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);
    const actual = await readFile(path.join(runRoot, "outputs", "repo.map.md"), "utf8");
    const golden = await readFile(path.resolve("tests/render/snapshots/repo.map.md"), "utf8");

    expect(actual).toBe(golden);
  });

  it("ONBOARDING.md matches golden snapshot", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const result = await runPipeline([repoRoot]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);
    const actual = await readFile(path.join(runRoot, "outputs", "ONBOARDING.md"), "utf8");
    const golden = await readFile(path.resolve("tests/render/snapshots/ONBOARDING.md"), "utf8");

    expect(actual).toBe(golden);
  });

  it("context-index.json matches golden snapshot", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const result = await runPipeline([repoRoot]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);
    const actualRaw = await readFile(path.join(runRoot, "context-index.json"), "utf8");
    const actual = normalizeContextIndex(actualRaw, result.runId);
    const golden = await readFile(path.resolve("tests/render/snapshots/context-index.json"), "utf8");

    expect(actual).toBe(golden);
  });
});
