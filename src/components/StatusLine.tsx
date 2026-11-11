export function StatusLine({ searching }: { searching: string[] }) {
  return (
    <p className="animate-pulse text-sm text-neutral-500">
      {searching.length > 0 ? `Searching: ${searching.join(" · ")}` : "Thinking..."}
    </p>
  );
}
