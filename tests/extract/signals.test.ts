import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { extractSignals } from "../../src/extract/index.js";
import { normalizeRepoInput } from "../../src/input/index.js";
import { scanRepository } from "../../src/scan/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("extractSignals", () => {
  it("preserves import edge kinds in files that also contain require calls", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-extract-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"));
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({
        name: "mixed-imports",
        version: "1.0.0",
        scripts: {
          dev: "node src/app.js",
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "src", "app.js"),
      [
        'import "./routes.js";',
        'const helper = require("./helper.js");',
        "void helper;",
      ].join("\n"),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "src", "routes.js"), "export const router = true;\n", "utf8");
    await writeFile(path.join(repoRoot, "src", "helper.js"), "module.exports = {};\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-extract-mixed",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);

    expect(
      signals.edges.some(
        (edge) =>
          edge.from === "src/app.js" &&
          edge.to === "src/routes.js" &&
          edge.kind === "import",
      ),
    ).toBe(true);
    expect(
      signals.edges.some(
        (edge) =>
          edge.from === "src/app.js" &&
          edge.to === "src/helper.js" &&
          edge.kind === "require",
      ),
    ).toBe(true);
  });
});
