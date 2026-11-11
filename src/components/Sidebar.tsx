import { useLoadDemo, useSessions } from "@/client/queries";
import { DEMO_TITLE, isDemo, type SessionSummary } from "@/shared/dto";
import { DatabaseIcon, MarkIcon, PlusIcon } from "./icons";

type Props = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Below the md breakpoint the sidebar is a drawer, shown only while open. */
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ selectedId, onSelect, open, onClose }: Props) {
  const sessions = useSessions();
  const loadDemo = useLoadDemo();
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close chats"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-text-primary/10 backdrop-blur-[2px] motion-safe:animate-fade-in md:hidden"
        />
      )}
      {/* On wide screens it sits on the page frame, beside the floating chat panel. */}
      <nav
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col bg-surface-05 shadow-float md:static md:flex md:w-64 md:bg-transparent md:shadow-none`}
      >
        <div className="flex h-14 items-center gap-2.5 px-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white text-accent shadow-ring">
            <MarkIcon className="size-4" />
          </span>
          <span className="text-[14px] font-semibold tracking-tight">Search Agent</span>
        </div>

        <div className="px-3 pt-1">
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-current={selectedId === null ? "page" : undefined}
            className={`${row} group h-9 font-medium`}
          >
            <PlusIcon className="size-4 text-text-tertiary transition-colors duration-150 group-aria-[current=page]:text-accent" />
            New chat
          </button>
        </div>

        {/* Scrolls without a scrollbar; the faded edges show there is more. */}
        <div className="mt-4 flex-1 overflow-y-auto px-3 pt-2 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sessions.data?.length === 0 && (
            <p className="px-2.5 text-[12px] text-text-tertiary">Your chats will appear here.</p>
          )}
          {byPeriod(sessions.data ?? []).map(({ period, showDay, items }) => (
            <section key={period} className="mb-4">
              <h2 className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium text-text-tertiary">
                {period}
              </h2>
              <ul className="space-y-px">
                {items.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(session.id)}
                      aria-current={session.id === selectedId ? "page" : undefined}
                      title={session.title}
                      className={`${row} py-[7px]`}
                    >
                      {/* Demo chats are dated weeks back, so the "Demo: " prefix only costs room. */}
                      <span className="min-w-0 flex-1 truncate">
                        {isDemo(session) ? session.title.slice(DEMO_TITLE.length) : session.title}
                      </span>
                      {showDay && (
                        <span className="shrink-0 text-[11px] text-text-tertiary/80 tabular-nums">
                          {weekdayAndDay(new Date(session.updatedAt))}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {sessions.data && !sessions.data.some(isDemo) && (
          <div className="mx-3 mb-3 rounded-xl bg-white p-3 shadow-ring">
            <p className="flex items-center gap-2 text-[13px] font-medium">
              <DatabaseIcon className="size-4 text-accent" />
              Try recall
            </p>
            <p className="mt-1 text-[12px] leading-snug text-pretty text-text-tertiary">
              {loadDemo.isError
                ? loadDemo.error.message
                : "Add 31 demo chats from the past eight weeks, then ask about them."}
            </p>
            <button
              type="button"
              onClick={() => loadDemo.mutate()}
              disabled={loadDemo.isPending}
              className="mt-2.5 h-8 w-full rounded-lg bg-accent/8 text-[12px] font-medium text-accent transition-[background-color,scale] duration-200 hover:bg-accent/12 active:scale-[0.98] disabled:opacity-50"
            >
              {loadDemo.isPending ? "Adding demo chats…" : "Load demo history"}
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

/** A sidebar row: flat on the frame, raised into a white tab when it is the open chat. */
const row =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-text-secondary transition-[background-color,box-shadow,color] duration-150 hover:bg-text-primary/[0.045] hover:text-text-primary aria-[current=page]:bg-white aria-[current=page]:font-medium aria-[current=page]:text-text-primary aria-[current=page]:shadow-ring";

type Period = { period: string; showDay: boolean; items: SessionSummary[] };

/**
 * Today, Yesterday, then one group per month. Sessions arrive newest first, so groups do too.
 * Older chats show their weekday, which is what "last Tuesday" questions need.
 */
function byPeriod(sessions: SessionSummary[], now = new Date()): Period[] {
  const periods: Period[] = [];
  for (const session of sessions) {
    const date = new Date(session.updatedAt);
    const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
    const period = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : month(date, now);
    const last = periods.at(-1);
    if (last?.period === period) last.items.push(session);
    else periods.push({ period, showDay: daysAgo > 1, items: [session] });
  }
  return periods;
}

/** "November", or "November 2025" outside the current year. */
function month(date: Date, now: Date): string {
  const year = date.getFullYear() === now.getFullYear() ? undefined : "numeric";
  return date.toLocaleDateString(undefined, { month: "long", year });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Tue 3", in the user's language. */
function weekdayAndDay(date: Date): string {
  return `${date.toLocaleDateString(undefined, { weekday: "short" })} ${date.getDate()}`;
}
