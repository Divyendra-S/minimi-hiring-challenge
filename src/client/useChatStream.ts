import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { ChatEvent, Source } from "@/shared/events";
import { readLines } from "@/shared/ndjson";
import { queryKeys } from "./queries";

/**
 * The latest exchange, as streamed. The view shows each of its messages until the refetched
 * history contains that message's id, so finished and stopped answers never flicker or double.
 */
export type LiveTurn = {
  sessionId: string | null;
  questionId?: string;
  answerId?: string;
  question: string;
  answer: string;
  sources: Source[];
  searching: string[];
  streaming: boolean;
  error?: string;
};

export function useChatStream(sessionId: string | null, onSession: (id: string) => void) {
  const queryClient = useQueryClient();
  const [turn, setTurn] = useState<LiveTurn | null>(null);
  const controller = useRef<AbortController | null>(null);

  async function send(question: string) {
    const abort = new AbortController();
    controller.current = abort;
    setTurn({ sessionId, question, answer: "", sources: [], searching: [], streaming: true });
    const update = (change: Partial<LiveTurn>) => setTurn((t) => t && { ...t, ...change });
    let id = sessionId;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId ?? undefined,
          message: question,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) throw new Error(await errorText(res));

      for await (const event of readLines<ChatEvent>(res.body)) {
        if (event.type === "start") {
          update({
            sessionId: event.sessionId,
            questionId: event.questionId,
            answerId: event.answerId,
          });
          if (event.sessionId !== id) {
            onSession(event.sessionId);
            queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
          }
          id = event.sessionId;
        }
        if (event.type === "searching") update({ searching: event.queries });
        if (event.type === "sources") update({ sources: event.sources });
        if (event.type === "delta") {
          setTurn((t) => t && { ...t, answer: t.answer + event.text, searching: [] });
        }
        if (event.type === "error") throw new Error(event.message);
      }
    } catch (e) {
      // Stop aborts on purpose; the server keeps whatever had streamed.
      if (!abort.signal.aborted) update({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      controller.current = null;
      update({ streaming: false, searching: [] });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      if (id) queryClient.invalidateQueries({ queryKey: queryKeys.messages(id) });
    }
  }

  return { turn, send, stop: () => controller.current?.abort() };
}

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Request failed (${res.status})`;
}
