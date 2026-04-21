import {
  contextIndexSchema,
  validateContract,
} from "../contracts/index.js";

import type { Comprehension, ContextIndex } from "../contracts/index.js";

export function renderContextIndex(
  comprehension: Comprehension,
): ContextIndex {
  const contextIndex = {
    schema_version: comprehension.schema_version,
    repo: comprehension.repo,
    meta: comprehension.meta,
    artifacts: comprehension.artifacts,
    graph: comprehension.graph,
    entrypoints: comprehension.entrypoints,
    first_read_path: comprehension.first_read_path,
    key_paths: comprehension.key_paths,
    critical_paths: comprehension.critical_paths,
    defer_for_now: comprehension.defer_for_now,
    agent_hints: comprehension.agent_hints,
  };

  return validateContract(contextIndexSchema, contextIndex, "contextIndex");
}

function formatConfidence(confidence: "high" | "medium" | "low"): string {
  return confidence === "high" ? "" : ` [${confidence}]`;
}

export function renderRepoMap(contextIndex: ContextIndex): string {
  const lines = [
    "# Repo Map",
    "",
    "## Repo Snapshot",
    `- Name: \`${contextIndex.repo.name}\``,
    `- Shape: \`${contextIndex.repo.repo_shape}\``,
    `- Languages: ${contextIndex.repo.primary_languages.join(", ") || "unknown"}`,
    `- Framework hints: ${contextIndex.repo.framework_hints.join(", ") || "none"}`,
    "",
    "## First Read Path",
    ...contextIndex.first_read_path.map((item) => `- \`${item.path}\`${formatConfidence(item.confidence)}: ${item.why_now}`),
    "",
    "## Key Paths",
    ...contextIndex.key_paths.map((item) => `- \`${item.path}\` (${item.role})${formatConfidence(item.confidence)}: ${item.summary}`),
    "",
    "## Entrypoints",
    ...contextIndex.entrypoints.map((item) => `- \`${item.path}\` (${item.kind})${formatConfidence(item.confidence)}: ${item.reason}`),
    "",
    "## Critical Paths",
    ...contextIndex.critical_paths.map((item) => `- ${item.name}${formatConfidence(item.confidence)}: ${item.steps.join(" -> ")}`),
    "",
    "## Defer For Now",
    ...contextIndex.defer_for_now.map((item) => `- \`${item.path}\`${formatConfidence(item.confidence)}: ${item.reason}`),
    "",
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderOnboarding(contextIndex: ContextIndex): string {
  const runHints = contextIndex.agent_hints.filter((hint) => hint.kind === "run");
  const testHints = contextIndex.agent_hints.filter((hint) => hint.kind === "test");
  const safeEditHints = contextIndex.agent_hints.filter((hint) => hint.kind === "safe-edit-zone");
  const watchOutHints = contextIndex.agent_hints.filter((hint) => hint.kind === "watch-out");

  const lines = [
    "# ONBOARDING",
    "",
    "## What This Repo Appears To Be",
    `- \`${contextIndex.repo.name}\` looks like a \`${contextIndex.repo.repo_shape}\` repository.`,
    `- Framework hints: ${contextIndex.repo.framework_hints.join(", ") || "none"}`,
    "",
    "## Read First",
    ...contextIndex.first_read_path.map((item) => `- \`${item.path}\`${formatConfidence(item.confidence)}: ${item.why_now}`),
    "",
    "## Likely Entrypoints",
    ...contextIndex.entrypoints.map((item) => `- \`${item.path}\` (${item.kind})${formatConfidence(item.confidence)}: ${item.summary ?? item.reason}`),
    "",
    "## Getting Oriented",
    ...(runHints.length > 0
      ? runHints.map((hint) => `- ${hint.text}${formatConfidence(hint.confidence)}`)
      : ["- No primary run command was inferred."]),
    ...(testHints.length > 0
      ? testHints.map((hint) => `- ${hint.text}${formatConfidence(hint.confidence)}`)
      : ["- No test command was inferred."]),
    "",
    "## Safe Early Edit Zones",
    ...(safeEditHints.length > 0
      ? safeEditHints.map((hint) => `- ${hint.text}${formatConfidence(hint.confidence)}`)
      : ["- No safe edit zone was inferred."]),
    "",
    "## Defer For Now",
    ...contextIndex.defer_for_now.map((item) => `- \`${item.path}\`${formatConfidence(item.confidence)}: ${item.reason}`),
    "",
    ...(watchOutHints.length > 0
      ? ["## Watch Outs", ...watchOutHints.map((hint) => `- ${hint.text}${formatConfidence(hint.confidence)}`), ""]
      : []),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderAgentContext(contextIndex: ContextIndex): string {
  const lines = [
    "# Agent Context",
    "",
    `Repo: ${contextIndex.repo.name}`,
    `Shape: ${contextIndex.repo.repo_shape}`,
    `Frameworks: ${contextIndex.repo.framework_hints.join(", ") || "none"}`,
    "",
    "## Read First",
    ...contextIndex.first_read_path.map((item) => `- ${item.path}: ${item.reason}`),
    "",
    "## Entrypoints",
    ...contextIndex.entrypoints.map((item) => `- ${item.path} (${item.kind}): ${item.reason}`),
    "",
    "## Commands",
    ...contextIndex.artifacts.commands.map((command) => `- ${command.name}: ${command.command}`),
    "",
    "## Hints",
    ...contextIndex.agent_hints.map((hint) => `- [${hint.kind}] ${hint.text}`),
    "",
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}
