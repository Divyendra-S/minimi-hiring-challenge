import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { z } from "zod";

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

// Low reasoning effort keeps replies fast: time-to-first-token for chat, cost for extraction.
const REASONING_EFFORT = "low";

/** OpenRouter speaks the OpenAI chat API, so the official SDK works with a different base URL. */
export function openRouter(apiKey: string, model: string): Llm {
  const client = createClient(apiKey);
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

export function openRouterStructured(apiKey: string, model: string): StructuredLlm {
  const client = createClient(apiKey);
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

function createClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    // Limits the wait for response headers (per attempt), not the stream. The default is 10 minutes.
    timeout: 30_000,
  });
}

/** Names the service, so "401 Missing Authentication header" is traceable to a key. */
function named(error: unknown): unknown {
  if (error instanceof OpenAI.APIError && !(error instanceof OpenAI.APIUserAbortError)) {
    return new Error(`OpenRouter: ${error.message}`, { cause: error });
  }
  return error;
}
