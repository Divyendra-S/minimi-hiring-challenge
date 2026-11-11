import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Read } from "@/adapters/tavily";
import type { StoredMessage } from "@/shared/dto";
import type { ChatEvent, Source, Timings } from "@/shared/events";
import { type AgentDeps, runAgent } from "./agent/loop";
import { SYSTEM_PROMPT, withContext } from "./agent/prompt";
import { asksIfStillTrue, recheck } from "./agent/recheck";
import { buildContext, type ContextDeps } from "./memory/context";

// Older context comes from memory, not from replaying the whole session.
const HISTORY_MESSAGES = 20;
// Enough to resolve "them" or "it" in a follow-up.
const RECENT_MESSAGES = 4;

export type ChatDeps = AgentDeps & ContextDeps & { read: Read; now: () => Date };
export type ChatInput = { userId: string; sessionId?: string; message: string; timezone: string };

/**
 * Handles one user message end to end: recall what's relevant, save the message, run the agent,
 * stream events, save the answer. Memories are extracted afterwards, by `memorize`.
 * Aborting `signal` (the Stop button, a closed tab) saves the part of the answer already streamed.
 */
export async function* chat(
  deps: ChatDeps,
  input: ChatInput,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const started = performance.now();
  const now = deps.now();
  const { store } = deps;
  const { userId } = input;

  const sessionId =
    input.sessionId && store.hasSession(userId, input.sessionId)
      ? input.sessionId
      : store.createSession(userId, titleFrom(input.message), now.toISOString());
  const history = store.messages(userId, sessionId, HISTORY_MESSAGES);
  const context = await buildContext(deps, {
    userId,
    sessionId,
    message: input.message,
    recent: history.slice(-RECENT_MESSAGES),
    now,
    timeZone: input.timezone,
  });
  const questionId = store.addMessage({
    sessionId,
    userId,
    role: "user",
    content: input.message,
    createdAt: now.toISOString(),
  });
  const answerId = crypto.randomUUID();
  yield { type: "start", sessionId, questionId, answerId };

  // "Has it changed since?" about remembered facts: their sources are known, so code fetches
  // them now, and the model compares old and new in one call instead of two.
  const cited: Source[] = [];
  let pages: string | undefined;
  if (context.claims.length > 0 && asksIfStillTrue(input.message)) {
    yield { type: "searching", queries: context.claims.map((claim) => withoutScheme(claim.url)) };
    pages = await recheck(deps.read, context.claims, cited, signal);
    if (pages) yield { type: "sources", sources: [...cited] };
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map(toModelMessage),
    { role: "user", content: withContext(input.message, context.text, pages) },
  ];
  let text = "";
  let sources: Source[] = [...cited];
  let firstTokenMs: number | null = null;
  const timings = (): Timings => ({ firstTokenMs, totalMs: elapsed(started) });
  let saved = false; // a Stop can land just as the answer completes; save it only once
  const save = (meta: { timings: Timings; stopped?: true }) => {
    if (saved) return;
    saved = true;
    store.addMessage({
      id: answerId,
      sessionId,
      userId,
      role: "assistant",
      content: text,
      sources,
      meta,
      createdAt: deps.now().toISOString(),
    });
  };
  // Saved from the abort event itself: the generator may be paused at a yield no one resumes.
  const stop = () => {
    if (text) save({ timings: timings(), stopped: true });
  };
  signal?.addEventListener("abort", stop, { once: true });

  try {
    for await (const event of runAgent(deps, messages, signal, cited)) {
      if (event.type === "delta") {
        firstTokenMs ??= elapsed(started);
        text += event.text;
      }
      if (event.type === "sources") sources = event.sources;
      yield event;
    }
  } catch (error) {
    if (signal?.aborted) return; // Stopped: already saved, and no one is listening.
    throw error;
  } finally {
    signal?.removeEventListener("abort", stop);
  }
  const final = timings();
  save({ timings: final });
  yield { type: "done", timings: final };
}

function elapsed(since: number): number {
  return Math.round(performance.now() - since);
}

/** Earlier answers keep their source list so follow-ups like "what did [2] say?" still work. */
function toModelMessage(message: StoredMessage): ChatCompletionMessageParam {
  if (message.role === "user") return { role: "user", content: message.content };
  const sources = message.sources.map((s) => `[${s.n}] ${s.title} - ${s.url}`).join("\n");
  return {
    role: "assistant",
    content: sources ? `${message.content}\n\nSources:\n${sources}` : message.content,
  };
}

function withoutScheme(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

function titleFrom(message: string): string {
  const line = message.replace(/\s+/g, " ").trim();
  return line.length <= 60 ? line : `${line.slice(0, 57).replace(/\s\S*$/, "")}...`;
}
