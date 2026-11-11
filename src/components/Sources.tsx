import type { Source } from "@/shared/events";

export function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-surface-2/20 pt-2.5">
      <span className="text-[10px] text-text-tertiary">Sources:</span>
      <ol className="contents">
        {sources.map((source) => (
          <li key={source.n}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={source.title}
              className="flex max-w-56 items-center gap-1 rounded-full bg-white px-2 py-[3px] text-[11px] text-text-tertiary shadow-ring transition-[box-shadow,color] duration-200 hover:text-accent hover:shadow-ring-hover"
            >
              <span className="font-medium text-text-secondary">{source.n}</span>
              <span className="truncate">{hostname(source.url)}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
