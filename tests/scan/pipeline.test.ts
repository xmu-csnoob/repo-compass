import { describe, expect, it } from "vitest";

import { normalizeRepoInput } from "../../src/input/index.js";
import { scanRepository } from "../../src/scan/index.js";

describe("scanRepository", () => {
  it("enforces max_files from the frozen repo input contract", async () => {
    const input = normalizeRepoInput({
      schema_version: "1.0",
      run_id: "run-max-files",
      repo_root: "tests/fixtures/node-cli",
      output_root: "tests/fixtures/node-cli",
      max_files: 1,
    });

    await expect(scanRepository(input)).rejects.toThrow(/max_files/u);
  });
});
