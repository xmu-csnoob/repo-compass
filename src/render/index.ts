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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function confidenceClass(confidence: "high" | "medium" | "low"): string {
  return confidence === "high" ? "confidence-high" : confidence === "medium" ? "confidence-medium" : "confidence-low";
}

function confidenceLabel(confidence: "high" | "medium" | "low"): string {
  if (confidence === "high") return "";
  return `<span class="${confidenceClass(confidence)}">${escapeHtml(confidence)}</span>`;
}

// Renders a list item. Caller must escape HTML in escapedHtml before passing.
// confidenceLabel is called separately and handles its own escaping.
function renderListItem(escapedHtml: string, confidence?: "high" | "medium" | "low"): string {
  if (confidence && confidence !== "high") {
    return `<li>${escapedHtml} ${confidenceLabel(confidence)}</li>`;
  }
  return `<li>${escapedHtml}</li>`;
}

export function renderHtmlReport(contextIndex: ContextIndex): string {
  const commands = contextIndex.artifacts.commands;
  const runHints = contextIndex.agent_hints.filter((h) => h.kind === "run");
  const testHints = contextIndex.agent_hints.filter((h) => h.kind === "test");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(contextIndex.repo.name)} - Repo Compass</title>
  <style>
    :root {
      --bg: #fafafa;
      --surface: #ffffff;
      --border: #e5e5e5;
      --text: #1a1a1a;
      --text-muted: #666666;
      --accent: #0066cc;
      --confidence-high: #22c55e;
      --confidence-medium: #f59e0b;
      --confidence-low: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
    header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1.5rem 0; margin-bottom: 2rem; }
    header h1 { font-size: 1.5rem; font-weight: 600; }
    header .subtitle { color: var(--text-muted); margin-top: 0.25rem; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
    .card h3 { font-size: 0.95rem; font-weight: 600; margin: 1rem 0 0.5rem; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .meta-item label { display: block; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; }
    .meta-item span { font-size: 1rem; font-weight: 500; }
    ul { list-style: none; }
    li { padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
    li:last-child { border-bottom: none; }
    code { background: var(--bg); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; margin-left: 0.5rem; }
    .confidence-high { background: #dcfce7; color: #166534; }
    .confidence-medium { background: #fef3c7; color: #92400e; }
    .confidence-low { background: #fee2e2; color: #991b1b; }
    .commands { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .command { background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 0.5rem 1rem; font-family: monospace; font-size: 0.9rem; }
    .empty { color: var(--text-muted); font-style: italic; }
    footer { text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 2rem 0; margin-top: 2rem; border-top: 1px solid var(--border); }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>${escapeHtml(contextIndex.repo.name)}</h1>
      <div class="subtitle">${escapeHtml(contextIndex.repo.repo_shape)} repository &middot; Generated by Repo Compass</div>
    </div>
  </header>

  <main class="container">
    <div class="card">
      <h2>Repo Overview</h2>
      <div class="meta">
        <div class="meta-item">
          <label>Shape</label>
          <span>${escapeHtml(contextIndex.repo.repo_shape)}</span>
        </div>
        <div class="meta-item">
          <label>Languages</label>
          <span>${escapeHtml(contextIndex.repo.primary_languages.join(", ")) || "unknown"}</span>
        </div>
        <div class="meta-item">
          <label>Frameworks</label>
          <span>${escapeHtml(contextIndex.repo.framework_hints.join(", ")) || "none"}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Commands</h2>
      ${commands.length > 0 ? `
        <div class="commands">
          ${commands.map((c) => `<span class="command">${escapeHtml(c.name)}: ${escapeHtml(c.command)}</span>`).join("")}
        </div>
      ` : `<p class="empty">No commands detected</p>`}
    </div>

    <div class="card">
      <h2>First Read Path</h2>
      <ul>
        ${contextIndex.first_read_path.map((item) => renderListItem(`<code>${escapeHtml(item.path)}</code>: ${escapeHtml(item.why_now)}`, item.confidence)).join("\n        ")}
      </ul>
    </div>

    <div class="card">
      <h2>Key Paths</h2>
      <ul>
        ${contextIndex.key_paths.map((item) => renderListItem(`<code>${escapeHtml(item.path)}</code> (${escapeHtml(item.role)}): ${escapeHtml(item.summary)}`, item.confidence)).join("\n        ")}
      </ul>
    </div>

    <div class="card">
      <h2>Entrypoints</h2>
      <ul>
        ${contextIndex.entrypoints.map((item) => renderListItem(`<code>${escapeHtml(item.path)}</code> (${escapeHtml(item.kind)}): ${escapeHtml(item.summary ?? item.reason)}`, item.confidence)).join("\n        ")}
      </ul>
    </div>

    ${contextIndex.critical_paths.length > 0 ? `
    <div class="card">
      <h2>Critical Paths</h2>
      <ul>
        ${contextIndex.critical_paths.map((item) => renderListItem(`<strong>${escapeHtml(item.name)}</strong>: ${item.steps.map((s) => `<code>${escapeHtml(s)}</code>`).join(" &rarr; ")}`, item.confidence)).join("\n        ")}
      </ul>
    </div>
    ` : ""}

    <div class="card">
      <h2>Defer For Now</h2>
      <ul>
        ${contextIndex.defer_for_now.length > 0
          ? contextIndex.defer_for_now.map((item) => renderListItem(`<code>${escapeHtml(item.path)}</code>: ${escapeHtml(item.reason)}`, item.confidence)).join("\n        ")
          : `<li class="empty">No paths marked for deferral</li>`
        }
      </ul>
    </div>
  </main>

  <footer>
    <p>Generated by Repo Compass &middot; Phase 1</p>
  </footer>
</body>
</html>`;
}
