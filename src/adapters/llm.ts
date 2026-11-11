import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { z } from "zod";

export type LlmRequest = {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: "auto" | "none";
  signal?: AbortSignal;
};
export type LlmReply = { text: string; toolCalls: ChatCompletionMessageToolCall[] };
export type TextDelta = { type: "delta"; text: string };

/** Streams one model reply: yields text as it arrives, returns the whole reply with any tool calls. */
export type Llm = (request: LlmRequest) => AsyncGenerator<TextDelta, LlmReply>;

/** One reply as JSON that the provider constrains to `schema`, then validated against it. */
export type StructuredLlm = <T>(request: {
  name: string;
  schema: z.ZodType<T>;
  messages: ChatCompletionMessageParam[];
}) => Promise<T>;

/** Spend at most `capUsd` on the key, counted from when its total usage was `startUsd`. */
export type UsageCap = { capUsd: number; startUsd: number };
export type OpenRouterOptions = { apiKey: string; model: string; usageCap?: UsageCap };

const BASE_URL = "https://openrouter.ai/api/v1";
// Low reasoning effort keeps replies fast: time-to-first-token for chat, cost for extraction.
// Measured on three questions: "none", OpenAI's priority tier and routing by latency all landed
// within the run-to-run noise of "low" (1.4 to 2.5 s per call), so none of them is used.
const REASONING_EFFORT = "low";
// OpenRouter reports usage a few seconds late, so the cap stops early by about one turn's calls.
const CAP_MARGIN_USD = 0.003;
const KeyInfo = z.object({ data: z.object({ usage: z.number() }) });

/** OpenRouter speaks the OpenAI chat API, so the official SDK works with a different base URL. */
export function openRouter({ model, ...account }: OpenRouterOptions): Llm {
  const client = createClient(account);
  return async function* ({ messages, tools, toolChoice, signal }) {
    try {
      const stream = client.chat.completions.stream(
        { model, messages, tools, tool_choice: toolChoice, reasoning_effort: REASONING_EFFORT },
        { signal },
      );
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta.content;
        if (text) yield { type: "delta", text };
      }
      const message = (await stream.finalChatCompletion()).choices[0]?.message;
      return { text: message?.content ?? "", toolCalls: message?.tool_calls ?? [] };
    } catch (error) {
      throw named(error);
    }
  };
}

export function openRouterStructured({ model, ...account }: OpenRouterOptions): StructuredLlm {
  const client = createClient(account);
  return async ({ name, schema, messages }) => {
    try {
      const completion = await client.chat.completions.parse({
        model,
        messages,
        response_format: zodResponseFormat(schema, name),
        reasoning_effort: REASONING_EFFORT,
      });
      const message = completion.choices[0]?.message;
      if (message?.parsed == null) {
        throw new Error(`OpenRouter: no ${name} in the reply. ${message?.refusal ?? ""}`.trim());
      }
      return message.parsed;
    } catch (error) {
      throw named(error);
    }
  };
}

function createClient({ apiKey, usageCap }: Omit<OpenRouterOptions, "model">): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    // Limits the wait for response headers (per attempt), not the stream. The default is 10 minutes.
    timeout: 30_000,
    // The SDK sends every request through this, retries included, so none can skip the cap.
    fetch: usageCap && cappedFetch(apiKey, usageCap),
  });
}

/**
 * Reads the key's total usage from OpenRouter before each request; spent = usage - startUsd.
 * At the cap, or if usage can't be read, it answers 402 itself (OpenRouter's status for "out of
 * credit"), which the SDK doesn't retry.
 */
function cappedFetch(apiKey: string, { capUsd, startUsd }: UsageCap) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const usage = await keyUsage(apiKey);
    const spent = usage === undefined ? undefined : usage - startUsd;
    if (spent !== undefined && spent + CAP_MARGIN_USD < capUsd) return fetch(input, init);
    const message =
      spent === undefined
        ? "Spending cap: this key's usage couldn't be read, so the request was blocked."
        : `Spending cap reached: $${spent.toFixed(4)} of the $${capUsd} cap is spent ` +
          "(OPENROUTER_KEY_USAGE_CAP_USD).";
    return Response.json({ error: { message } }, { status: 402 });
  };
}

/**
 * The key's total spend in dollars, as OpenRouter reports it (a few seconds behind), or undefined
 * if it can't be read. The request itself is free.
 */
export async function keyUsage(apiKey: string): Promise<number | undefined> {
  const res = await fetch(`${BASE_URL}/key`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return KeyInfo.safeParse(await res?.json().catch(() => null)).data?.data.usage;
}

/** Names the service, so "401 Missing Authentication header" is traceable to a key. */
function named(error: unknown): unknown {
  if (error instanceof OpenAI.APIError && !(error instanceof OpenAI.APIUserAbortError)) {
    return new Error(`OpenRouter: ${error.message}`, { cause: error });
  }
  return error;
}
