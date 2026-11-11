import * as chrono from "chrono-node";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { z } from "zod";
import type { Recency, Search, SearchHit } from "@/adapters/tavily";
import type { Source } from "@/shared/events";

const MAX_CHARS_PER_RESULT = 1200;
// A live search adds its pages to the usual five. More than this per search makes the last model
// call slow: ten searches of eight pages each took it 6 s.
const MAX_RESULTS_PER_SEARCH = 4;
// Snippets shorter than this are too generic to tell two pages apart by their text.
const MIN_FINGERPRINT_CHARS = 80;
const DAY_MS = 86_400_000;
// A link from an ad or a newsletter carries these, and is the same page without them. Seen
// live: Jira's pricing page came back three times, twice with a Google Ads click in its address.
const TRACKING_PARAM = /^\??(utm_|ds_|__hs|gcl|fbclid|msclkid|aceid|cmid)/i;
// A search engine's own results page is not a source. Seen live: duckduckgo.com/html?q=... was
// a hit on 3 of 4 news searches.
const SEARCH_ENGINE = /(^|\.)(duckduckgo|google|bing|yahoo)\.[a-z.]+$/i;

const SearchArgs = z.object({
  query: z.string().min(1).describe("A short search-engine query about one thing."),
  site: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Search only this domain, e.g. 'neon.com', and fetch its pages live. Use it to check a " +
        "price or plan on the vendor's own site: when a saved memory gives a source, pass that " +
        "source's domain.",
    ),
  recency: z
    .enum(["day", "week", "month", "year"])
    .optional()
    .describe(
      "Only pages published in this window. Use for news and announcements. Leave unset for " +
        "prices and docs: those pages keep old publish dates and would be filtered out.",
    ),
});

export const WebSearchArgs = z.object({
  searches: z
    .array(SearchArgs)
    .min(1)
    .max(10)
    .describe(
      "Everything the question needs, in one call of at most 10 searches: they run in " +
        "parallel. E.g. for five products, one search per product's pricing (with `site`), and " +
        "one per product for news (with `recency`) if the user asks what is new.",
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
      "companies, people, docs. Results are numbered for citation. Not for recalling what the " +
      "user said, chose or was told earlier: that is in the context, and needs no search " +
      "unless they ask whether it is still true.",
    parameters,
  },
};

/**
 * Runs a call's searches in parallel and formats the results for the model, wrapped in a tag so
 * the model treats them as data. New pages are appended to `sources`, which is shared by every
 * call in the turn, so each page keeps one number.
 */
export async function webSearch(
  search: Search,
  args: WebSearchArgs,
  sources: Source[],
  signal?: AbortSignal,
  now = new Date(),
): Promise<string> {
  const settled = await Promise.allSettled(
    args.searches.map(({ query, site, recency }) => {
      const domain = site && domainOf(site);
      // A named site is asked for its page as it is now: that is the point of going to the source.
      return search(query, {
        recency: recency ?? (domain ? undefined : windowOf(query, now)),
        fresh: Boolean(domain),
        sites: domain ? [domain] : undefined,
        signal,
      });
    }),
  );
  const blocks = settled.map((outcome, i) => {
    const query = args.searches[i]?.query;
    if (outcome.status === "rejected") {
      return `Query "${query}" failed: ${errorMessage(outcome.reason)}`;
    }
    const hits = distinct(outcome.value.filter((hit) => !isResultsPage(hit.url)))
      .slice(0, MAX_RESULTS_PER_SEARCH)
      .map((hit) => formatHit(numberFor(sources, hit), hit));
    return `Query "${query}":\n${hits.join("\n\n") || "No results."}`;
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

/**
 * The time window for a search that names a recent date but sets no `recency`. Seen live: asked
 * for "this week", the model wrote "OpenAI news November 10 2026" and searched all time; 4 of 4
 * searches returned pages from 2023 or results pages. The same queries with a one-week window
 * returned that week's announcements. A named day in the last week gives "week"; a day or a
 * month ("November 2026") in the last 31 days gives "month". Searches with a `site` are left
 * alone: pricing and docs pages keep old publish dates.
 */
function windowOf(query: string, now: Date): Recency | undefined {
  // The model also lists days, "November 9 10 11 2026", which chrono reads as 9 Nov 2010: the
  // first day and the year are kept.
  const [newest] = chrono
    .parse(query.replace(/\b(\d{1,2})(?: \d{1,2})+(?= \d{4}\b)/, "$1"), now)
    .filter((result) => result.start.isCertain("month"))
    .map(({ start }) => ({
      daysAgo: (now.getTime() - start.date().getTime()) / DAY_MS,
      namesDay: start.isCertain("day"),
    }))
    .filter(({ daysAgo }) => daysAgo >= -1 && daysAgo <= 31)
    .sort((a, b) => a.daysAgo - b.daysAgo);
  if (!newest) return undefined;
  return newest.namesDay && newest.daysAgo <= 7 ? "week" : "month";
}

function isResultsPage(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { hostname, searchParams } = new URL(url);
  return SEARCH_ENGINE.test(hostname) && searchParams.has("q");
}

/** The same key for every spelling of a page's address: scheme, "www.", trailing slash, #hash. */
function pageKey(url: string): string {
  if (!URL.canParse(url)) return url;
  const { hostname, pathname, search } = new URL(withoutTracking(url));
  return `${hostname.replace(/^www\./, "")}${pathname.replace(/\/+$/, "")}${search}`;
}

/** The address without its query string, when that string holds an ad or newsletter click. */
function withoutTracking(url: string): string {
  if (!URL.canParse(url)) return url;
  const parsed = new URL(url);
  if (![...parsed.searchParams.keys()].some((key) => TRACKING_PARAM.test(key))) return url;
  parsed.search = "";
  return parsed.toString();
}

/** "neon.com" from "neon.com", "www.neon.com" or "https://neon.com/pricing". */
function domainOf(site: string): string | undefined {
  const url = site.includes("://") ? site : `https://${site}`;
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : undefined;
}

function numberFor(sources: Source[], hit: SearchHit): number {
  const existing = sources.find((source) => pageKey(source.url) === pageKey(hit.url));
  if (existing) return existing.n;
  const source = {
    n: sources.length + 1,
    title: hit.title,
    url: withoutTracking(hit.url),
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
