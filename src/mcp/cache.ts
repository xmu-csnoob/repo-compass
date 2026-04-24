import path from "node:path";

import type { CacheEntry } from "./pipeline.js";

/**
 * Session-scoped pipeline result cache.
 *
 * Caches the full pipeline result (CacheEntry) for each unique
 * (repo_root, include, exclude) tuple. Concurrent requests for
 * the same key share a single Promise<CacheEntry>.
 */
export class PipelineCache {
  private entries = new Map<string, Promise<CacheEntry>>();

  makeKey(
    repoRoot: string,
    include: readonly string[],
    exclude: readonly string[],
  ): string {
    const resolved = path.resolve(repoRoot);
    const inc = [...include].sort().join(",");
    const exc = [...exclude].sort().join(",");
    return `${resolved}::${inc}::${exc}`;
  }

  get(key: string): Promise<CacheEntry> | undefined {
    return this.entries.get(key);
  }

  set(key: string, entry: Promise<CacheEntry>): void {
    this.entries.set(key, entry);
  }

  clear(): void {
    this.entries.clear();
  }
}
