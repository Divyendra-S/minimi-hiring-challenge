import type { Source } from "@/shared/events";

export function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <ol className="mt-3 flex flex-wrap gap-2 text-xs">
      {sources.map((source) => (
        <li key={source.n}>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            title={source.title}
            className="block rounded-full border border-neutral-200 px-2.5 py-1 text-neutral-600 hover:bg-neutral-50"
          >
            {source.n}. {new URL(source.url).hostname.replace(/^www\./, "")}
          </a>
        </li>
      ))}
    </ol>
  );
}
