import type { Source } from "@/shared/events";

const CITATION = /\[(\d+)\](?!\()/g; // [3], but not the [text](url) of a markdown link

/** Turns [n] into a markdown link to source n, so citations are clickable. */
export function linkCitations(text: string, sources: Source[]): string {
  return text.replace(CITATION, (match, n: string) => {
    const source = sources.find((s) => s.n === Number(n));
    return source ? `[[${n}]](${source.url})` : match;
  });
}

/** The sources the answer actually cites, in number order. */
export function citedSources(text: string, sources: Source[]): Source[] {
  const cited = new Set(Array.from(text.matchAll(CITATION), (m) => Number(m[1])));
  return sources.filter((s) => cited.has(s.n));
}
