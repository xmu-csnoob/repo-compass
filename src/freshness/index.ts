import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RepoInput, StructureScan } from "../contracts/index.js";

export interface FreshnessState {
  readonly run_id: string;
  readonly generated_at: string;
  readonly snapshot_id: string;
  readonly repo_root: string;
  readonly path_signatures: Record<string, string>;
}

export interface FreshnessResult {
  readonly status: "fresh" | "stale" | "degraded" | "unknown";
  readonly generated_from: "full" | "incremental";
  readonly reason: string;
  readonly changed_paths: readonly string[];
}

function computePathSignatures(scan: StructureScan): Record<string, string> {
  const signatures: Record<string, string> = {};

  for (const entry of scan.paths) {
    // Directories use a "0:0" sentinel since their mtimes change whenever
    // any child file is modified, which would cause noise from ignored paths.
    // This still detects directory create/delete/rename events.
    if (entry.kind === "directory") {
      signatures[entry.path] = "0:0";
      continue;
    }
    // Use a string tuple so both mtime and size are preserved without
    // any lossy numeric conversion.
    signatures[entry.path] = `${entry.mtime ?? 0}:${entry.size}`;
  }

  return signatures;
}

function detectChanges(
  previous: Record<string, string>,
  current: Record<string, string>,
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

    // Strict validation: require all fields and validate signature format.
    if (
      typeof parsed.run_id === "string" &&
      parsed.run_id.length > 0 &&
      typeof parsed.generated_at === "string" &&
      parsed.generated_at.length > 0 &&
      typeof parsed.snapshot_id === "string" &&
      parsed.snapshot_id.length > 0 &&
      typeof parsed.repo_root === "string" &&
      parsed.repo_root.length > 0 &&
      typeof parsed.path_signatures === "object" &&
      parsed.path_signatures !== null
    ) {
      const sigs = parsed.path_signatures;

      // Reject empty signature maps (could be hand-written or truncated).
      const sigKeys = Object.keys(sigs);
      if (sigKeys.length === 0) {
        return undefined;
      }

      // Reject legacy numeric path_signatures (pre-mtime format) as incompatible.
      // Converting old "size-only" values to strings produces mismatched signatures
      // (e.g. "100" vs "0:100"), causing false change storms on upgrade.
      // Treat the state as absent so the next run does a full rebuild.
      const firstValue = Object.values(sigs)[0];
      if (typeof firstValue === "number") {
        return undefined;
      }

      // Validate every signature value matches the current "mtime:size" format.
      for (const val of Object.values(sigs)) {
        if (typeof val !== "string") {
          return undefined;
        }
        // Each signature must be "mtime:size" where both are non-negative integers.
        // mtime can be 0 (unset), size must be >= 0.
        const parts = val.split(":");
        if (parts.length !== 2) {
          return undefined;
        }
        const mtime = Number(parts[0]);
        const size = Number(parts[1]);
        if (!Number.isFinite(mtime) || mtime < 0 || !Number.isFinite(size) || size < 0) {
          return undefined;
        }
      }

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

  // Note: we always do a full pipeline rebuild in watch mode, even when
  // mtime:size signatures suggest no changes. mtime:size cannot reliably
  // detect content-preserving edits (timestamp-preserving checkouts,
  // remote/coarse filesystems, same-size edits within timestamp granularity).
  // Returning "incremental" would claim we skipped the rebuild based on
  // unreliable metadata, making the trust signal unreliable.
  return {
    status: "fresh",
    generated_from: "full",
    reason:
      changedPaths.length === 0
        ? "No filesystem changes detected; performed full canonical rebuild for trust."
        : `Filesystem changes detected in ${changedPaths.length} path(s); performed full canonical rebuild.`,
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
