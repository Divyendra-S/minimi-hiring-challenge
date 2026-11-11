import { z } from "zod";

export type Recency = "day" | "week" | "month" | "year";
export type SearchOptions = {
  recency?: Recency;
  fresh?: boolean;
  /** Only these domains, e.g. "neon.com". */
  sites?: string[];
  signal?: AbortSignal;
};
export type SearchHit = { title: string; url: string; content: string; published?: string };
export type Search = (query: string, options: SearchOptions) => Promise<SearchHit[]>;
/** Fetches these pages as they are now and returns the parts of each that are about `query`. */
export type Read = (urls: string[], query: string, signal?: AbortSignal) => Promise<SearchHit[]>;

const TIMEOUT_MS = 10_000;
// "fresh" accepts Tavily's copy of a page if it was fetched within this window, else fetches it live.
const FRESH_MAX_AGE_HOURS = 24;
// A live fetch usually takes 0.5 to 2 s. Past this the answer goes ahead on Tavily's copy.
const LIVE_TIMEOUT_MS = 2_500;

// Per page: the four passages, of about 800 characters each, closest to the query.
const CHUNKS_PER_PAGE = 4;

const TavilyResponse = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      published_date: z.string().nullish(),
    }),
  ),
});

export function tavily(apiKey: string): Search {
  return async (query, { recency, fresh, sites, signal }) => {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const stop = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const post = (body: object, signal: AbortSignal) =>
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    const body = {
      query,
      // Measured on our queries: "fast" answers in about 0.6 s, "basic" in 1.4 to 2.3 s, with
      // results of similar length.
      search_depth: "fast",
      max_results: 5,
      time_range: recency,
      include_domains: sites?.length ? sites : undefined,
      include_published_date: true,
    };

    const hits = async (body: object, signal = stop): Promise<SearchHit[]> => {
      const res = await post(body, signal);
      if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const { results } = TavilyResponse.parse(await res.json());
      return results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        published: r.published_date ?? undefined,
      }));
    };

    try {
      if (!fresh) return await hits(body);
      // A live search alone returns fewer pages (measured: 1 to 3 where the normal one gave 5),
      // and free plans may refuse it under load. So a second search runs at once, at "basic"
      // depth. Measured on one site each: "fast" gave Apple's Hong Kong store, Zoho's prices in
      // rupees and a 2019 Node post in five languages; "basic" gave the US and English pages on
      // 3 of 3, in 2.3 to 4.6 s. Live at "basic" took 3.4 to 4.6 s and found no page for Neon.
      const [live, thorough] = await Promise.allSettled([
        hits(
          { ...body, max_age_hours: FRESH_MAX_AGE_HOURS },
          AbortSignal.any([stop, AbortSignal.timeout(LIVE_TIMEOUT_MS)]),
        ),
        hits({ ...body, search_depth: "basic" }),
      ]);
      if (live.status === "rejected" && thorough.status === "rejected") throw thorough.reason;
      const [a, b] = [live, thorough].map((o) => (o.status === "fulfilled" ? o.value : []));
      // Taken in turn, so that neither search fills the few places alone. The caller drops
      // repeated pages.
      const longer = a.length > b.length ? a : b;
      return longer.flatMap((_, i) => [a[i], b[i]].flatMap((hit) => hit ?? []));
    } catch (error) {
      if (timeout.aborted) throw new Error(`Tavily didn't answer within ${TIMEOUT_MS / 1000} s`);
      throw error;
    }
  };
}

const ExtractResponse = z.object({
  results: z.array(z.object({ url: z.string(), raw_content: z.string() })),
});

/** Tavily's Extract API: one request reads up to 20 pages. Pages it can't fetch are left out. */
export function tavilyReader(apiKey: string): Read {
  return async (urls, query, signal) => {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ urls, query, chunks_per_source: CHUNKS_PER_PAGE }),
      signal,
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { results } = ExtractResponse.parse(await res.json());
    return results.map((page) => ({
      title: titleOf(page.url),
      url: page.url,
      content: page.raw_content,
    }));
  };
}

/** Extract returns no page title, so the address stands in: "neon.com/pricing". */
function titleOf(url: string): string {
  if (!URL.canParse(url)) return url;
  const { hostname, pathname } = new URL(url);
  return `${hostname.replace(/^www\./, "")}${pathname.replace(/\/+$/, "")}`;
}
