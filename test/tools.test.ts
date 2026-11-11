import assert from "node:assert/strict";
import { test } from "node:test";
import type { SearchHit, SearchOptions } from "@/adapters/tavily";
import { webSearch } from "@/core/agent/tools";

test("a search with a site searches only its domain, and fetches the pages live", async () => {
  const seen: SearchOptions[] = [];
  const search = async (_query: string, options: SearchOptions) => {
    seen.push(options);
    return [];
  };
  const searches = [
    { query: "Neon pricing", site: "https://www.neon.com/pricing" },
    { query: "Neon news", recency: "week" as const },
  ];
  await webSearch(search, { searches }, []);
  assert.deepEqual(seen[0]?.sites, ["neon.com"]);
  assert.equal(seen[0]?.fresh, true);
  assert.equal(seen[1]?.sites, undefined);
  assert.equal(seen[1]?.fresh, false);
  assert.equal(seen[1]?.recency, "week");
});

test("each search shows at most four pages", async () => {
  const pages: SearchHit[] = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: `Page ${n}`,
    url: `https://example.com/${n}`,
    content: "",
  }));
  const text = await webSearch(async () => pages, { searches: [{ query: "anything" }] }, []);
  assert.ok(text.includes("[4] Page 4") && !text.includes("Page 5"), text);
});
