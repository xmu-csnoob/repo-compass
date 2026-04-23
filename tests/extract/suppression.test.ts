import { mkdtemp, mkdir, writeFile, rm, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildIntentMap } from "../../src/classify/index.js";
import { extractSignals } from "../../src/extract/index.js";
import { normalizeRepoInput } from "../../src/input/index.js";
import { scanRepository } from "../../src/scan/index.js";

import type { IntentMap } from "../../src/contracts/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIntentMap(entries: IntentMap["entries"]): IntentMap {
  return {
    schema_version: "2.0",
    run_id: "run-suppression-test",
    entries,
  };
}

// ---------------------------------------------------------------------------
// Fixture / test suppression
// ---------------------------------------------------------------------------

describe("extractSignals - Python entrypoint suppression", () => {
  it("suppresses common Python entrypoints in example-fixtures directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-suppress-examples-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "examples"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "suppress-examples", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "examples", "main.py"), "print('example')\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-suppress-examples",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "examples",
        depth: 1,
        intent: "example-fixtures",
        confidence: "high",
        reason: "example directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "examples/main.py")).toBe(false);
  });

  it("suppresses common Python entrypoints in test-infrastructure directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-suppress-tests-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "tests"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "suppress-tests", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "tests", "main.py"), "print('test')\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-suppress-tests",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "tests",
        depth: 1,
        intent: "test-infrastructure",
        confidence: "high",
        reason: "test directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "tests/main.py")).toBe(false);
  });

  it("preserves common Python entrypoints in core-source directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-preserve-source-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "preserve-source", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "src", "main.py"), "print('source')\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-preserve-source",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "src",
        depth: 1,
        intent: "core-source",
        confidence: "medium",
        reason: "source directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "src/main.py")).toBe(true);
  });

  it("suppresses content-inferred Python entrypoints in example-fixtures directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-suppress-content-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "examples"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "suppress-content", version: "1.0.0" }),
      "utf8",
    );
    // This file has a main guard that would normally trigger content-based entrypoint detection
    await writeFile(
      path.join(repoRoot, "examples", "script.py"),
      "if __name__ == '__main__':\n    print('hello')\n",
      "utf8",
    );

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-suppress-content",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "examples",
        depth: 1,
        intent: "example-fixtures",
        confidence: "high",
        reason: "example directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "examples/script.py")).toBe(false);
  });

  it("suppresses content-inferred Python entrypoints in test-infrastructure directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-suppress-test-content-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "tests"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "suppress-test-content", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "tests", "script.py"),
      "if __name__ == '__main__':\n    print('hello')\n",
      "utf8",
    );

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-suppress-test-content",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "tests",
        depth: 1,
        intent: "test-infrastructure",
        confidence: "high",
        reason: "test directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "tests/script.py")).toBe(false);
  });

  it("preserves content-inferred Python entrypoints in core-source directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-preserve-content-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "preserve-content", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "src", "script.py"),
      "if __name__ == '__main__':\n    print('hello')\n",
      "utf8",
    );

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-preserve-content",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "src",
        depth: 1,
        intent: "core-source",
        confidence: "medium",
        reason: "source directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "src/script.py")).toBe(true);
  });

  it("suppresses __init__.py library entrypoints in example-fixtures directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-suppress-init-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "examples", "pkg"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "suppress-init", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "examples", "pkg", "__init__.py"), "# pkg\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-suppress-init",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "examples",
        depth: 1,
        intent: "example-fixtures",
        confidence: "high",
        reason: "example directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "examples/pkg/__init__.py")).toBe(false);
  });

  it("suppresses __init__.py library entrypoints in test-infrastructure directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-suppress-test-init-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "tests", "pkg"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "suppress-test-init", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "tests", "pkg", "__init__.py"), "# pkg\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-suppress-test-init",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "tests",
        depth: 1,
        intent: "test-infrastructure",
        confidence: "high",
        reason: "test directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "tests/pkg/__init__.py")).toBe(false);
  });

  it("preserves __init__.py library entrypoints in core-source directories", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-preserve-init-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src", "pkg"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "preserve-init", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "src", "pkg", "__init__.py"), "# pkg\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-preserve-init",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    const intentMap = makeIntentMap([
      {
        path: "src",
        depth: 1,
        intent: "core-source",
        confidence: "medium",
        reason: "source directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    expect(signals.entrypoints.some((ep) => ep.path === "src/pkg/__init__.py")).toBe(true);
  });

  it("does not suppress anything when no IntentMap is provided", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-no-suppress-"));
    temporaryDirectories.push(repoRoot);

    // Use root-level main.py (which is in PYTHON_COMMON_ENTRYPOINTS)
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "no-suppress", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "main.py"), "print('app')\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-no-suppress",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    // No intentMap provided
    const signals = await extractSignals(scan);

    // Without IntentMap, suppression is disabled and main.py should be detected
    expect(signals.entrypoints.some((ep) => ep.path === "main.py")).toBe(true);
  });

  it("suppresses nested example directories via intent inheritance", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-inherit-suppress-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "examples", "subpkg"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "inherit-suppress", version: "1.0.0" }),
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "examples", "subpkg", "script.py"),
      "if __name__ == '__main__':\n    print('hello')\n",
      "utf8",
    );

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-inherit-suppress",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);

    // Only the parent directory is classified; the child inherits via resolver
    const intentMap = makeIntentMap([
      {
        path: "examples",
        depth: 1,
        intent: "example-fixtures",
        confidence: "high",
        reason: "example directory",
        method: "static",
      },
    ]);

    const signals = await extractSignals(scan, intentMap);

    // examples/subpkg/script.py should be suppressed because it resolves to
    // the nearest classified ancestor (examples) which is example-fixtures
    expect(signals.entrypoints.some((ep) => ep.path === "examples/subpkg/script.py")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Real fixture integration tests (Epic 5.2 / 5.3)
// ---------------------------------------------------------------------------

async function makeFixtureCopy(name: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `repo-compass-extract-fixture-`));
  const source = path.resolve(path.join(__dirname, "..", "fixtures"), name);
  const dest = path.join(tempDir, name);
  await cp(source, dest, { recursive: true });
  const cleanup = async () => {
    await rm(tempDir, { recursive: true, force: true });
  };
  return { path: dest, cleanup };
}

describe("extractSignals - real fixture validation (Epic 5.2)", () => {
  it("python-fastapi: app/main.py is detected as server entrypoint", async () => {
    const { path: repoRoot, cleanup } = await makeFixtureCopy("python-fastapi");
    temporaryDirectories.push(repoRoot);

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-fastapi-fixture",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const intentMap = await buildIntentMap(scan);
    const signals = await extractSignals(scan, intentMap);

    // app/main.py is a common Python entrypoint and should be detected
    const appMain = signals.entrypoints.find((ep) => ep.path === "app/main.py");
    expect(appMain).toBeDefined();
    expect(appMain!.kind).toBe("server");
  });

  it("python-fastapi: tests/ directory Python files are not surfaced as entrypoints", async () => {
    const { path: repoRoot, cleanup } = await makeFixtureCopy("python-fastapi");
    temporaryDirectories.push(repoRoot);

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-fastapi-fixture",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const intentMap = await buildIntentMap(scan);
    const signals = await extractSignals(scan, intentMap);

    // No entrypoints should be inside the tests/ directory
    const testEntrypoints = signals.entrypoints.filter((ep) => ep.path.startsWith("tests/"));
    expect(testEntrypoints).toHaveLength(0);
  });
});

describe("extractSignals - structurally different fixture (Epic 5.3)", () => {
  it("python-flask: app.py is detected as server entrypoint", async () => {
    const { path: repoRoot, cleanup } = await makeFixtureCopy("python-flask");
    temporaryDirectories.push(repoRoot);

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-flask-fixture",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const intentMap = await buildIntentMap(scan);
    const signals = await extractSignals(scan, intentMap);

    // app.py at root is a common Python entrypoint and should be detected
    const flaskApp = signals.entrypoints.find((ep) => ep.path === "app.py");
    expect(flaskApp).toBeDefined();
    expect(flaskApp!.kind).toBe("server");
  });

  it("python-flask: tests/ directory is not surfaced as entrypoints", async () => {
    const { path: repoRoot, cleanup } = await makeFixtureCopy("python-flask");
    temporaryDirectories.push(repoRoot);

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-flask-fixture",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const intentMap = await buildIntentMap(scan);
    const signals = await extractSignals(scan, intentMap);

    // No entrypoints should be inside the tests/ directory
    const testEntrypoints = signals.entrypoints.filter((ep) => ep.path.startsWith("tests/"));
    expect(testEntrypoints).toHaveLength(0);
  });
});
