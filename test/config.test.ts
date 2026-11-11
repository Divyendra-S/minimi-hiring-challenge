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

test("a spending cap needs the usage it starts from", () => {
  const keys = { OPENROUTER_API_KEY: "or-key", TAVILY_API_KEY: "tv-key" };
  assert.throws(
    () => loadConfig({ ...keys, OPENROUTER_KEY_USAGE_CAP_USD: "0.02" }),
    (error) =>
      error instanceof ConfigError && error.missing.join() === "OPENROUTER_KEY_USAGE_START_USD",
  );
  const config = loadConfig({
    ...keys,
    OPENROUTER_KEY_USAGE_CAP_USD: "0.02",
    OPENROUTER_KEY_USAGE_START_USD: "22.4896",
  });
  assert.equal(config.OPENROUTER_KEY_USAGE_CAP_USD, 0.02);
});
