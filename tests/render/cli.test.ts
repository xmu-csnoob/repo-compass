import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runPipeline } from "../../src/cli/index.js";

const tempDirectories: string[] = [];

async function makeFixtureCopy(name: string): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), `repo-compass-${name}-`));
  tempDirectories.push(tempDirectory);
  const source = path.resolve("tests/fixtures", name);
  const destination = path.join(tempDirectory, name);

  await cp(source, destination, { recursive: true });

  return destination;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CLI pipeline", () => {
  it("writes canonical and derived outputs", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const result = await runPipeline([repoRoot, "--debug"]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);

    await expect(readFile(path.join(runRoot, "context-index.json"), "utf8")).resolves.toContain('"schema_version": "2.0"');
    await expect(readFile(path.join(runRoot, "outputs", "repo.map.md"), "utf8")).resolves.toContain("# Repo Map");
    await expect(readFile(path.join(runRoot, "outputs", "ONBOARDING.md"), "utf8")).resolves.toContain("# ONBOARDING");
    await expect(readFile(path.join(runRoot, "scan.json"), "utf8")).resolves.toContain('"framework_hints"');
    await expect(readFile(path.join(runRoot, "signals.json"), "utf8")).resolves.toContain('"entrypoints"');
    await expect(readFile(path.join(runRoot, "comprehension.json"), "utf8")).resolves.toContain('"graph"');
  });

  it("emits the static agent view only when requested", async () => {
    const repoRoot = await makeFixtureCopy("node-cli");
    const result = await runPipeline([repoRoot, "--agent-views"]);
    const runRoot = path.join(repoRoot, "work", "runs", result.runId);

    await expect(readFile(path.join(runRoot, "outputs", "agent-context.md"), "utf8")).resolves.toContain("# Agent Context");
  });
});
