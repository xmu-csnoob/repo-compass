import { access, constants } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildIntentMap } from "../classify/index.js";
import { buildComprehension } from "../comprehend/index.js";
import { normalizeRepoInput } from "../input/index.js";
import { renderAgentStart, renderContextIndex, renderHtmlReport, renderOnboarding, renderRepoMap } from "../render/index.js";
import { scanRepository } from "../scan/index.js";
import { extractSignals } from "../extract/index.js";
import { writeRunArtifact, writeRunJsonArtifact } from "../shared/index.js";
import { computeFreshness, loadPreviousFreshnessState, saveFreshnessState, buildFreshnessState } from "../freshness/index.js";

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
      "  --no-agent-start      Disable the startup markdown artifact. (default: enabled)",
      "  --agent-start         Override to enable the startup markdown artifact.",
      "  --agent-views         Legacy alias for --agent-start.",
      "  --freshness-mode      Declare freshness mode metadata: off, watch, or ci.",
      "  --mcp                 Start the MCP server for Claude Code integration.",
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
  let emitAgentStart = true;
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

    if (token === "--agent-start" || token === "--no-agent-start") {
      emitAgentStart = token === "--agent-start";
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
  const previousFreshness = await loadPreviousFreshnessState(input.output_root);
  const scan = await scanRepository(input);
  const intentMap = await buildIntentMap(scan);
  const signals = await extractSignals(scan, intentMap);
  const freshness = computeFreshness(input, scan, previousFreshness);
  const comprehension = buildComprehension(input, scan, signals, freshness, intentMap);
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
      await writeRunJsonArtifact(
        input.output_root,
        input.run_id,
        "debug/intent-map.json",
        intentMap,
      ),
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

  // Save freshness state after any full rebuild (generated_from === "full").
  // The degraded status on the current run does not invalidate the state itself —
  // it just means this particular run is unproven (first run, or repo_root changed).
  // We must save the state so the next run can become trusted.
  // Off mode is excluded because it explicitly disclaims trust in its output.
  if (input.options.freshness_mode !== "off" && freshness.generated_from === "full") {
    await saveFreshnessState(input.output_root, buildFreshnessState(input, scan));
  }

  return {
    runId: input.run_id,
    outputPaths: outputPaths as readonly string[],
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  // MCP server mode takes over the process entirely.
  if (argv.includes("--mcp")) {
    const { startMcpServer } = await import("../mcp/index.js");
    await startMcpServer();
    return;
  }

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
