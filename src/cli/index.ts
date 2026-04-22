import { access, constants } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildComprehension } from "../comprehend/index.js";
import { normalizeRepoInput } from "../input/index.js";
import { renderAgentStart, renderContextIndex, renderHtmlReport, renderOnboarding, renderRepoMap } from "../render/index.js";
import { scanRepository } from "../scan/index.js";
import { extractSignals } from "../extract/index.js";
import { writeRunArtifact, writeRunJsonArtifact } from "../shared/index.js";

import type { RepoInput } from "../contracts/index.js";

type CliOptions = {
  readonly repoRoot: string;
  readonly outputRoot: string;
  readonly include: string[];
  readonly exclude: string[];
  readonly debug: boolean;
  readonly emitAgentStart: boolean;
  readonly freshnessMode: "off" | "watch" | "ci";
};

function printHelp(): void {
  process.stdout.write(
    [
      "Usage: repo-compass [repo-root] [--output-root <path>] [--include <path>] [--exclude <path>] [--debug] [--agent-start] [--freshness-mode <off|watch|ci>]",
      "",
      "Options:",
      "  --output-root <path>  Override the root used for generated artifacts.",
      "  --include <path>      Restrict analysis to a repo-relative subtree.",
      "  --exclude <path>      Add an explicit exclude rule.",
      "  --debug               Emit intermediate debug artifacts.",
      "  --agent-start         Emit the startup markdown artifact.",
      "  --agent-views         Legacy alias for --agent-start.",
      "  --freshness-mode      Declare freshness mode metadata: off, watch, or ci.",
      "  --help                Show this message.",
      "",
    ].join("\n"),
  );
}

function generateRunId(): string {
  return `run-${new Date().toISOString().replaceAll(/[:.]/gu, "-")}`;
}

async function ensureDirectoryExists(targetPath: string): Promise<void> {
  try {
    await access(targetPath, constants.R_OK);
  } catch (error) {
    throw new Error(`Directory "${targetPath}" is not accessible`, {
      cause: error,
    });
  }
}

function parseArgs(argv: readonly string[]): CliOptions {
  const positional: string[] = [];
  const include: string[] = [];
  const exclude: string[] = [];
  let outputRoot: string | undefined;
  let debug = false;
  let emitAgentStart = false;
  let freshnessMode: "off" | "watch" | "ci" = "off";

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    if (token === "--help") {
      printHelp();
      process.exit(0);
    }

    if (token === "--debug") {
      debug = true;
      continue;
    }

    if (token === "--agent-views") {
      emitAgentStart = true;
      continue;
    }

    if (token === "--agent-start") {
      emitAgentStart = true;
      continue;
    }

    if (
      token === "--output-root" ||
      token === "--include" ||
      token === "--exclude" ||
      token === "--freshness-mode"
    ) {
      const value = argv[index + 1];

      if (value === undefined) {
        throw new Error(`Missing value for ${token}`);
      }

      index += 1;

      if (token === "--output-root") {
        outputRoot = value;
      } else if (token === "--include") {
        include.push(value);
      } else if (token === "--freshness-mode") {
        if (value !== "off" && value !== "watch" && value !== "ci") {
          throw new Error(`Invalid freshness mode "${value}"`);
        }

        freshnessMode = value;
      } else {
        exclude.push(value);
      }

      continue;
    }

    positional.push(token);
  }

  const repoRoot = positional[0] ?? process.cwd();

  return {
    repoRoot,
    outputRoot: outputRoot ?? repoRoot,
    include,
    exclude,
    debug,
    emitAgentStart,
    freshnessMode,
  };
}

async function buildRepoInput(options: CliOptions): Promise<RepoInput> {
  const repoRoot = path.resolve(options.repoRoot);
  const outputRoot = path.resolve(options.outputRoot);

  await ensureDirectoryExists(repoRoot);
  await ensureDirectoryExists(outputRoot);

  return normalizeRepoInput({
    schema_version: "2.0",
    run_id: generateRunId(),
    repo_root: repoRoot,
    output_root: outputRoot,
    include: options.include,
    exclude: options.exclude,
    options: {
      emit_debug_artifacts: options.debug,
      emit_agent_start: options.emitAgentStart,
      freshness_mode: options.freshnessMode,
    },
  });
}

export async function runPipeline(argv: readonly string[]): Promise<{
  readonly runId: string;
  readonly outputPaths: readonly string[];
}> {
  const options = parseArgs(argv);
  const input = await buildRepoInput(options);
  const scan = await scanRepository(input);
  const signals = await extractSignals(scan);
  const comprehension = buildComprehension(input, scan, signals);
  const contextIndex = renderContextIndex(comprehension);

  const outputPaths = [
    await writeRunJsonArtifact(input.output_root, input.run_id, "input.json", input),
    await writeRunJsonArtifact(input.output_root, input.run_id, "context-index.json", contextIndex),
    await writeRunArtifact(
      input.output_root,
      input.run_id,
      "outputs/repo.map.md",
      renderRepoMap(contextIndex),
    ),
    await writeRunArtifact(
      input.output_root,
      input.run_id,
      "outputs/ONBOARDING.md",
      renderOnboarding(contextIndex),
    ),
    await writeRunArtifact(
      input.output_root,
      input.run_id,
      "outputs/index.html",
      renderHtmlReport(contextIndex),
    ),
  ];

  if (input.options.emit_agent_start) {
    outputPaths.push(
      await writeRunArtifact(
        input.output_root,
        input.run_id,
        "outputs/agent-start.md",
        renderAgentStart(contextIndex),
      ),
    );
  }

  if (input.options.emit_debug_artifacts) {
    outputPaths.push(
      await writeRunJsonArtifact(input.output_root, input.run_id, "scan.json", scan),
      await writeRunJsonArtifact(input.output_root, input.run_id, "signals.json", signals),
      await writeRunJsonArtifact(
        input.output_root,
        input.run_id,
        "comprehension.json",
        comprehension,
      ),
    );
  }

  return {
    runId: input.run_id,
    outputPaths: outputPaths as readonly string[],
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  try {
    const result = await runPipeline(argv);
    process.stdout.write(`Generated run ${result.runId}\n`);

    for (const outputPath of result.outputPaths) {
      process.stdout.write(`${outputPath}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
