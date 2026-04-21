import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildComprehension } from "../../src/comprehend/index.js";
import { extractSignals } from "../../src/extract/index.js";
import { normalizeRepoInput } from "../../src/input/index.js";
import { renderHtmlReport } from "../../src/render/index.js";
import { scanRepository } from "../../src/scan/index.js";

function fixturePath(name: string): string {
  return path.resolve("tests/fixtures", name);
}

describe("HTML report renderer (8.2)", () => {
  it("renders valid HTML for node-cli fixture", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "test-html",
      repo_root: fixturePath("node-cli"),
      output_root: fixturePath("node-cli"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
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

    const html = renderHtmlReport(contextIndex);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("</html>");
    expect(html).toContain("Repo Overview");
    expect(html).toContain("Commands");
    expect(html).toContain("First Read Path");
    expect(html).toContain("Key Paths");
    expect(html).toContain("Entrypoints");
    expect(html).toContain("Defer For Now");
  });

  it("escapes HTML special characters in content", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "test-html-escape",
      repo_root: fixturePath("node-cli"),
      output_root: fixturePath("node-cli"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
    const contextIndex = {
      schema_version: comprehension.schema_version,
      repo: {
        ...comprehension.repo,
        name: "Test <script>alert('xss')</script>",
      },
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

    const html = renderHtmlReport(contextIndex);

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders confidence badges for medium and low confidence items", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "test-html-confidence",
      repo_root: fixturePath("node-cli"),
      output_root: fixturePath("node-cli"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
    const contextIndex = {
      schema_version: comprehension.schema_version,
      repo: comprehension.repo,
      meta: comprehension.meta,
      artifacts: comprehension.artifacts,
      graph: comprehension.graph,
      entrypoints: comprehension.entrypoints.map((e) => ({ ...e, confidence: "medium" as const })),
      first_read_path: comprehension.first_read_path,
      key_paths: comprehension.key_paths,
      critical_paths: comprehension.critical_paths,
      defer_for_now: comprehension.defer_for_now,
      agent_hints: comprehension.agent_hints,
    };

    const html = renderHtmlReport(contextIndex);

    expect(html).toContain("confidence-medium");
    expect(html).toContain("medium</span>");
  });

  it("renders nextjs-app fixture with nextjs framework", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "test-html-nextjs",
      repo_root: fixturePath("nextjs-app"),
      output_root: fixturePath("nextjs-app"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
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

    const html = renderHtmlReport(contextIndex);

    expect(html).toContain("nextjs");
  });
});
