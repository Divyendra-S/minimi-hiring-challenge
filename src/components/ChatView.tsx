import { useEffect, useRef } from "react";
import { useMessages } from "@/client/queries";
import { useChatStream } from "@/client/useChatStream";
import { Composer } from "./Composer";
import { Message } from "./Message";
import { StatusLine } from "./StatusLine";

type Props = { sessionId: string | null; onSession: (id: string) => void };

export function ChatView({ sessionId, onSession }: Props) {
  const saved = useMessages(sessionId).data ?? [];
  const { turn, send, stop } = useChatStream(sessionId, onSession);
  const live = turn?.sessionId === sessionId ? turn : null;
  const isSaved = (id?: string) => saved.some((m) => m.id === id);

  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }));

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {saved.length === 0 && !live && (
            <p className="pt-24 text-center text-neutral-500">
              Ask about anything current: prices, releases, news.
            </p>
          )}
          {saved.map((m) => (
            <Message key={m.id} author={m.role} content={m.content} sources={m.sources} />
          ))}
          {live && !isSaved(live.questionId) && (
            <Message author="user" content={live.question} sources={[]} />
          )}
          {live && !isSaved(live.answerId) && live.answer && (
            <Message author="assistant" content={live.answer} sources={live.sources} />
          )}
          {live?.streaming && !live.answer && <StatusLine searching={live.searching} />}
          {live?.error && (
            <p role="alert" className="text-sm text-red-700">
              {live.error}
            </p>
          )}
          <div ref={end} />
        </div>
      </div>
      {/* One answer at a time, even if the user switches chats while it streams. */}
      <Composer busy={turn?.streaming ?? false} onSend={send} onStop={stop} />
    </>
  );
}
