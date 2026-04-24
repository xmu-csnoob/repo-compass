import path from "node:path";

import {
  intentMapSchema,
  validateContract,
} from "../contracts/index.js";
import { evaluateRules } from "./rules.js";

import type {
  DirectoryClassifier,
  DirectoryEvidence,
  DirectoryIntent,
  DirectoryIntentEntry,
  IntentMap,
  StructureScan,
} from "../contracts/index.js";

/**
 * Compute the depth of a repo-relative directory path.
 * Root has depth 0, root-level children depth 1, grandchildren depth 2, etc.
 */
function computeDepth(repoRelativePath: string): number {
  const normalized = path.posix.normalize(repoRelativePath);
  if (normalized === "" || normalized === ".") {
    return 0;
  }
  return normalized.split("/").length;
}

/**
 * Build manifest hints for a directory from the scan results.
 * Only includes manifests that are located *directly* inside the directory
 * (i.e. the manifest file sits in the directory itself, not in a descendant).
 * This avoids noisy signals from deeply nested manifests.
 */
function buildManifestHints(
  dirPath: string,
  scan: StructureScan,
): string[] {
  const hints = new Set<string>();
  const normalizedDir = path.posix.normalize(dirPath);

  for (const manifest of scan.detected.manifests) {
    const manifestDir = path.posix.normalize(path.posix.dirname(manifest.path));

    // Only count manifests that are directly inside this directory.
    if (manifestDir === normalizedDir) {
      hints.add(manifest.kind);
    }
  }

  return [...hints];
}

/**
 * Return true if the directory contains an __init__.py file directly (not in
 * a subdirectory), indicating it is a Python package namespace.
 */
function isPythonPackage(
  dirPath: string,
  scan: StructureScan,
): boolean {
  const normalizedDir = path.posix.normalize(dirPath);
  const target = `${normalizedDir}/__init__.py`;

  for (const entry of scan.paths) {
    if (entry.kind === "file" && path.posix.normalize(entry.path) === target) {
      return true;
    }
  }

  return false;
}

/**
 * Build the list of immediate child directory names for a directory.
 * Only counts entries whose kind is "directory"; files are excluded.
 */
function buildChildren(
  dirPath: string,
  scan: StructureScan,
): string[] {
  const normalizedDir = path.posix.normalize(dirPath);
  const prefix = normalizedDir === "" ? "" : `${normalizedDir}/`;
  const children = new Set<string>();

  for (const entry of scan.paths) {
    if (entry.kind !== "directory") {
      continue;
    }

    if (!entry.path.startsWith(prefix) || entry.path === normalizedDir) {
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

  while (current !== "." && current !== "" && current !== "/") {
    const parent = path.posix.dirname(current);

    // Guard against root-level loops (dirname("/") === "/")
    if (parent === current || parent === "." || parent === "" || parent === "/") {
      break;
    }

    current = parent;

    const parentEntry = classified.get(current);

    if (parentEntry) {
      return parentEntry.intent;
    }
  }

  return undefined;
}

/**
 * Intents that represent noise surfaces that must propagate to children.
 * A child directory under one of these parents cannot be reclassified by
 * a non-suppression rule (e.g. a Python package inside docs_src/ must stay
 * example-fixtures, not become library-surface).
 */
const SUPPRESSION_INTENTS = new Set<DirectoryIntent>([
  "example-fixtures",
  "test-infrastructure",
]);

/**
 * Static classifier that applies deterministic rules to directory evidence.
 *
 * Implements the {@link DirectoryClassifier} interface so that future
 * classifiers (e.g. LLM-based) can be swapped in without changing call sites.
 */
export class StaticClassifier implements DirectoryClassifier {
  public readonly method = "static" as const;

  public async classify(
    evidence: DirectoryEvidence,
  ): Promise<DirectoryIntentEntry> {
    const match = evaluateRules(evidence);

    if (match) {
      // Suppression-grade parents take precedence over non-suppression rules.
      // This prevents generic rules (e.g. python-package-directory →
      // library-surface) from reclassifying directories nested inside example
      // or test surfaces.
      //
      // Exception: if the matching rule itself assigns a suppression-grade
      // intent, allow it to override the parent. This preserves existing
      // behaviour such as tests/fixtures → example-fixtures even when the
      // parent is test-infrastructure.
      if (
        evidence.parent_intent !== undefined &&
        SUPPRESSION_INTENTS.has(evidence.parent_intent) &&
        !SUPPRESSION_INTENTS.has(match.intent)
      ) {
        return {
          path: evidence.path,
          depth: evidence.depth,
          intent: evidence.parent_intent,
          confidence: "high",
          reason: "inherits suppression intent from parent directory",
          method: this.method,
        };
      }

      return {
        path: evidence.path,
        depth: evidence.depth,
        intent: match.intent,
        confidence: match.confidence,
        reason: match.reason,
        method: this.method,
      };
    }

    // Parent inheritance: if a parent directory has already been classified,
    // inherit its intent at reduced confidence. This is treated as a fallback
    // rather than a rule so that the rule set remains purely declarative.
    if (evidence.parent_intent) {
      return {
        path: evidence.path,
        depth: evidence.depth,
        intent: evidence.parent_intent,
        confidence: "medium",
        reason: "inherits intent from parent directory",
        method: this.method,
      };
    }

    // No rule matched and no classified parent: emit unknown with low confidence.
    return {
      path: evidence.path,
      depth: evidence.depth,
      intent: "unknown",
      confidence: "low",
      reason: "no matching classification rule",
      method: this.method,
    };
  }
}

/**
 * Build an IntentMap from a StructureScan.
 *
 * Only classifies directories up to `maxDepth` (clamped to the range [1, 2]).
 * Deeper directories resolve intent via nearest ancestor at lookup time.
 *
 * Performance note: this function iterates over all manifests and paths for
 * each classified directory. Because `maxDepth` is bounded (default 2), the
 * number of classified directories is small in practice, so the quadratic
 * behaviour is acceptable. Pre-optimisation is deferred until profiling shows
 * a bottleneck.
 */
export async function buildIntentMap(
  scan: StructureScan,
  options: { maxDepth?: number; runId?: string } = {},
): Promise<IntentMap> {
  const requestedMaxDepth = options.maxDepth ?? 2;
  if (requestedMaxDepth < 1 || requestedMaxDepth > 2) {
    throw new RangeError(
      `maxDepth must be between 1 and 2, got ${requestedMaxDepth}`,
    );
  }
  const maxDepth = requestedMaxDepth;
  const runId = options.runId ?? scan.run_id;
  const classifier = new StaticClassifier();

  // Collect directories from the scan, filtered to [1, maxDepth].
  // The root directory (depth 0) is excluded because it has no meaningful
  // basename for rule matching.
  const directories = scan.paths
    .filter((entry) => entry.kind === "directory")
    .filter((entry) => {
      const d = computeDepth(entry.path);
      return d >= 1 && d <= maxDepth;
    })
    .sort((a, b) => computeDepth(a.path) - computeDepth(b.path));

  // Classify breadth-first (depth-1 before depth-2) so parent intents
  // are available when evaluating children.
  const classified = new Map<string, DirectoryIntentEntry>();

  for (const dir of directories) {
    const rawDepth = computeDepth(dir.path);
    // The filter above guarantees rawDepth is 1 or 2; this assertion
    // is a type-narrowing device for TypeScript, not a runtime check.
    const depth: 1 | 2 = rawDepth as 1 | 2;
    const children = buildChildren(dir.path, scan);
    const manifestHints = buildManifestHints(dir.path, scan);
    const parentIntent = findParentIntent(dir.path, classified);
    const pythonPackage = isPythonPackage(dir.path, scan);

    const evidence: DirectoryEvidence = {
      path: dir.path,
      depth,
      children,
      manifest_hints: manifestHints,
      ...(parentIntent ? { parent_intent: parentIntent } : {}),
      ...(pythonPackage ? { python_package: true } : {}),
    };

    const entry = await classifier.classify(evidence);

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
 * Create a file-to-intent resolver from an IntentMap.
 *
 * Pre-builds an internal lookup map, so repeated file lookups are O(depth)
 * rather than O(entries) per call.
 *
 * @returns A function that resolves a file path to its nearest ancestor intent.
 */
export function createFileResolver(
  intentMap: IntentMap,
): (filePath: string) => DirectoryIntent {
  const entryMap = new Map<string, DirectoryIntentEntry>();

  for (const entry of intentMap.entries) {
    entryMap.set(entry.path, entry);
  }

  return (filePath: string): DirectoryIntent => {
    let current = path.posix.normalize(filePath);

    do {
      if (current === "." || current === "" || current === "/") {
        break;
      }

      const entry = entryMap.get(current);

      if (entry) {
        return entry.intent;
      }

      const parent = path.posix.dirname(current);

      // Guard against root-level loops (dirname("/") === "/")
      if (parent === current) {
        break;
      }

      current = parent;
    } while (current !== "." && current !== "" && current !== "/");

    return "unknown";
  };
}

/**
 * Resolve the directory intent for a file path by finding the nearest
 * classified ancestor in the IntentMap.
 *
 * Returns "unknown" if no classified ancestor exists.
 *
 * **Performance note:** this function rebuilds the lookup map on every call.
 * For repeated lookups, use {@link createFileResolver} instead.
 */
export function resolveFileIntent(
  filePath: string,
  intentMap: IntentMap,
): DirectoryIntent {
  const resolver = createFileResolver(intentMap);
  return resolver(filePath);
}
