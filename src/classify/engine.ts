import path from "node:path";

import {
  intentMapSchema,
  validateContract,
} from "../contracts/index.js";
import { evaluateRules } from "./rules.js";

import type {
  DirectoryEvidence,
  DirectoryIntent,
  DirectoryIntentEntry,
  IntentMap,
  StructureScan,
} from "../contracts/index.js";

/**
 * Compute the depth of a repo-relative directory path.
 * Root-level children have depth 1, grandchildren depth 2, etc.
 */
function computeDepth(repoRelativePath: string): number {
  return repoRelativePath.split("/").length;
}

/**
 * Build manifest hints for a directory from the scan results.
 * Includes manifest kinds whose paths lie inside the directory.
 */
function buildManifestHints(
  dirPath: string,
  scan: StructureScan,
): string[] {
  const hints = new Set<string>();

  for (const manifest of scan.detected.manifests) {
    const manifestDir = path.posix.dirname(manifest.path);

    // Manifest is directly inside this directory.
    if (manifestDir === dirPath || manifestDir === `${dirPath}/`) {
      hints.add(path.posix.basename(manifestDir));
      continue;
    }

    // Manifest is somewhere inside this directory tree.
    if (manifest.path.startsWith(`${dirPath}/`)) {
      hints.add(path.posix.basename(manifestDir));
    }
  }

  return [...hints];
}

/**
 * Build the list of immediate child names for a directory.
 */
function buildChildren(
  dirPath: string,
  scan: StructureScan,
): string[] {
  const prefix = dirPath === "" ? "" : `${dirPath}/`;
  const children = new Set<string>();

  for (const entry of scan.paths) {
    if (!entry.path.startsWith(prefix) || entry.path === dirPath) {
      continue;
    }

    const remainder = entry.path.slice(prefix.length);
    const firstSegment = remainder.split("/")[0];

    if (firstSegment) {
      children.add(firstSegment);
    }
  }

  return [...children].sort();
}

/**
 * Find the nearest classified ancestor intent for a directory.
 * Returns undefined if no ancestor has been classified.
 */
function findParentIntent(
  dirPath: string,
  classified: ReadonlyMap<string, DirectoryIntentEntry>,
): DirectoryIntent | undefined {
  let current = dirPath;

  while (current.includes("/")) {
    current = path.posix.dirname(current);

    if (current === "." || current === "") {
      break;
    }

    const parentEntry = classified.get(current);

    if (parentEntry) {
      return parentEntry.intent;
    }
  }

  return undefined;
}

/**
 * Static classifier that applies deterministic rules to directory evidence.
 */
export class StaticClassifier {
  public readonly method = "static" as const;

  public async classify(
    evidence: DirectoryEvidence,
  ): Promise<DirectoryIntentEntry> {
    const match = evaluateRules(evidence);

    if (match) {
      return {
        path: evidence.path,
        depth: evidence.depth,
        intent: match.intent,
        confidence: match.confidence,
        reason: match.reason,
        method: match.method,
      };
    }

    // No rule matched: emit unknown with low confidence.
    return {
      path: evidence.path,
      depth: evidence.depth,
      intent: "unknown",
      confidence: "low",
      reason: "no matching classification rule",
      method: "static",
    };
  }
}

/**
 * Build an IntentMap from a StructureScan.
 *
 * Only classifies directories up to `maxDepth` (default 2).
 * Deeper directories resolve intent via nearest ancestor at lookup time.
 */
export async function buildIntentMap(
  scan: StructureScan,
  options: { maxDepth?: number; runId?: string } = {},
): Promise<IntentMap> {
  const maxDepth = options.maxDepth ?? 2;
  const runId = options.runId ?? scan.run_id;
  const classifier = new StaticClassifier();

  // Collect directories from the scan, filtered to maxDepth.
  const directories = scan.paths
    .filter((entry) => entry.kind === "directory")
    .filter((entry) => computeDepth(entry.path) <= maxDepth)
    .sort((a, b) => computeDepth(a.path) - computeDepth(b.path));

  // Classify breadth-first (depth-1 before depth-2) so parent intents
  // are available when evaluating children.
  const classified = new Map<string, DirectoryIntentEntry>();

  for (const dir of directories) {
    const depth = computeDepth(dir.path) as 1 | 2;
    const children = buildChildren(dir.path, scan);
    const manifestHints = buildManifestHints(dir.path, scan);
    const parentIntent = findParentIntent(dir.path, classified);

    const evidence: DirectoryEvidence = {
      path: dir.path,
      depth,
      children,
      manifest_hints: manifestHints,
      ...(parentIntent ? { parent_intent: parentIntent } : {}),
    };

    const entry = await classifier.classify(evidence);

    // Only materialize entries that are not unknown, or that were explicitly
    // evaluated at the bounded depth.
    // Per Phase 3 contract: unresolved descendants are not synthesized.
    classified.set(dir.path, entry);
  }

  const intentMap: IntentMap = {
    schema_version: "2.0",
    run_id: runId,
    entries: [...classified.values()],
  };

  return validateContract(intentMapSchema, intentMap, "intentMap");
}

/**
 * Resolve the directory intent for a file path by finding the nearest
 * classified ancestor in the IntentMap.
 *
 * Returns "unknown" if no classified ancestor exists.
 */
export function resolveFileIntent(
  filePath: string,
  intentMap: IntentMap,
): DirectoryIntent {
  // Build a lookup map for fast ancestor resolution.
  const entryMap = new Map<string, DirectoryIntentEntry>();

  for (const entry of intentMap.entries) {
    entryMap.set(entry.path, entry);
  }

  let current = filePath;

  while (current.includes("/")) {
    current = path.posix.dirname(current);

    if (current === "." || current === "") {
      break;
    }

    const entry = entryMap.get(current);

    if (entry) {
      return entry.intent;
    }
  }

  return "unknown";
}
