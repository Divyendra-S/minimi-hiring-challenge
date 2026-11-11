import type { Read, SearchHit } from "@/adapters/tavily";
import type { Source } from "@/shared/events";

// Measured live: a page arrives in 1 to 1.5 s, and a slow one in 3 s or more. Pages that miss
// this are left out, and the model can still search for them.
const TIMEOUT_MS = 2_000;
const MAX_CHARS_PER_PAGE = 3_200;

// The user asks whether something is still so ("has it changed since", "still correct",
// "did it get cheaper") ...
const ASKS_ABOUT_CHANGE =
  /\b(still|chang\w*|since|any ?more|(go|goes|went|gone) (up|down)|rais\w*|increas\w*|drop\w*|cheaper|pricier|updat\w*|up to date|outdated)\b/i;
// ... and it is something a web page can settle, not something only the user knows.
const ABOUT_A_WEB_FACT =
  /\b(pric\w*|cost\w*|plans?|fees?|cheaper|pricier|versions?|releas\w*|shipp\w*|launch\w*|answers?|correct|accurate|true|valid|up to date|outdated)\b|[$€£]/i;

/**
 * Whether the message asks if remembered web facts still hold. A rule in code, so that the pages
 * can be fetched before the model runs. When it misses, nothing is lost: the model searches as
 * it always did. When it fires for nothing, the cost is one page fetch.
 */
export function asksIfStillTrue(message: string): boolean {
  return ASKS_ABOUT_CHANGE.test(message) && ABOUT_A_WEB_FACT.test(message);
}

// The user points at values from an earlier answer ("at the prices you gave me", "what did you
// say it costs", "between two of our conversations") ...
const POINTS_AT_AN_EARLIER_ANSWER =
  /\b(prices?|costs?|numbers?|figures?|rates?|quotes?) (that )?you (gave|told|quoted|showed|said)\b|\b(what|how (much|many|long)) did you (say|tell|quote)\b|\bbetween (two of )?our (conversations|chats)\b/i;
// ... and nothing in the message asks about the present.
const ASKS_ABOUT_NOW =
  /\b(still|now|today|current(ly)?|since|any ?more|these days|up to date|outdated|check|verify|search|look up)\b/i;

/**
 * Whether the message asks only for values the agent gave before, so no web page can answer it.
 * The search tool is then not offered. Seen live: told so in the prompt, in two wordings, the
 * model still searched on 3 of 3 such questions; the answers were right but took 4 to 5 s
 * instead of 2. When this misses, the model decides as it always did.
 */
export function asksOnlyForRemembered(message: string): boolean {
  return POINTS_AT_AN_EARLIER_ANSWER.test(message) && !ASKS_ABOUT_NOW.test(message);
}

/**
 * Fetches the sources of the recalled claims as they are now, so the model can compare old and
 * new in its first call instead of spending a call on asking for a search. Returns the block to
 * put in the prompt, and adds the pages to `sources` so the answer can cite them.
 */
export async function recheck(
  read: Read,
  claims: { text: string; url: string }[],
  sources: Source[],
  signal?: AbortSignal,
): Promise<string | undefined> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const stop = signal ? AbortSignal.any([signal, timeout]) : timeout;
  // Each page is asked for the passages about its own claim. Seen live: asked with the user's
  // question ("is it still $999?"), the passages returned often left the price out, and the
  // model searched again.
  const settled = await Promise.allSettled(claims.map((c) => read([c.url], c.text, stop)));
  signal?.throwIfAborted();
  const pages: SearchHit[] = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const failed = settled.find((s) => s.status === "rejected");
  if (failed) console.warn("Re-check of a remembered source failed:", failed.reason);
  if (pages.length === 0) return undefined;
  const blocks = pages.map((page) => {
    const source = { n: sources.length + 1, title: page.title, url: page.url };
    sources.push(source);
    return `[${source.n}] ${page.url}\n${page.content.slice(0, MAX_CHARS_PER_PAGE)}`;
  });
  return `<pages_now>\n${blocks.join("\n\n")}\n</pages_now>`;
}
