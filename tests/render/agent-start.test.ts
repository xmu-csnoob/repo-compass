import { describe, expect, it } from "vitest";

import { renderAgentStart } from "../../src/render/index.js";

import type { ContextIndex } from "../../src/contracts/index.js";

function makeLines(prefix: string, count: number, width = 260): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}: ${"x".repeat(width)}`);
}

function makeContextIndex(overrides: Partial<ContextIndex> = {}): ContextIndex {
  return {
    schema_version: "2.0",
    repo: {
      name: "overflow-fixture",
      root: "/repo",
      repo_shape: "service",
      primary_languages: ["Python"],
      detected_ecosystems: ["python"],
      framework_hints: ["fastapi"],
    },
    meta: {
      run_id: "run-overflow",
      snapshot_id: "run-overflow",
      generated_at: "2026-04-22T12:00:00Z",
      included_paths: [],
      excluded_paths: [],
    },
    artifacts: {
      manifests: [],
      commands: makeLines("command", 16).map((command, index) => ({
        source_path: "pyproject.toml",
        name: `cmd-${index + 1}`,
        command,
      })),
    },
    graph: {
      nodes: [],
      edges: [],
    },
    entrypoints: makeLines("entrypoint", 14).map((reason, index) => ({
      id: `ep-${index + 1}`,
      path: `app/entry_${index + 1}.py`,
      kind: "server" as const,
      summary: "Server entrypoint",
      reason,
      confidence: "high" as const,
      evidence: [`entry-${index + 1}`],
    })),
    first_read_path: makeLines("first-read", 12).map((reason, index) => ({
      path: `app/read_${index + 1}.py`,
      why_now: reason,
      reason,
      confidence: "high" as const,
      evidence: [`read-${index + 1}`],
    })),
    key_paths: makeLines("key-path", 18).map((summary, index) => ({
      path: `app/key_${index + 1}.py`,
      kind: "file" as const,
      role: "core" as const,
      summary,
      priority: "high" as const,
      reason: summary,
      confidence: "high" as const,
      evidence: [`key-${index + 1}`],
    })),
    critical_paths: [],
    defer_for_now: makeLines("defer", 18).map((reason, index) => ({
      path: `build/defer_${index + 1}`,
      reason,
      confidence: "medium" as const,
      evidence: [`defer-${index + 1}`],
    })),
    agent_hints: [],
    warnings: makeLines("warning", 8, 300),
    freshness: {
      mode: "ci",
      status: "unknown",
      generated_from: "full",
      reason: "Freshness verification has not completed yet.",
    },
    ...overrides,
  };
}

describe("agent-start renderer", () => {
  it("drops lower-priority sections before warnings, entrypoints, and first-read content when over budget", () => {
    const rendered = renderAgentStart(makeContextIndex());

    expect(rendered).toContain("## Warnings And Uncertainty");
    expect(rendered).toContain("## Entrypoints");
    expect(rendered).toContain("## Read First");
    expect(rendered).not.toContain("## Freshness");
    expect(rendered).not.toContain("## Defer For Now");
  });

  it("preserves warnings even when other sections are removed to stay within budget", () => {
    const rendered = renderAgentStart(
      makeContextIndex({
        warnings: makeLines("warning", 20, 320),
        entrypoints: [],
        first_read_path: [],
      }),
    );

    expect(rendered).toContain("## Warnings And Uncertainty");
    expect(rendered).not.toContain("## Freshness");
    expect(rendered).not.toContain("## Defer For Now");
    expect(rendered).not.toContain("## Key Paths");
  });
});
