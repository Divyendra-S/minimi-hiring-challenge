import assert from "node:assert/strict";
import { test } from "node:test";
import type { Search } from "@/adapters/tavily";
import { cachedSearch, type SearchCache } from "@/core/agent/cache";

const TEN_MINUTES = 10 * 60_000;

function countingSearch() {
  const calls: string[] = [];
  const search: Search = async (query) => {
    calls.push(query);
    return [{ title: query, url: `https://example.com/${query}`, content: "" }];
  };
  return { search, calls };
}

test("reuses a query's results for ten minutes", async () => {
  const { search, calls } = countingSearch();
  let clock = 0;
  const cached = cachedSearch(search, new Map(), () => clock);

  await cached("Neon  pricing", {});
  await cached("neon pricing", {}); // same query after normalising case and spaces
  assert.equal(calls.length, 1);

  await cached("neon pricing", { fresh: true }); // different options, different entry
  assert.equal(calls.length, 2);

  clock = TEN_MINUTES;
  await cached("neon pricing", {});
  assert.equal(calls.length, 3);
});

test("doesn't cache failures, and drops expired entries", async () => {
  let fail = true;
  let clock = 0;
  const cache: SearchCache = new Map();
  const cached = cachedSearch(
    async (query) => {
      if (fail) throw new Error("Tavily 500");
      return [{ title: query, url: "https://example.com", content: "" }];
    },
    cache,
    () => clock,
  );

  await assert.rejects(cached("a", {}));
  assert.equal(cache.size, 0);

  fail = false;
  await cached("a", {});
  clock = TEN_MINUTES;
  await cached("b", {});
  assert.deepEqual([...cache.keys()], [JSON.stringify(["b", null, false])]);
});
