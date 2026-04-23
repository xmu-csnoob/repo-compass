import path from "node:path";

import {
  ContractValidationError,
  repoInputSchema,
  validateContract,
} from "../contracts/index.js";

import type { RepoInput } from "../contracts/index.js";

function normalizePathList(values: readonly string[] | undefined): string[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value !== "")
    .map((value) => value.replaceAll("\\", "/"));
}

export function normalizeRepoInput(input: unknown): RepoInput {
  if (typeof input !== "object" || input === null) {
    return validateContract(repoInputSchema, input, "repoInput");
  }

  const candidate = input as Record<string, unknown>;
  // Fail fast for non-object options — arrays and primitives are invalid.
  // null is allowed (signals "use defaults"), and undefined means the field
  // was not provided at all (also falls through to schema defaults).
  // Exotic objects (Date, Map, URLSearchParams, etc.) are passed to schema
  // validation where they are rejected by the plain-object check.
  const opts = candidate.options;
  const isObjectType =
    typeof opts === "object" && opts !== null && !Array.isArray(opts);

  if (opts !== undefined && opts !== null && !isObjectType) {
    throw new ContractValidationError(
      "options must be an object when provided",
      ["options"],
    );
  }

  // Verify genuine plain object before spreading.
  // Shape-based check: objects whose string representation is [object Object]
  // are plain data objects (regardless of prototype). Objects from other realms,
  // class instances with custom toStringTag, and exotic objects (Date, Map, etc.)
  // have different tags and are passed through to schema for rejection.
  const toStringTag = Object.prototype.toString.call(opts);
  const isPlainObject = toStringTag === "[object Object]";

  // For null/undefined/primitives: use {}. For plain objects: safely copy own
  // enumerable string-keyed properties. For exotic/class-instance objects:
  // pass through to schema for rejection.
  const rawOptions: Record<string, unknown> =
    isObjectType && isPlainObject
      ? { ...(candidate.options as Record<string, unknown>) }
      : isObjectType
        ? (opts as Record<string, unknown>)
        : {};

  if (
    rawOptions.emit_agent_start === undefined &&
    typeof rawOptions.emit_agent_views === "boolean"
  ) {
    rawOptions.emit_agent_start = rawOptions.emit_agent_views;
  }

  const normalized = {
    ...candidate,
    repo_root:
      typeof candidate.repo_root === "string"
        ? path.resolve(candidate.repo_root)
        : candidate.repo_root,
    output_root:
      typeof candidate.output_root === "string"
        ? path.resolve(candidate.output_root)
        : candidate.output_root,
    include: Array.isArray(candidate.include)
      ? normalizePathList(candidate.include as string[])
      : candidate.include,
    exclude: Array.isArray(candidate.exclude)
      ? normalizePathList(candidate.exclude as string[])
      : candidate.exclude,
    options: rawOptions,
  };

  return validateContract(repoInputSchema, normalized, "repoInput");
}
