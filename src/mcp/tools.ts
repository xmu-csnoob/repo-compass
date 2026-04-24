import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  renderAgentStart,
  renderHtmlReport,
  renderOnboarding,
} from "../render/index.js";
import type { PipelineCache } from "./cache.js";
import type { CacheEntry } from "./pipeline.js";
import { runFullPipeline } from "./pipeline.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

function getOrCreateEntry(
  cache: PipelineCache,
  repoRoot: string,
  include: readonly string[],
  exclude: readonly string[],
): Promise<CacheEntry> {
  const key = cache.makeKey(repoRoot, include, exclude);
  let entry = cache.get(key);

  if (!entry) {
    entry = runFullPipeline(repoRoot, include, exclude).catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, entry);
  }

  return entry;
}

function getOutputDir(repoRoot: string, outputDir?: string): string {
  return outputDir ?? join(repoRoot, ".repo-compass");
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

export function registerAllTools(
  server: McpServer,
  cache: PipelineCache,
): void {
  // ---- Tool 1: generate_repo_guide ----------------------------------------
  server.registerTool(
    "generate_repo_guide",
    {
      description:
        "Generate a complete repo navigation guide: an HTML visual dashboard, an ONBOARDING markdown document, and an AI agent startup context. Artifacts are saved to <repo_root>/.repo-compass/ (or a custom output directory). Ideal for onboarding new team members or documenting project structure. Use when the user wants a visual overview, onboarding docs, or to share project structure with others.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        output_dir: z
          .string()
          .optional()
          .describe(
            "Custom directory to save artifacts (default: <repo_root>/.repo-compass/)",
          ),
        include: z
          .array(z.string())
          .optional()
          .describe("Restrict analysis to repo-relative subtrees"),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Add explicit exclude rules"),
      },
      annotations: { readOnlyHint: false },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(
          cache,
          params.repo_root,
          params.include ?? [],
          params.exclude ?? [],
        );
        const outputDir = getOutputDir(
          params.repo_root,
          params.output_dir,
        );
        await mkdir(outputDir, { recursive: true });

        const html = renderHtmlReport(entry.contextIndex);
        const onboarding = renderOnboarding(entry.contextIndex);
        const agentStart = renderAgentStart(entry.contextIndex);

        const htmlPath = join(outputDir, "index.html");
        const mdPath = join(outputDir, "ONBOARDING.md");
        const agentPath = join(outputDir, "agent-start.md");

        await Promise.all([
          writeFile(htmlPath, html, "utf-8"),
          writeFile(mdPath, onboarding, "utf-8"),
          writeFile(agentPath, agentStart, "utf-8"),
        ]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  html_path: htmlPath,
                  onboarding_md_path: mdPath,
                  agent_start_md_path: agentPath,
                  repo_shape: entry.contextIndex.repo.repo_shape,
                  file_count: entry.scan.repo.file_count,
                  languages: entry.scan.detected.languages,
                  framework_hints: entry.scan.detected.framework_hints,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---- Tool 2: get_agent_context ------------------------------------------
  server.registerTool(
    "get_agent_context",
    {
      description:
        "Get the AI agent startup context for this repository. Returns a highly condensed repo cheat-sheet (~2000 tokens) containing project type, tech stack, run commands, entry files, and first-read path. Claude Code should load this into the conversation context to understand the repo without scanning from scratch. Use at the beginning of a conversation about an unfamiliar codebase.",
      inputSchema: {
        repo_root: z
          .string()
          .describe("Absolute path to the repository root"),
        include: z
          .array(z.string())
          .optional()
          .describe("Restrict analysis to repo-relative subtrees"),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Add explicit exclude rules"),
      },
      annotations: { readOnlyHint: true },
    },
    async (params) => {
      try {
        const entry = await getOrCreateEntry(
          cache,
          params.repo_root,
          params.include ?? [],
          params.exclude ?? [],
        );
        const agentStart = renderAgentStart(entry.contextIndex);
        return {
          content: [{ type: "text", text: agentStart }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
