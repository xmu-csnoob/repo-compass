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

  it("noisy-python: key_paths exclude virtualenv, cache, build, dist, and migration paths", async () => {
    const { comprehension } = await runFullPipeline("noisy-python");
    const keyPathSet = new Set(comprehension.key_paths.map((k) => k.path));

    for (const noisy of [
      ".venv",
      ".venv/bin/python",
      ".venv/pyvenv.cfg",
      "__pycache__",
      "__pycache__/pipeline_cache.pyc",
      "build",
      "build/dist",
      "dist",
      "migrations",
      "migrations/001_initial.py",
    ]) {
      expect(keyPathSet.has(noisy)).toBe(false);
    }
  });

  it("noisy-python: defer_for_now includes generated and low-signal paths", async () => {
    const { comprehension } = await runFullPipeline("noisy-python");
    const deferPaths = comprehension.defer_for_now.map((d) => d.path);

    expect(deferPaths).toContain("src/noisy_repo/generated/__init__.py");
    expect(deferPaths).toContain("src/noisy_repo/generated/output.py");
  });

  it("python-fastapi: key_paths exclude test infrastructure paths", async () => {
    const { comprehension } = await runFullPipeline("python-fastapi");
    const keyPathSet = new Set(comprehension.key_paths.map((k) => k.path));

    expect(keyPathSet.has("tests/conftest.py")).toBe(false);
    expect(keyPathSet.has("tests/test_api.py")).toBe(false);
  });

  it("python-django: key_paths contain manage.py as entry but not migrations", async () => {
    const { comprehension } = await runFullPipeline("python-django");
    const keyPathSet = new Set(comprehension.key_paths.map((k) => k.path));

    expect(keyPathSet.has("manage.py")).toBe(true);
  });

  it("mixed-python-js: detects both Python and JavaScript/TypeScript ecosystems", async () => {
    const { comprehension } = await runFullPipeline("mixed-python-js");

    expect(comprehension.repo.detected_ecosystems).toContain("python");
    expect(comprehension.repo.detected_ecosystems).toContain("node");
  });

  it("mixed-python-js: key_paths include both pyproject.toml and package.json manifests", async () => {
    const { comprehension } = await runFullPipeline("mixed-python-js");
    const keyPaths = comprehension.key_paths.map((k) => k.path);

    expect(keyPaths).toContain("pyproject.toml");
    expect(keyPaths).toContain("package.json");
  });
});
