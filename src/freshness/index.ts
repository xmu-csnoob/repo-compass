import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RepoInput, StructureScan } from "../contracts/index.js";

export interface FreshnessState {
  readonly run_id: string;
  readonly generated_at: string;
  readonly snapshot_id: string;
  readonly repo_root: string;
  readonly path_signatures: Record<string, number>;
}

export interface FreshnessResult {
  readonly status: "fresh" | "stale" | "degraded" | "unknown";
  readonly generated_from: "full" | "incremental";
  readonly reason: string;
  readonly changed_paths: readonly string[];
}

function computePathSignatures(scan: StructureScan): Record<string, number> {
  const signatures: Record<string, number> = {};

  for (const entry of scan.paths) {
    signatures[entry.path] = entry.size;
  }

  return signatures;
}

function detectChanges(
  previous: Record<string, number>,
  current: Record<string, number>,
): string[] {
  const changed: string[] = [];
  const allPaths = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const p of allPaths) {
    if (previous[p] !== current[p]) {
      changed.push(p);
    }
  }

  return changed;
}

function freshnessStatePath(outputRoot: string): string {
  return path.join(outputRoot, "work", "freshness-state.json");
}

export async function loadPreviousFreshnessState(
  outputRoot: string,
): Promise<FreshnessState | undefined> {
  try {
    const raw = await readFile(freshnessStatePath(outputRoot), "utf8");
    const parsed = JSON.parse(raw) as FreshnessState;

    if (
      typeof parsed.run_id === "string" &&
      typeof parsed.generated_at === "string" &&
      typeof parsed.repo_root === "string" &&
      typeof parsed.path_signatures === "object"
    ) {
      return parsed;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function saveFreshnessState(
  outputRoot: string,
  state: FreshnessState,
): Promise<void> {
  const statePath = freshnessStatePath(outputRoot);
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify(state, null, 2) + "\n",
  );
}

export function computeFreshness(
  input: RepoInput,
  scan: StructureScan,
  previousState: FreshnessState | undefined,
): FreshnessResult {
  const mode = input.options.freshness_mode;

  if (mode === "off") {
    return {
      status: "unknown",
      generated_from: "full",
      reason: "Freshness tracking is disabled for this run.",
      changed_paths: [],
    };
  }

  const currentSignatures = computePathSignatures(scan);

  if (mode === "ci") {
    return {
      status: "fresh",
      generated_from: "full",
      reason: "CI mode performed a trusted full canonical rebuild.",
      changed_paths: [],
    };
  }

  // watch mode
  if (previousState === undefined) {
    return {
      status: "degraded",
      generated_from: "full",
      reason:
        "No prior freshness state available; performed full rebuild but incremental trust is unproven.",
      changed_paths: [],
    };
  }

  if (previousState.repo_root !== input.repo_root) {
    return {
      status: "degraded",
      generated_from: "full",
      reason:
        "Repository root changed since last run; performed full rebuild but incremental trust is unproven.",
      changed_paths: [],
    };
  }

  const changedPaths = detectChanges(previousState.path_signatures, currentSignatures);

  if (changedPaths.length === 0) {
    return {
      status: "fresh",
      generated_from: "incremental",
      reason: "No filesystem changes detected since last run.",
      changed_paths: [],
    };
  }

  return {
    status: "fresh",
    generated_from: "full",
    reason: `Filesystem changes detected in ${changedPaths.length} path(s); performed full canonical rebuild.`,
    changed_paths: changedPaths,
  };
}

export function buildFreshnessState(
  input: RepoInput,
  scan: StructureScan,
): FreshnessState {
  return {
    run_id: input.run_id,
    generated_at: new Date().toISOString(),
    snapshot_id: input.run_id,
    repo_root: input.repo_root,
    path_signatures: computePathSignatures(scan),
  };
}
