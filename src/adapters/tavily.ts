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

const TIMEOUT_MS = 10_000;
// "fresh" accepts Tavily's copy of a page if it was fetched within this window, else fetches it live.
const FRESH_MAX_AGE_HOURS = 24;
// A live fetch usually takes 0.5 to 2 s. Past this the answer goes ahead on Tavily's copy.
const LIVE_TIMEOUT_MS = 2_500;

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
      // and free plans may refuse it under load. So both run at once: live pages first, then
      // the rest. The caller drops repeated pages.
      const [live, cached] = await Promise.allSettled([
        hits(
          { ...body, max_age_hours: FRESH_MAX_AGE_HOURS },
          AbortSignal.any([stop, AbortSignal.timeout(LIVE_TIMEOUT_MS)]),
        ),
        hits(body),
      ]);
      if (live.status === "rejected" && cached.status === "rejected") throw cached.reason;
      return [live, cached].flatMap((outcome) =>
        outcome.status === "fulfilled" ? outcome.value : [],
      );
    } catch (error) {
      if (timeout.aborted) throw new Error(`Tavily didn't answer within ${TIMEOUT_MS / 1000} s`);
      throw error;
    }
  };
}
