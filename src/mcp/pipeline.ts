import { buildIntentMap } from "../classify/index.js";
import { buildComprehension } from "../comprehend/index.js";
import { normalizeRepoInput } from "../input/index.js";
import { renderContextIndex } from "../render/index.js";
import { scanRepository } from "../scan/index.js";
import { extractSignals } from "../extract/index.js";

import type {
  RepoInput,
  StructureScan,
  IntentMap,
  SignalExtraction,
  Comprehension,
  ContextIndex,
} from "../contracts/index.js";

/** Complete pipeline output for a single repo analysis. */
export interface CacheEntry {
  readonly input: RepoInput;
  readonly scan: StructureScan;
  readonly intentMap: IntentMap;
  readonly signals: SignalExtraction;
  readonly comprehension: Comprehension;
  readonly contextIndex: ContextIndex;
}

function generateRunId(): string {
  return `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Run the full repo-compass pipeline for the given repo root.
 *
 * Freshness is always "off" in MCP mode — there is no persisted state
 * between sessions, so every run is a full rebuild.
 */
export async function runFullPipeline(
  repoRoot: string,
  include: readonly string[],
  exclude: readonly string[],
): Promise<CacheEntry> {
  const input = normalizeRepoInput({
    schema_version: "2.0",
    run_id: generateRunId(),
    repo_root: repoRoot,
    output_root: repoRoot,
    include,
    exclude,
    options: {
      emit_debug_artifacts: false,
      emit_agent_start: false,
      freshness_mode: "off",
    },
  });

  const scan = await scanRepository(input);
  const intentMap = await buildIntentMap(scan);
  const signals = await extractSignals(scan, intentMap);
  const comprehension = buildComprehension(
    input,
    scan,
    signals,
    undefined,
    intentMap,
  );
  const contextIndex = renderContextIndex(comprehension);

  return { input, scan, intentMap, signals, comprehension, contextIndex };
}
