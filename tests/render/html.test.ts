import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildComprehension } from "../../src/comprehend/index.js";
import { extractSignals } from "../../src/extract/index.js";
import { normalizeRepoInput } from "../../src/input/index.js";
import { renderContextIndex, renderHtmlReport } from "../../src/render/index.js";
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
    const contextIndex = renderContextIndex(comprehension);

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
    const contextIndex = renderContextIndex({
      ...comprehension,
      repo: {
        ...comprehension.repo,
        name: "Test <script>alert('xss')</script>",
      },
    });

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
    const contextIndex = renderContextIndex({
      ...comprehension,
      entrypoints: comprehension.entrypoints.map((e) => ({ ...e, confidence: "medium" as const })),
    });

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
    const contextIndex = renderContextIndex(comprehension);

    const html = renderHtmlReport(contextIndex);

    expect(html).toContain("nextjs");
  });

  it("renders critical paths section when present", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "test-html-critical",
      repo_root: fixturePath("nextjs-app"),
      output_root: fixturePath("nextjs-app"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);

    expect(comprehension.critical_paths.length).toBeGreaterThan(0);

    const contextIndex = renderContextIndex(comprehension);
    const html = renderHtmlReport(contextIndex);

    expect(html).toContain("Critical Paths");
  });

  it("renders empty defer_for_now state message", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "test-html-defer",
      repo_root: fixturePath("node-cli"),
      output_root: fixturePath("node-cli"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
    const contextIndex = renderContextIndex({
      ...comprehension,
      defer_for_now: [],
    });

    const html = renderHtmlReport(contextIndex);

    expect(html).toContain("No paths marked for deferral");
  });

  it("renders empty commands state message", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "test-html-no-commands",
      repo_root: fixturePath("node-cli"),
      output_root: fixturePath("node-cli"),
    });
    const scan = await scanRepository(input);
    const signals = await extractSignals(scan);
    const comprehension = buildComprehension(input, scan, signals);
    const contextIndex = renderContextIndex({
      ...comprehension,
      artifacts: { manifests: comprehension.artifacts.manifests, commands: [] },
    });

    const html = renderHtmlReport(contextIndex);

    expect(html).toContain("No commands detected");
  });
});
