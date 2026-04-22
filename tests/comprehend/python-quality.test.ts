import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildComprehension } from "../../src/comprehend/index.js";
import { extractSignals } from "../../src/extract/index.js";
import { normalizeRepoInput } from "../../src/input/index.js";
import { scanRepository } from "../../src/scan/index.js";

const tempDirectories: string[] = [];

async function makeFixtureCopy(name: string): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), `repo-compass-python-quality-`));
  tempDirectories.push(tempDirectory);
  const source = path.resolve("tests/fixtures", name);
  const destination = path.join(tempDirectory, name);

  await cp(source, destination, { recursive: true });

  return destination;
}

async function runFullPipeline(fixtureName: string) {
  const repoRoot = await makeFixtureCopy(fixtureName);
  const input = normalizeRepoInput({
    schema_version: "2.0",
    run_id: `test-python-quality-${fixtureName}`,
    repo_root: repoRoot,
    output_root: repoRoot,
  });
  const scan = await scanRepository(input);
  const signals = await extractSignals(scan);
  const comprehension = buildComprehension(input, scan, signals);

  return { scan, signals, comprehension };
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("python comprehension quality", () => {
  it("python-fastapi: first_read_path starts from the packaging manifest with a stable justification", async () => {
    const { comprehension } = await runFullPipeline("python-fastapi");

    expect(comprehension.first_read_path[0]).toMatchObject({
      path: "pyproject.toml",
      why_now: "Start here to understand workspace shape, scripts, and dependencies.",
      reason: "Manifest files anchor the repository's install and run workflows.",
      confidence: "high",
    });
  });

  it("node-cli: warning generation surfaces skipped bin entrypoints and republishes them in comprehension", async () => {
    const { signals, comprehension } = await runFullPipeline("node-cli");

    expect(signals.warnings).toContain(
      'Skipping bin entrypoint "./dist/index.js" because it is not present in the scanned snapshot.',
    );
    expect(comprehension.warnings).toContain(
      'Skipping bin entrypoint "./dist/index.js" because it is not present in the scanned snapshot.',
    );
  });
});
