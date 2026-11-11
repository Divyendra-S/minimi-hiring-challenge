import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { z } from "zod";
import type { Search, SearchHit } from "@/adapters/tavily";
import type { Source } from "@/shared/events";

const MAX_CHARS_PER_RESULT = 1200;
// Snippets shorter than this are too generic to tell two pages apart by their text.
const MIN_FINGERPRINT_CHARS = 80;

export const WebSearchArgs = z.object({
  queries: z
    .array(z.string().min(1))
    .min(1)
    .max(4)
    .describe("1-4 short search-engine queries, each about one thing. They run in parallel."),
  recency: z
    .enum(["day", "week", "month", "year"])
    .optional()
    .describe(
      "Only pages published in this window. Use for news and announcements. Leave unset for " +
        "prices and docs: those pages keep old publish dates and would be filtered out.",
    ),
  fresh: z
    .boolean()
    .optional()
    .describe(
      "Re-fetch pages that change in place (pricing, plans, docs, changelogs) unless they were " +
        "fetched in the last day. Use when the answer must be current, e.g. 'has it changed since'. " +
        "Slower, so leave it off otherwise.",
    ),
});
export type WebSearchArgs = z.infer<typeof WebSearchArgs>;

// One schema drives both what the model sees and how its arguments are validated.
const { $schema: _, ...parameters } = z.toJSONSchema(WebSearchArgs);

export const webSearchTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current or specific facts: prices, releases, versions, news, " +
      "companies, people, docs. Results are numbered for citation.",
    parameters,
  },
};

/**
 * Runs a call's queries in parallel and formats the results for the model, wrapped in a tag so
 * the model treats them as data. New pages are appended to `sources`, which is shared by every
 * call in the turn, so each page keeps one number.
 */
export async function webSearch(
  search: Search,
  args: WebSearchArgs,
  sources: Source[],
  signal?: AbortSignal,
): Promise<string> {
  const { recency, fresh } = args;
  const settled = await Promise.allSettled(
    args.queries.map((query) => search(query, { recency, fresh, signal })),
  );
  const blocks = settled.map((outcome, i) => {
    if (outcome.status === "rejected") {
      return `Query "${args.queries[i]}" failed: ${errorMessage(outcome.reason)}`;
    }
    const hits = distinct(outcome.value).map((hit) => formatHit(numberFor(sources, hit), hit));
    return `Query "${args.queries[i]}":\n${hits.join("\n\n") || "No results."}`;
  });
  return `<search_results>\n${blocks.join("\n\n")}\n</search_results>`;
}

/**
 * Search results often repeat one page: over http and https, with and without "www.", or on a
 * mirror. Seen live: 5 results for one query were all Neon's pricing page.
 */
function distinct(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const text = hit.content.trim().slice(0, 300);
    const keys =
      text.length >= MIN_FINGERPRINT_CHARS ? [pageKey(hit.url), text] : [pageKey(hit.url)];
    if (keys.some((key) => seen.has(key))) return false;
    for (const key of keys) seen.add(key);
    return true;
  });
}

/** The same key for every spelling of a page's address: scheme, "www.", trailing slash, #hash. */
function pageKey(url: string): string {
  if (!URL.canParse(url)) return url;
  const { hostname, pathname, search } = new URL(url);
  return `${hostname.replace(/^www\./, "")}${pathname.replace(/\/+$/, "")}${search}`;
}

function numberFor(sources: Source[], hit: SearchHit): number {
  const existing = sources.find((source) => pageKey(source.url) === pageKey(hit.url));
  if (existing) return existing.n;
  const source = {
    n: sources.length + 1,
    title: hit.title,
    url: hit.url,
    published: hit.published,
  };
  sources.push(source);
  return source.n;
}

function formatHit(n: number, hit: SearchHit): string {
  const published = hit.published ? `\nPublished: ${hit.published}` : "";
  return `[${n}] ${hit.title}\nURL: ${hit.url}${published}\n${hit.content.slice(0, MAX_CHARS_PER_RESULT)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
