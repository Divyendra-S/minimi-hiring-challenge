import type { Search, SearchHit } from "@/adapters/tavily";

const TTL_MS = 10 * 60_000;

export type SearchCache = Map<string, { at: number; hits: SearchHit[] }>;

/**
 * Reuses a query's results for 10 minutes. Follow-ups and re-asks often repeat a query, and
 * every search costs time and a credit. Failed searches are not cached.
 */
export function cachedSearch(search: Search, cache: SearchCache, now = Date.now): Search {
  return async (query, options) => {
    const key = JSON.stringify([
      query.trim().replace(/\s+/g, " ").toLowerCase(),
      options.recency ?? null,
      options.fresh ?? false,
      options.sites ?? [],
    ]);
    const entry = cache.get(key);
    if (entry && now() - entry.at < TTL_MS) return entry.hits;

    const hits = await search(query, options);
    // Re-inserting keeps the Map in write order, so expired entries are always at the front.
    cache.delete(key);
    cache.set(key, { at: now(), hits });
    for (const [oldKey, old] of cache) {
      if (now() - old.at < TTL_MS) break;
      cache.delete(oldKey);
    }
    return hits;
  };
}
