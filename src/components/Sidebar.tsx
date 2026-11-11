import { useLoadDemo, useSessions } from "@/client/queries";
import { isDemo } from "@/shared/dto";

type Props = { selectedId: string | null; onSelect: (id: string | null) => void };

export function Sidebar({ selectedId, onSelect }: Props) {
  const sessions = useSessions();
  const loadDemo = useLoadDemo();
  return (
    <nav className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 md:flex">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="m-3 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm hover:bg-neutral-100"
      >
        New chat
      </button>
      <ul className="flex-1 overflow-y-auto px-2 pb-3">
        {sessions.data?.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => onSelect(session.id)}
              aria-current={session.id === selectedId ? "page" : undefined}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-200 aria-[current=page]:bg-neutral-200"
            >
              <span className="block truncate">{session.title}</span>
              <span className="text-xs text-neutral-500">
                {new Date(session.updatedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {sessions.data && !sessions.data.some(isDemo) && (
        <div className="m-3 space-y-2 text-xs text-neutral-500">
          <p>To try recall, add 31 demo chats from the past eight weeks.</p>
          <button
            type="button"
            onClick={() => loadDemo.mutate()}
            disabled={loadDemo.isPending}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Load demo history
          </button>
          {loadDemo.isError && <p className="text-red-700">{loadDemo.error.message}</p>}
        </div>
      )}
    </nav>
  );
}
