import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PipelineCache } from "../../src/mcp/cache.js";
import type { CacheEntry } from "../../src/mcp/pipeline.js";

describe("PipelineCache", () => {
  let cache: PipelineCache;
  const fakeEntry = Promise.resolve({
    input: {},
    scan: { paths: [] },
    intentMap: { categories: [] },
    signals: { edges: [] },
    comprehension: { key_paths: [] },
    contextIndex: { entrypoints: [] },
  } as unknown as CacheEntry);

  afterEach(() => {
    cache.clear();
  });

  describe("makeKey", () => {
    it("resolves relative paths to absolute", () => {
      cache = new PipelineCache();
      const key = cache.makeKey(".", [], []);
      expect(key.startsWith(path.resolve("."))).toBe(true);
    });

    it("includes include and exclude in the key", () => {
      cache = new PipelineCache();
      const keyA = cache.makeKey("/repo", ["src"], []);
      const keyB = cache.makeKey("/repo", ["dist"], []);
      expect(keyA).not.toBe(keyB);
    });

    it("is insensitive to include/exclude order", () => {
      cache = new PipelineCache();
      const keyA = cache.makeKey("/repo", ["a", "b"], ["c"]);
      const keyB = cache.makeKey("/repo", ["b", "a"], ["c"]);
      expect(keyA).toBe(keyB);
    });
  });

  describe("get / set", () => {
    it("returns undefined for unknown key", () => {
      cache = new PipelineCache();
      expect(cache.get("nope")).toBeUndefined();
    });

    it("returns the entry for a known key", () => {
      cache = new PipelineCache();
      const key = "test-key";
      cache.set(key, fakeEntry);
      expect(cache.get(key)).toBe(fakeEntry);
    });

    it("overwrites existing entry on re-set", () => {
      cache = new PipelineCache();
      const key = "test-key";
      const second = Promise.resolve({} as CacheEntry);
      cache.set(key, fakeEntry);
      cache.set(key, second);
      expect(cache.get(key)).toBe(second);
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      cache = new PipelineCache();
      cache.set("a", fakeEntry);
      cache.set("b", fakeEntry);
      cache.clear();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
    });
  });

  describe("concurrent access", () => {
    it("shares a single Promise for concurrent requests to the same key", () => {
      cache = new PipelineCache();
      const key = "concurrent-key";
      const entry = Promise.resolve({
        input: {},
        scan: { paths: [] },
        intentMap: { entries: [] },
        signals: { edges: [] },
        comprehension: { key_paths: [] },
        contextIndex: { entrypoints: [] },
      } as unknown as CacheEntry);

      cache.set(key, entry);
      const a = cache.get(key);
      const b = cache.get(key);

      expect(a).toBe(b);
      expect(a).toBe(entry);
    });
  });
});
