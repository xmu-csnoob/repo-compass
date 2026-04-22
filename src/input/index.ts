import path from "node:path";

import { repoInputSchema, validateContract } from "../contracts/index.js";

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
  const rawOptions =
    typeof candidate.options === "object" && candidate.options !== null
      ? { ...(candidate.options as Record<string, unknown>) }
      : candidate.options;

  if (
    typeof rawOptions === "object" &&
    rawOptions !== null &&
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
