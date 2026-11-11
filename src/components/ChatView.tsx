import { useEffect, useRef } from "react";
import { useMessages } from "@/client/queries";
import { useChatStream } from "@/client/useChatStream";
import { Composer, type Suggestion } from "./Composer";
import { GlobeIcon, HistoryIcon, MarkIcon, RefreshIcon } from "./icons";
import { Message, type MessageProps } from "./Message";

type Props = { sessionId: string | null; onSession: (id: string) => void };

/** One of each thing the agent is for: recall, re-checking an old answer, a fresh search. */
const SUGGESTIONS: Suggestion[] = [
  { label: "Recall a past chat", prompt: "What did I ask you last Tuesday?", icon: HistoryIcon },
  {
    label: "Check what changed",
    prompt: "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since?",
    icon: RefreshIcon,
  },
  {
    label: "Search the web",
    prompt: "What is the latest stable release of Node.js?",
    icon: GlobeIcon,
  },
];

export function ChatView({ sessionId, onSession }: Props) {
  const saved = useMessages(sessionId).data ?? [];
  const { turn, send, stop } = useChatStream(sessionId, onSession);
  const live = turn?.sessionId === sessionId ? turn : null;
  const home = sessionId === null && !live;

  // The streamed exchange joins the saved history under the ids it will be saved with, so when
  // the refetched history arrives React keeps the same elements: nothing flickers or re-animates.
  const isSaved = (id?: string) => saved.some((m) => m.id === id);
  const messages: (MessageProps & { id: string })[] = saved.map(
    ({ id, role, content, sources }) => ({ id, author: role, content, sources }),
  );
  if (live && !isSaved(live.questionId)) {
    messages.push({
      id: live.questionId ?? "question",
      author: "user",
      content: live.question,
      sources: [],
    });
  }
  // Until its first word, the answer shows what the agent is doing instead.
  if (live && !isSaved(live.answerId) && (live.answer || live.streaming)) {
    messages.push({
      id: live.answerId ?? "answer",
      author: "assistant",
      content: live.answer,
      sources: live.sources,
      searching: live.searching,
    });
  }

  const end = useRef<HTMLDivElement>(null);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and React would take a
  // returned value for a cleanup function.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  });

  // The composer stays the second child in both layouts, so a draft survives switching between them.
  return (
    <div className={`flex min-h-0 flex-1 flex-col ${home ? "justify-center pb-[12vh]" : ""}`}>
      {home ? (
        <div className="mb-8 flex flex-col items-center px-6 text-center">
          <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-white text-accent shadow-float motion-safe:animate-enter">
            <MarkIcon className="size-[22px]" />
          </div>
          <h1 className="text-[32px] leading-tight font-extralight tracking-tight motion-safe:animate-enter motion-safe:[animation-delay:60ms]">
            {greeting()}
          </h1>
          <p className="mt-2 text-[14px] text-balance text-text-tertiary motion-safe:animate-enter motion-safe:[animation-delay:120ms]">
            Search the web, or ask about anything we talked about before
          </p>
        </div>
      ) : (
        <div className="fade-bottom flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-3xl space-y-6 pb-4">
            {messages.map(({ id, ...message }) => (
              <Message key={id} {...message} />
            ))}
            {live?.error && (
              <p
                role="alert"
                className="ml-9 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-700"
              >
                {live.error}
              </p>
            )}
            <div ref={end} />
          </div>
        </div>
      )}
      {/* One answer at a time, even if the user switches chats while it streams. */}
      <Composer
        busy={turn?.streaming ?? false}
        onSend={send}
        onStop={stop}
        suggestions={home ? SUGGESTIONS : undefined}
      />
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
