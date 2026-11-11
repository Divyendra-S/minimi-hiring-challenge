import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import { openDb } from "@/adapters/db";
import type { Llm, LlmReply, LlmRequest } from "@/adapters/llm";
import type { Search } from "@/adapters/tavily";
import { createMemoryStore, type Turn } from "@/core/memory/memories";
import { createStore, type Store } from "@/core/memory/store";
import type { ChatEvent, Source } from "@/shared/events";

/** The message log and the memory store, sharing one in-memory database. */
export function stores() {
  const db = openDb(":memory:");
  return { store: createStore(db), memories: createMemoryStore(db) };
}

/** Logs a question and its answer at `at` (a new session unless one is given). */
export function logTurn(
  store: Store,
  userId: string,
  at: string,
  turn: { sessionId?: string; question?: string; answer?: string; sources?: Source[] } = {},
): Turn {
  const sessionId = turn.sessionId ?? store.createSession(userId, "Chat", at);
  const message = { sessionId, userId, createdAt: at };
  store.addMessage({ ...message, role: "user", content: turn.question ?? "Q" });
  const answerId = store.addMessage({
    ...message,
    role: "assistant",
    content: turn.answer ?? "A",
    sources: turn.sources,
  });
  return { sessionId, answerId, at };
}

/** A model that plays back fixed replies and records every request it got. */
export function scriptedLlm(replies: LlmReply[]): { llm: Llm; requests: LlmRequest[] } {
  const requests: LlmRequest[] = [];
  const llm: Llm = async function* (request) {
    requests.push({ ...request, messages: [...request.messages] }); // the agent keeps appending
    const reply = replies[requests.length - 1] ?? { text: "", toolCalls: [] };
    if (reply.text) yield { type: "delta", text: reply.text };
    return reply;
  };
  return { llm, requests };
}

export function searchCall(args: unknown, id = "call_1"): ChatCompletionMessageToolCall {
  return {
    id,
    type: "function",
    function: { name: "web_search", arguments: JSON.stringify(args) },
  };
}

/** Every query returns one page of its own plus one page shared by all queries. */
export const fakeSearch: Search = async (query) => [
  { title: `About ${query}`, url: `https://example.com/${query}`, content: `Facts about ${query}` },
  { title: "Shared page", url: "https://example.com/shared", content: "Shared facts" },
];

export async function drain<E>(gen: AsyncGenerator<E>): Promise<{ events: E[] }> {
  const events: E[] = [];
  for await (const event of gen) events.push(event);
  return { events };
}

/** The answer as a client sees it: the concatenated deltas and the latest source list. */
export function answerOf(events: ChatEvent[]): { text: string; sources: Source[] } {
  let text = "";
  let sources: Source[] = [];
  for (const event of events) {
    if (event.type === "delta") text += event.text;
    if (event.type === "sources") sources = event.sources;
  }
  return { text, sources };
}
