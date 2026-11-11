/** What the agent is doing before the first word arrives: Kuro's tool-step timeline. */
export function StatusLine({ searching }: { searching: string[] }) {
  const queries = [...new Set(searching)];
  return (
    <div role="status">
      {queries.length > 0 && (
        <ol className="relative mb-2 space-y-2 pl-5">
          {queries.length > 1 && (
            <span className="absolute top-1.5 bottom-1.5 left-[4px] w-px bg-surface-2/60" />
          )}
          {queries.map((query) => (
            <li
              key={query}
              className="relative flex items-center text-[12px] motion-safe:animate-fade-up"
            >
              <span className="absolute -left-5 flex size-[9px] items-center justify-center">
                <span className="absolute size-[11px] rounded-full bg-accent/30 motion-safe:animate-ping" />
                <span className="size-[9px] rounded-full bg-accent" />
              </span>
              <span className="truncate text-text-tertiary">Searching: "{query}"</span>
            </li>
          ))}
        </ol>
      )}
      <span className="step-shimmer text-[13px]">
        {queries.length > 0 ? "Searching the web…" : "Thinking…"}
      </span>
    </div>
  );
}
