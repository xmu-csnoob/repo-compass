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
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), `repo-compass-confidence-`));
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
    run_id: `test-confidence-${fixtureName}`,
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

describe("confidence rules (7.5)", () => {
  it("every published entrypoint has non-empty evidence", async () => {
    const { comprehension } = await runFullPipeline("node-cli");

    for (const entrypoint of comprehension.entrypoints) {
      expect(entrypoint.evidence).toBeDefined();
      expect(entrypoint.evidence.length).toBeGreaterThan(0);
    }
  });

  it("every published key_path has non-empty evidence", async () => {
    const { comprehension } = await runFullPipeline("node-cli");

    for (const keyPath of comprehension.key_paths) {
      expect(keyPath.evidence).toBeDefined();
      expect(keyPath.evidence.length).toBeGreaterThan(0);
    }
  });

  it("every priority candidate has non-empty evidence", async () => {
    const { signals } = await runFullPipeline("node-cli");

    for (const candidate of signals.priority_candidates) {
      expect(candidate.evidence).toBeDefined();
      expect(candidate.evidence.length).toBeGreaterThan(0);
    }
  });

  it("every agent hint has non-empty evidence", async () => {
    const { comprehension } = await runFullPipeline("node-cli");

    for (const hint of comprehension.agent_hints) {
      expect(hint.evidence).toBeDefined();
      expect(hint.evidence.length).toBeGreaterThan(0);
    }
  });

  it("low-confidence content in agent_hints has reason and confidence", async () => {
    const { comprehension } = await runFullPipeline("node-cli");

    const lowConfidenceHints = comprehension.agent_hints.filter((h) => h.confidence === "low");
    for (const hint of lowConfidenceHints) {
      expect(hint.reason).toBeDefined();
      expect(hint.reason.length).toBeGreaterThan(0);
    }
  });
});
