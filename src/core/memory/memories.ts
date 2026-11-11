import { createHash } from "node:crypto";
import type { Db } from "@/adapters/db";
import { MEMORY_SCHEMA } from "./schema";

export const MEMORY_KINDS = ["preference", "fact", "decision", "claim"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** `claim` is a fact found on the web, with its source; the other kinds come from the user. */
export type NewMemory = {
  kind: MemoryKind;
  text: string;
  topic: string;
  entities: string[];
  sourceUrl?: string;
};
export type Memory = Omit<NewMemory, "entities" | "sourceUrl"> & {
  id: string;
  sourceUrl: string | null;
  observedAt: string;
};
/** The turn a memory came from: its answer and when it happened. */
export type Turn = { sessionId: string; answerId: string; at: string };
export type Entity = { id: number; norm: string };

/** Lowercase words and digits only, so "Fly.io's" and "fly io" compare equal. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const MEMORY_COLUMNS =
  "m.id, m.kind, m.text, m.topic, m.source_url AS sourceUrl, m.observed_at AS observedAt";

/** Memories, the entities they mention, and their keyword index. Every query is scoped by user id. */
export function createMemoryStore(db: Db) {
  db.exec(MEMORY_SCHEMA);

  // A memory is never updated: a changed price has a different hash, so it becomes a new row.
  const insertMemory = db.prepare(
    `INSERT INTO memories (id, user_id, kind, text, topic, source_url, observed_at, session_id, message_id, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, hash) DO NOTHING`,
  );
  const insertFts = db.prepare(
    "INSERT INTO memories_fts (memory_id, text, topic) VALUES (?, ?, ?)",
  );
  // The no-op update makes RETURNING give the id of an existing entity too.
  const upsertEntity = db.prepare<[string, string, string], { id: number }>(
    `INSERT INTO entities (user_id, name, norm) VALUES (?, ?, ?)
     ON CONFLICT (user_id, norm) DO UPDATE SET norm = excluded.norm RETURNING id`,
  );
  const link = db.prepare(
    "INSERT OR IGNORE INTO memory_entities (memory_id, entity_id) VALUES (?, ?)",
  );
  const markMemorized = db.prepare("INSERT OR IGNORE INTO memorized (message_id) VALUES (?)");

  const selectPending = db.prepare<[string], { sessionId: string; answerId: string; at: string }>(
    `SELECT m.session_id AS sessionId, m.id AS answerId, m.created_at AS at FROM messages m
     WHERE m.user_id = ? AND m.role = 'assistant'
       AND NOT EXISTS (SELECT 1 FROM memorized d WHERE d.message_id = m.id)
     ORDER BY m.rowid`,
  );
  const selectEntities = db.prepare<[string], Entity>(
    "SELECT id, norm FROM entities WHERE user_id = ?",
  );
  // The newest N memories per entity. The ids arrive as a JSON array.
  const selectLinked = db.prepare<[string, string, number], Memory>(
    `SELECT DISTINCT id, kind, text, topic, sourceUrl, observedAt FROM (
       SELECT ${MEMORY_COLUMNS},
              ROW_NUMBER() OVER (PARTITION BY l.entity_id ORDER BY m.observed_at DESC) AS n
       FROM memory_entities l JOIN memories m ON m.id = l.memory_id
       WHERE m.user_id = ? AND l.entity_id IN (SELECT value FROM json_each(?))
     ) WHERE n <= ?`,
  );
  const selectMatching = db.prepare<[string, string, number], Memory>(
    `SELECT ${MEMORY_COLUMNS} FROM memories_fts f JOIN memories m ON m.id = f.memory_id
     WHERE memories_fts MATCH ? AND m.user_id = ? ORDER BY bm25(memories_fts) LIMIT ?`,
  );
  const selectOfSession = db.prepare<[string, string], { text: string }>(
    "SELECT text FROM memories WHERE user_id = ? AND session_id = ? ORDER BY observed_at",
  );

  /** Saves a turn's memories and marks the turn as done, in one transaction. */
  const save = db.transaction((userId: string, turn: Turn, memories: NewMemory[]): number => {
    let added = 0;
    for (const memory of memories) {
      const id = crypto.randomUUID();
      const hash = createHash("sha256")
        .update(`${memory.kind}|${normalize(memory.text)}`)
        .digest("hex");
      const { changes } = insertMemory.run(
        id,
        userId,
        memory.kind,
        memory.text,
        memory.topic,
        memory.sourceUrl ?? null,
        turn.at,
        turn.sessionId,
        turn.answerId,
        hash,
      );
      if (changes === 0) continue; // already known
      insertFts.run(id, memory.text, memory.topic);
      for (const name of memory.entities) {
        const norm = normalize(name);
        const entity = norm ? upsertEntity.get(userId, name, norm) : undefined;
        if (entity) link.run(id, entity.id);
      }
      added++;
    }
    markMemorized.run(turn.answerId);
    return added;
  });

  return {
    save,
    /** Answers not yet through extraction, oldest first. */
    pending(userId: string): Turn[] {
      return selectPending.all(userId);
    },
    entities(userId: string): Entity[] {
      return selectEntities.all(userId);
    },
    linkedTo(userId: string, entityIds: number[], perEntity: number): Memory[] {
      if (entityIds.length === 0) return [];
      return selectLinked.all(userId, JSON.stringify(entityIds), perEntity);
    },
    /** Keyword search (BM25, stemmed), best first. `query` uses FTS5 syntax. */
    matching(userId: string, query: string, limit: number): Memory[] {
      return selectMatching.all(query, userId, limit);
    },
    textsOfSession(userId: string, sessionId: string): string[] {
      return selectOfSession.all(userId, sessionId).map((row) => row.text);
    },
    /** Forgets everything derived, so extraction can rebuild it from the log. */
    reset(): void {
      db.exec(
        "DELETE FROM memory_entities; DELETE FROM memories_fts; DELETE FROM memories; DELETE FROM entities; DELETE FROM memorized;",
      );
    },
  };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;
