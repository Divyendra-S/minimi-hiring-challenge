import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import type { Llm } from "@/adapters/llm";
import type { Search } from "@/adapters/tavily";
import type { ChatEvent, Source } from "@/shared/events";
import { WebSearchArgs, webSearch, webSearchTool } from "./tools";

// After this many search rounds the model must answer with what it has.
const MAX_SEARCH_ROUNDS = 3;
const INVALID_CALL = "Invalid tool call: use web_search with a queries array.";

export type AgentDeps = { llm: Llm; search: Search };

/**
 * One model, one tool: the model decides whether to search through normal tool calling, so
 * small talk costs a single model call and there is no separate router. The answer is the
 * concatenated `delta` events; the latest `sources` event lists what it can cite.
 */
export async function* runAgent(
  deps: AgentDeps,
  messages: ChatCompletionMessageParam[],
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const conversation = [...messages];
  const sources: Source[] = [];

  for (let round = 0; ; round++) {
    const canSearch = round < MAX_SEARCH_ROUNDS;
    const reply = yield* deps.llm({
      messages: conversation,
      tools: [webSearchTool],
      toolChoice: canSearch ? "auto" : "none",
      signal,
    });
    if (reply.toolCalls.length === 0 || !canSearch) return;
    // Text written before a search ("Let me check...") is its own paragraph.
    if (reply.text) yield { type: "delta", text: "\n\n" };

    conversation.push({
      role: "assistant",
      content: reply.text || null,
      tool_calls: reply.toolCalls,
    });
    const calls = reply.toolCalls.map((call) => ({ id: call.id, args: parseCall(call) }));
    const queries = calls.flatMap(({ args }) => args?.queries ?? []);
    if (queries.length > 0) yield { type: "searching", queries };
    // The model can ask for several searches in one reply (parallel tool calls); run them together.
    const results = await Promise.all(
      calls.map(async ({ id, args }) => ({
        role: "tool" as const,
        tool_call_id: id,
        content: args ? await webSearch(deps.search, args, sources, signal) : INVALID_CALL,
      })),
    );
    signal?.throwIfAborted();
    conversation.push(...results);
    if (queries.length > 0) yield { type: "sources", sources: [...sources] };
  }
}

function parseCall(call: ChatCompletionMessageToolCall): WebSearchArgs | undefined {
  if (call.type !== "function" || call.function.name !== "web_search") return undefined;
  const parsed = WebSearchArgs.safeParse(safeJson(call.function.arguments));
  return parsed.success ? parsed.data : undefined;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
