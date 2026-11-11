import assert from "node:assert/strict";
import { test } from "node:test";
import { openRouter } from "@/adapters/llm";
import { tavily } from "@/adapters/tavily";
import { drain } from "./fakes";

const page = { title: "Neon pricing", url: "https://neon.com/pricing", content: "$19" };

test("Tavily: a fresh search asks for live pages and falls back to cached ones on 434", async (t) => {
  const bodies: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return bodies.length === 1
      ? new Response("Flex tier capacity exceeded", { status: 434 })
      : Response.json({ results: [{ ...page, published_date: null }] });
  });

  const hits = await tavily("key")("neon pricing", { fresh: true });
  assert.deepEqual(hits, [{ ...page, published: undefined }]);
  assert.equal(bodies[0]?.max_age_hours, 24);
  assert.equal(bodies[1]?.max_age_hours, undefined);
});

test("Tavily: other errors carry the status, so the model can tell the user", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Invalid API key", { status: 401 }));
  await assert.rejects(tavily("bad")("neon", {}), { message: "Tavily 401: Invalid API key" });
});

test("OpenRouter: API errors name the service", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: { message: "Missing Authentication header" } }, { status: 401 }),
  );
  const llm = openRouter("bad", "openai/gpt-6-luna");
  await assert.rejects(drain(llm({ messages: [{ role: "user", content: "Hi" }] })), {
    message: /^OpenRouter: 401/,
  });
});
