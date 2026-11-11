import type { Embedder } from "@/adapters/embedder";
import type { MemoryStore } from "./memories";

/** Embeds the user's memories that have no vector yet, so they can be found by meaning. */
export async function indexMemories(
  deps: { memories: MemoryStore; embedder: Embedder },
  userId: string,
): Promise<void> {
  const pending = deps.memories.unembedded(userId);
  // The topic says what a bare fact is about: "Running shoes: The Brooks Ghost 16 costs $140."
  const vectors = await deps.embedder.embed(pending.map((m) => `${m.topic}: ${m.text}`));
  deps.memories.saveVectors(
    pending.map((m, i) => ({ id: m.id, vector: vectors[i] as Float32Array })),
  );
}
