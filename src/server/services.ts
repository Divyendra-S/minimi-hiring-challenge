import { getDb } from "@/adapters/db";
import { openRouter, openRouterStructured } from "@/adapters/llm";
import { tavily } from "@/adapters/tavily";
import { loadConfig } from "@/config";
import { cachedSearch, type SearchCache } from "@/core/agent/cache";
import type { ChatDeps } from "@/core/chat";
import { type ExtractDeps, memorize } from "@/core/memory/extract";
import { createMemoryStore, type MemoryStore } from "@/core/memory/memories";
import { createStore, type Store } from "@/core/memory/store";

// The one place that wires adapters into core. Routes call these; core never reads env or globals.

// Process-wide singletons, kept on globalThis so dev-mode reloads don't recreate them.
const globals = globalThis as typeof globalThis & {
  agentStore?: Store;
  memoryStore?: MemoryStore;
  searchCache?: SearchCache;
  memoryQueue?: Promise<void>;
};

export function getStore(): Store {
  globals.agentStore ??= createStore(getDb());
  return globals.agentStore;
}

function getMemories(): MemoryStore {
  globals.memoryStore ??= createMemoryStore(getDb());
  return globals.memoryStore;
}

/** Built per request so keys added to .env take effect without a restart. Throws ConfigError. */
export function chatDeps(): ChatDeps {
  const config = loadConfig();
  globals.searchCache ??= new Map();
  return {
    store: getStore(),
    memories: getMemories(),
    llm: openRouter(config.OPENROUTER_API_KEY, config.CHAT_MODEL),
    search: cachedSearch(tavily(config.TAVILY_API_KEY), globals.searchCache),
    now: () => new Date(),
  };
}

function extractDeps(): ExtractDeps {
  const config = loadConfig();
  return {
    store: getStore(),
    memories: getMemories(),
    llm: openRouterStructured(config.OPENROUTER_API_KEY, config.MEMORY_MODEL),
  };
}

/**
 * Extracts memories from the user's new turns. Jobs run one at a time, so two requests never
 * extract the same turn twice.
 */
export function remember(userId: string): Promise<void> {
  globals.memoryQueue = (globals.memoryQueue ?? Promise.resolve())
    .then(() => memorize(extractDeps(), userId))
    .catch((error) => console.error("Memory extraction failed:", error));
  return globals.memoryQueue;
}
