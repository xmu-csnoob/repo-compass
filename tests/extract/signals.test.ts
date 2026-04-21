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

  it("creates test-of edges for test files targeting source files", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-testof-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(path.join(repoRoot, "src", "math.js"), "export const add = (a, b) => a + b;\n", "utf8");
    await writeFile(path.join(repoRoot, "src", "math.test.js"), "import { add } from './math.js';\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-extract-testof",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);

    expect(
      signals.edges.some(
        (edge) =>
          edge.from === "src/math.test.js" &&
          edge.to === "src/math.js" &&
          edge.kind === "test-of",
      ),
    ).toBe(true);
  });

  it("creates config-link edges from source files to their tsconfig", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-configlink-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(path.join(repoRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }), "utf8");
    await writeFile(path.join(repoRoot, "src", "app.ts"), "export const app = true;\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-extract-configlink",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);

    expect(
      signals.edges.some(
        (edge) =>
          edge.from === "src/app.ts" &&
          edge.to === "tsconfig.json" &&
          edge.kind === "config-link",
      ),
    ).toBe(true);
  });

  it("creates reference edges for TypeScript triple-slash directives", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-ref-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "src", "types.d.ts"),
      "declare module 'foo';\n",
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "src", "app.ts"),
      [
        '/// <reference path="./types.d.ts" />',
        "export const app = true;",
      ].join("\n"),
      "utf8",
    );

    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-extract-ref",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);

    expect(
      signals.edges.some(
        (edge) =>
          edge.from === "src/app.ts" &&
          edge.to === "src/types.d.ts" &&
          edge.kind === "reference",
      ),
    ).toBe(true);
  });

  it("creates route edges for Next.js App Router route handler files", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-route-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "app/api/hello"), { recursive: true });
    await writeFile(path.join(repoRoot, "app/api/hello/route.ts"), "export function GET() {}", "utf8");

    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-extract-route",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);

    expect(
      signals.edges.some(
        (edge) =>
          edge.from === "app/api/hello/route.ts" &&
          edge.to === "app/api/hello" &&
          edge.kind === "route",
      ),
    ).toBe(true);
  });
});
