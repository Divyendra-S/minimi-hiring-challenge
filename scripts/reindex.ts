// Rebuilds every memory from the message log, e.g. after changing the extraction prompt or model.
// Stop `npm run dev` first, so it doesn't extract the same turns at the same time.
import { openDb } from "@/adapters/db";
import { openRouterStructured } from "@/adapters/llm";
import { loadConfig } from "@/config";
import { memorize } from "@/core/memory/extract";
import { createMemoryStore } from "@/core/memory/memories";
import { createStore } from "@/core/memory/store";

const config = loadConfig();
const db = openDb();
const deps = {
  store: createStore(db),
  memories: createMemoryStore(db),
  llm: openRouterStructured(config.OPENROUTER_API_KEY, config.MEMORY_MODEL),
};

deps.memories.reset();
for (const userId of deps.store.userIds()) {
  console.log(`User ${userId.slice(0, 8)}: ${deps.memories.pending(userId).length} turns`);
  await memorize(deps, userId);
}
console.log("Memories rebuilt.");
