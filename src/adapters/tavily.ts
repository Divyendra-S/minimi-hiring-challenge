import { z } from "zod";

export type Recency = "day" | "week" | "month" | "year";
export type SearchOptions = { recency?: Recency; fresh?: boolean; signal?: AbortSignal };
export type SearchHit = { title: string; url: string; content: string; published?: string };
export type Search = (query: string, options: SearchOptions) => Promise<SearchHit[]>;

const TIMEOUT_MS = 10_000;
// "fresh" accepts Tavily's copy of a page if it was fetched within this window, else fetches it live.
const FRESH_MAX_AGE_HOURS = 24;

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
  return async (query, { recency, fresh, signal }) => {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const post = (body: object) =>
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    const body = {
      query,
      search_depth: "basic", // 1 credit; "advanced" costs 2
      max_results: 5,
      time_range: recency,
      include_published_date: true,
    };

    try {
      let res = await post(fresh ? { ...body, max_age_hours: FRESH_MAX_AGE_HOURS } : body);
      // Free plans may refuse live fetching under load (434). Cached copies beat no results.
      if (res.status === 434 && fresh) {
        await res.body?.cancel();
        res = await post(body);
      }
      if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const { results } = TavilyResponse.parse(await res.json());
      return results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        published: r.published_date ?? undefined,
      }));
    } catch (error) {
      if (timeout.aborted) throw new Error(`Tavily didn't answer within ${TIMEOUT_MS / 1000} s`);
      throw error;
    }
  };
}
