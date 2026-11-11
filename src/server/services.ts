import { getDb } from "@/adapters/db";
import { type Embedder, localEmbedder } from "@/adapters/embedder";
import { type OpenRouterOptions, openRouter, openRouterStructured } from "@/adapters/llm";
import { tavily, tavilyReader } from "@/adapters/tavily";
import { type Config, loadConfig } from "@/config";
import { cachedSearch, type SearchCache } from "@/core/agent/cache";
import type { ChatDeps } from "@/core/chat";
import { indexMemories } from "@/core/memory/embed";
import { type ExtractDeps, memorize } from "@/core/memory/extract";
import { createMemoryStore, type MemoryStore } from "@/core/memory/memories";
import { createStore, type Store } from "@/core/memory/store";

// The one place that wires adapters into core. Routes call these; core never reads env or globals.

// Process-wide singletons, kept on globalThis so dev-mode reloads don't recreate them.
const globals = globalThis as typeof globalThis & {
  agentStore?: Store;
  memoryStore?: MemoryStore;
  embedder?: Embedder;
  searchCache?: SearchCache;
  memoryQueue?: Promise<void>;
};

export function getStore(): Store {
  globals.agentStore ??= createStore(getDb());
  return globals.agentStore;
}

export function getMemories(): MemoryStore {
  globals.memoryStore ??= createMemoryStore(getDb());
  return globals.memoryStore;
}

export function getEmbedder(): Embedder {
  globals.embedder ??= localEmbedder();
  return globals.embedder;
}

/** Built per request so keys added to .env take effect without a restart. Throws ConfigError. */
export function chatDeps(): ChatDeps {
  const config = loadConfig();
  globals.searchCache ??= new Map();
  return {
    store: getStore(),
    memories: getMemories(),
    embedder: getEmbedder(),
    llm: openRouter({ ...openRouterAccount(config), model: config.CHAT_MODEL }),
    search: cachedSearch(tavily(config.TAVILY_API_KEY), globals.searchCache),
    read: tavilyReader(config.TAVILY_API_KEY),
    now: () => new Date(),
  };
}

function extractDeps(): ExtractDeps {
  const config = loadConfig();
  return {
    store: getStore(),
    memories: getMemories(),
    llm: openRouterStructured({ ...openRouterAccount(config), model: config.MEMORY_MODEL }),
  };
}

export function openRouterAccount(config: Config): Omit<OpenRouterOptions, "model"> {
  const { OPENROUTER_KEY_USAGE_CAP_USD: capUsd, OPENROUTER_KEY_USAGE_START_USD: startUsd } = config;
  return {
    apiKey: config.OPENROUTER_API_KEY,
    usageCap: capUsd === undefined || startUsd === undefined ? undefined : { capUsd, startUsd },
  };
}

/**
 * Extracts memories from the user's new turns, then embeds the new memories. Jobs run one at a
 * time, so two requests never extract the same turn twice.
 */
export function remember(userId: string): Promise<void> {
  return enqueue(() => memorize(extractDeps(), userId).finally(() => index(userId)));
}

/** Embeds the user's memories that have no vector yet. */
export function index(userId: string): Promise<void> {
  return enqueue(() => indexMemories({ memories: getMemories(), embedder: getEmbedder() }, userId));
}

function enqueue(job: () => Promise<void>): Promise<void> {
  globals.memoryQueue = (globals.memoryQueue ?? Promise.resolve())
    .then(job)
    .catch((error) => console.error("Memory update failed:", error));
  return globals.memoryQueue;
}
