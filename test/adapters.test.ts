import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { z } from "zod";
import { openRouter, openRouterStructured } from "@/adapters/llm";
import { tavily, tavilyReader } from "@/adapters/tavily";
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
  assert.deepEqual([bodies[0]?.max_age_hours, bodies[0]?.search_depth], [24, "fast"]);
  assert.deepEqual([bodies[1]?.max_age_hours, bodies[1]?.search_depth], [undefined, "basic"]);
});

test("Tavily: a fresh search takes live and thorough pages in turn; a plain one stays fast", async (t) => {
  const bodies: Record<string, unknown>[] = [];
  const hit = (title: string) => ({ ...page, title, url: `https://neon.com/${title}` });
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    const titles = body.max_age_hours ? ["live1", "live2", "live3"] : ["thorough1"];
    return Response.json({ results: titles.map(hit) });
  });

  const hits = await tavily("key")("neon pricing", { fresh: true, sites: ["neon.com"] });
  assert.deepEqual(
    hits.map((h) => h.title),
    ["live1", "thorough1", "live2", "live3"],
  );
  bodies.length = 0;
  await tavily("key")("neon news", {});
  assert.deepEqual(
    bodies.map((body) => body.search_depth),
    ["fast"],
  );
});

test("Tavily: other errors carry the status, so the model can tell the user", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Invalid API key", { status: 401 }));
  await assert.rejects(tavily("bad")("neon", {}), { message: "Tavily 401: Invalid API key" });
});

test("Tavily: reads pages by address, asking for the passages about the question", async (t) => {
  let body: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    assert.equal(url, "https://api.tavily.com/extract");
    body = JSON.parse(String(init?.body));
    return Response.json({
      results: [{ url: "https://www.neon.com/pricing/", raw_content: "Launch: $5" }],
      failed_results: [{ url: "https://gone.example/", error: "404" }],
    });
  });
  const urls = ["https://www.neon.com/pricing/", "https://gone.example/"];
  const pages = await tavilyReader("key")(urls, "Has Neon's price changed?");
  assert.deepEqual(body, { urls, query: "Has Neon's price changed?", chunks_per_source: 4 });
  assert.deepEqual(pages, [
    { title: "neon.com/pricing", url: "https://www.neon.com/pricing/", content: "Launch: $5" },
  ]);
});

test("OpenRouter: API errors name the service", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: { message: "Missing Authentication header" } }, { status: 401 }),
  );
  const llm = openRouter({ apiKey: "bad", model: "openai/gpt-6-luna" });
  await assert.rejects(drain(llm({ messages: [{ role: "user", content: "Hi" }] })), {
    message: /^OpenRouter: 401/,
  });
});

/** Answers OpenRouter's usage endpoint with `usage` (or `status`), and records every URL. */
function mockOpenRouter(t: TestContext, key: { usage?: number; status?: number }) {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(String(url));
    if (String(url).endsWith("/key")) {
      return Response.json({ data: { usage: key.usage } }, { status: key.status ?? 200 });
    }
    return Response.json({ error: { message: "Invalid key" } }, { status: 401 });
  });
  return urls;
}

// $0.02 to spend, counted from a key that had used $22.49.
const extract = () =>
  openRouterStructured({ apiKey: "k", model: "m", usageCap: { capUsd: 0.02, startUsd: 22.49 } })({
    name: "test",
    schema: z.object({}),
    messages: [{ role: "user", content: "Hi" }],
  });

test("OpenRouter: at the spending cap, no request reaches the model", async (t) => {
  const urls = mockOpenRouter(t, { usage: 22.508 }); // $0.018 spent; the margin covers the rest
  await assert.rejects(extract(), {
    message: /^OpenRouter: 402 Spending cap reached: \$0\.0180 of the \$0\.02 cap is spent/,
  });
  assert.deepEqual(urls, ["https://openrouter.ai/api/v1/key"]); // checked once, never retried
});

test("OpenRouter: usage that can't be read blocks the request too", async (t) => {
  const urls = mockOpenRouter(t, { status: 500 });
  await assert.rejects(extract(), { message: /couldn't be read, so the request was blocked/ });
  assert.equal(urls.length, 1);
});

test("OpenRouter: under the cap, the request goes through", async (t) => {
  const urls = mockOpenRouter(t, { usage: 22.5 }); // $0.01 spent
  await assert.rejects(extract(), { message: /^OpenRouter: 401 Invalid key/ });
  assert.deepEqual(urls, [
    "https://openrouter.ai/api/v1/key",
    "https://openrouter.ai/api/v1/chat/completions",
  ]);
});
