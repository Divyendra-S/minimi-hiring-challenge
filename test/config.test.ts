import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigError, loadConfig } from "@/config";

test("loadConfig names every missing key in one error", () => {
  assert.throws(
    () => loadConfig({ OPENROUTER_API_KEY: "" }),
    (error) =>
      error instanceof ConfigError && error.missing.join() === "OPENROUTER_API_KEY,TAVILY_API_KEY",
  );
});

test("loadConfig fills in the default models", () => {
  const config = loadConfig({ OPENROUTER_API_KEY: "or-key", TAVILY_API_KEY: "tv-key" });
  assert.equal(config.CHAT_MODEL, "openai/gpt-6-luna");
  assert.equal(config.MEMORY_MODEL, "openai/gpt-6-luna");
});
