import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
      schema_version: "2.0",
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
      schema_version: "2.0",
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
      schema_version: "2.0",
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
      schema_version: "2.0",
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
      schema_version: "2.0",
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

  it("adds Vue entry conventions as entrypoints when Vue signals are present", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-vue-entry-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({
        name: "vue-entry-fixture",
        version: "1.0.0",
        dependencies: {
          vue: "^3.0.0",
        },
      }),
      "utf8",
    );
    await writeFile(path.join(repoRoot, "src", "app.vue"), "<template><div/></template>\n", "utf8");
    await writeFile(path.join(repoRoot, "src", "entry-client.ts"), "export const client = true;\n", "utf8");
    await writeFile(path.join(repoRoot, "src", "entry-server.ts"), "export const server = true;\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-extract-vue-entry",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);

    expect(signals.entrypoints.some((entrypoint) => entrypoint.path === "src/entry-client.ts")).toBe(true);
    expect(signals.entrypoints.some((entrypoint) => entrypoint.path === "src/entry-server.ts")).toBe(true);
  });

  it("marks infra and editor paths as defer candidates", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-defer-infra-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, ".vscode"), { recursive: true });
    await mkdir(path.join(repoRoot, ".github", "workflows"), { recursive: true });
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(path.join(repoRoot, "package.json"), JSON.stringify({ name: "defer-fixture", version: "1.0.0" }), "utf8");
    await writeFile(path.join(repoRoot, "src", "index.ts"), "export const ok = true;\n", "utf8");
    await writeFile(path.join(repoRoot, ".vscode", "settings.json"), "{}\n", "utf8");
    await writeFile(path.join(repoRoot, ".github", "workflows", "ci.yml"), "name: ci\n", "utf8");
    await writeFile(path.join(repoRoot, "Dockerfile"), "FROM node:20\n", "utf8");
    await writeFile(path.join(repoRoot, "docker-build.sh"), "#!/bin/sh\n", "utf8");

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-extract-defer-infra",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);

    expect(signals.defer_candidates.some((item) => item.path === ".vscode")).toBe(true);
    expect(signals.defer_candidates.some((item) => item.path === ".github")).toBe(true);
    expect(signals.defer_candidates.some((item) => item.path === "Dockerfile")).toBe(true);
    expect(signals.defer_candidates.some((item) => item.path === "docker-build.sh")).toBe(true);
  });

  it("suppresses python entrypoints under example and test intents via nearest classified ancestor", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-intent-suppress-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(repoRoot, "examples", "demo"), { recursive: true });
    await mkdir(path.join(repoRoot, "tests"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "src", "__main__.py"),
      'print("core")\n',
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "examples", "demo", "__main__.py"),
      'print("example")\n',
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "tests", "__main__.py"),
      'print("tests")\n',
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "pyproject.toml"),
      [
        "[project]",
        'name = "intent-fixture"',
        'version = "0.1.0"',
      ].join("\n"),
      "utf8",
    );

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-extract-intent-suppress",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const intentMap: IntentMap = {
      schema_version: "2.0",
      run_id: scan.run_id,
      entries: [
        {
          path: "src",
          depth: 1,
          intent: "core-source",
          confidence: "high",
          reason: "Primary source tree.",
          method: "static",
        },
        {
          path: "examples",
          depth: 1,
          intent: "example-fixtures",
          confidence: "high",
          reason: "Example applications live here.",
          method: "static",
        },
        {
          path: "tests",
          depth: 1,
          intent: "test-infrastructure",
          confidence: "high",
          reason: "Test support and fixtures live here.",
          method: "static",
        },
      ],
    };

    const signals = await extractSignals(scan, intentMap);
    const entrypointPaths = new Set(signals.entrypoints.map((entrypoint) => entrypoint.path));

    expect(entrypointPaths.has("src/__main__.py")).toBe(true);
    expect(entrypointPaths.has("examples/demo/__main__.py")).toBe(false);
    expect(entrypointPaths.has("tests/__main__.py")).toBe(false);
  });

  it("preserves phase 2 python entrypoint behavior when intent lookup resolves to unknown", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "repo-compass-intent-unknown-"));
    temporaryDirectories.push(repoRoot);

    await mkdir(path.join(repoRoot, "examples", "demo"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "examples", "demo", "__main__.py"),
      'print("fallback")\n',
      "utf8",
    );

    const input = normalizeRepoInput({
      schema_version: "2.0",
      run_id: "run-extract-intent-unknown",
      repo_root: repoRoot,
      output_root: repoRoot,
    });
    const scan = await scanRepository(input);
    const intentMap: IntentMap = {
      schema_version: "2.0",
      run_id: scan.run_id,
      entries: [
        {
          path: "docs",
          depth: 1,
          intent: "unknown",
          confidence: "low",
          reason: "Unrelated classification should not suppress other paths.",
          method: "static",
        },
      ],
    };

    const signals = await extractSignals(scan, intentMap);

    expect(
      signals.entrypoints.some(
        (entrypoint) =>
          entrypoint.path === "examples/demo/__main__.py" && entrypoint.kind === "cli",
      ),
    ).toBe(true);
  });
});
