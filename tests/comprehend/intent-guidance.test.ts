import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildIntentMap } from "../../src/classify/index.js";
import { buildComprehension } from "../../src/comprehend/index.js";
import { extractSignals } from "../../src/extract/index.js";
import { normalizeRepoInput } from "../../src/input/index.js";
import { scanRepository } from "../../src/scan/index.js";

const tempDirectories: string[] = [];

async function makeLibraryWithDocsFixture(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-intent-guidance-"));
  tempDirectories.push(repoRoot);

  await mkdir(path.join(repoRoot, "fastapi"), { recursive: true });
  await mkdir(path.join(repoRoot, "docs_src", "additional_responses"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "pyproject.toml"),
    [
      "[project]",
      'name = "fastapi"',
      'version = "0.1.0"',
      "",
      "[project.scripts]",
      'fastapi = "fastapi.cli:main"',
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(path.join(repoRoot, "fastapi", "__init__.py"), "__all__ = ['FastAPI']\n", "utf8");
  await writeFile(
    path.join(repoRoot, "fastapi", "__main__.py"),
    "from .cli import main\n\nif __name__ == '__main__':\n    main()\n",
    "utf8",
  );
  await writeFile(
    path.join(repoRoot, "fastapi", "cli.py"),
    "def main():\n    print('fastapi cli')\n\nif __name__ == '__main__':\n    main()\n",
    "utf8",
  );
  await writeFile(
    path.join(repoRoot, "fastapi", "applications.py"),
    "from fastapi import FastAPI\n\napp = FastAPI()\n",
    "utf8",
  );
  await writeFile(path.join(repoRoot, "docs_src", "additional_responses", "__init__.py"), "", "utf8");
  await writeFile(
    path.join(repoRoot, "docs_src", "additional_responses", "tutorial001.py"),
    "from fastapi import FastAPI\n\napp = FastAPI()\n",
    "utf8",
  );

  return repoRoot;
}

async function runFullPipeline(repoRoot: string) {
  const input = normalizeRepoInput({
    schema_version: "2.0",
    run_id: "test-intent-guidance",
    repo_root: repoRoot,
    output_root: repoRoot,
  });
  const scan = await scanRepository(input);
  const intentMap = await buildIntentMap(scan);
  const signals = await extractSignals(scan, intentMap);
  const comprehension = buildComprehension(input, scan, signals, undefined, intentMap);

  return { comprehension };
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("intent-aware comprehension guidance", () => {
  it("prefers module CLI guidance for library repos with a top-level package", async () => {
    const repoRoot = await makeLibraryWithDocsFixture();
    const { comprehension } = await runFullPipeline(repoRoot);

    expect(
      comprehension.agent_hints.some(
        (hint) =>
          hint.kind === "run" &&
          hint.text === "Use python -m fastapi to run the CLI." &&
          hint.evidence.includes("fastapi/__main__.py"),
      ),
    ).toBe(true);

    expect(
      comprehension.agent_hints.some(
        (hint) =>
          hint.kind === "run" &&
          hint.text.includes("Use python fastapi/applications.py to run the application."),
      ),
    ).toBe(false);
  });

  it("prefers the library surface over docs_src for safe early edit guidance", async () => {
    const repoRoot = await makeLibraryWithDocsFixture();
    const { comprehension } = await runFullPipeline(repoRoot);

    const safeEditHint = comprehension.agent_hints.find((hint) => hint.kind === "safe-edit-zone");
    expect(safeEditHint?.text).toContain("Prefer edits under fastapi");
    expect(safeEditHint?.text).not.toContain("docs_src");
    expect(safeEditHint?.evidence).toEqual(["fastapi"]);
  });
});
