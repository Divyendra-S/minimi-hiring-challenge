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

test("a search that names a recent date is limited to that time", async () => {
  const now = new Date("2026-11-12T15:00:00Z");
  const seen: SearchOptions[] = [];
  const search = async (_query: string, options: SearchOptions) => {
    seen.push(options);
    return [];
  };
  const searches = [
    { query: "OpenAI news November 10 2026 announcement" },
    { query: "November 2026 OpenAI announcement" },
    { query: "OpenAI DevDay November 6 2023" },
    { query: "Neon pricing 2026" },
    { query: "Linear pricing per user Standard plan" },
    { query: "Jira price November 2026", site: "atlassian.com" },
    { query: "OpenAI news November 10 2026", recency: "day" as const },
    { query: "OpenAI announced November 9 10 11 2026" },
  ];
  await webSearch(search, { searches }, [], undefined, now);
  assert.deepEqual(
    seen.map((options) => options.recency),
    ["week", "month", undefined, undefined, undefined, undefined, "day", "week"],
  );
});

test("results pages of search engines are dropped, and ad links are one page", async () => {
  const pages: SearchHit[] = [
    "https://duckduckgo.com/html?q=OpenAI+news",
    "https://www.atlassian.com/software/jira/pricing",
    "https://www.atlassian.com/software/jira/pricing?aceid=&adgroup=140509303366&gclsrc=aw.ds",
    "https://cloud.google.com/sql/pricing",
    "https://example.com/watch?v=abc",
    "https://example.com/watch?v=xyz",
  ].map((url, n) => ({ title: `Page ${n}`, url, content: "" }));
  const sources: { n: number; title: string; url: string }[] = [];
  const search = async (query: string) => (query === "first" ? pages.slice(0, 4) : pages.slice(2));
  await webSearch(search, { searches: [{ query: "first" }, { query: "second" }] }, sources);
  assert.deepEqual(
    sources.map((source) => source.url),
    [
      "https://www.atlassian.com/software/jira/pricing",
      "https://cloud.google.com/sql/pricing",
      "https://example.com/watch?v=abc",
      "https://example.com/watch?v=xyz",
    ],
  );
});
