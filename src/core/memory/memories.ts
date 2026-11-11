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
  /**
   * What the memory is the value of, e.g. "Neon Launch plan price" or "sales team size". A newer
   * memory with the same subject replaces it.
   */
  subject?: string;
};
export type Memory = Omit<NewMemory, "entities" | "sourceUrl" | "subject"> & {
  id: string;
  sourceUrl: string | null;
  /** Normalized, so two spellings of one subject compare equal. */
  subject: string | null;
  observedAt: string;
  /** The conversation it was learned in. */
  sessionId: string;
  sessionTitle: string;
  /** The answer it was learned from, in the message log. */
  answerId: string;
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

const MEMORY_COLUMNS = `m.id, m.kind, m.text, m.topic, m.source_url AS sourceUrl, m.subject,
  m.observed_at AS observedAt, m.session_id AS sessionId, m.message_id AS answerId, (SELECT title FROM sessions s WHERE s.id = m.session_id) AS sessionTitle`;

/** Memories, the entities they mention, and their keyword index. Every query is scoped by user id. */
export function createMemoryStore(db: Db) {
  db.exec(MEMORY_SCHEMA);
  // A database made before memories had a subject.
  const columns = db.prepare<[], { name: string }>("PRAGMA table_info(memories)").all();
  if (!columns.some((column) => column.name === "subject")) {
    db.exec("ALTER TABLE memories ADD COLUMN subject TEXT");
  }
  db.exec("CREATE INDEX IF NOT EXISTS memories_by_subject ON memories (user_id, subject)");

  // A memory is never updated: a changed price has a different hash, so it becomes a new row.
  const insertMemory = db.prepare(
    `INSERT INTO memories (id, user_id, kind, text, topic, source_url, subject, observed_at, session_id, message_id, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, hash) DO NOTHING`,
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
    `SELECT DISTINCT id, kind, text, topic, sourceUrl, subject, observedAt, sessionId, answerId, sessionTitle FROM (
       SELECT ${MEMORY_COLUMNS},
              ROW_NUMBER() OVER (PARTITION BY l.entity_id ORDER BY m.observed_at DESC) AS n
       FROM memory_entities l JOIN memories m ON m.id = l.memory_id
       WHERE m.user_id = ? AND l.entity_id IN (SELECT value FROM json_each(?))
     ) WHERE n <= ? ORDER BY observedAt DESC`,
  );
  const selectEntitiesOf = db.prepare<[string], { id: number }>(
    `SELECT DISTINCT entity_id AS id FROM memory_entities
     WHERE memory_id IN (SELECT value FROM json_each(?))`,
  );
  const selectMatching = db.prepare<[string, string, number], Memory>(
    `SELECT ${MEMORY_COLUMNS} FROM memories_fts f JOIN memories m ON m.id = f.memory_id
     WHERE memories_fts MATCH ? AND m.user_id = ? ORDER BY bm25(memories_fts) LIMIT ?`,
  );
  const selectOfSession = db.prepare<[string, string], { text: string }>(
    "SELECT text FROM memories WHERE user_id = ? AND session_id = ? ORDER BY observed_at",
  );
  // The newest N from the given sessions. The ids arrive as a JSON array.
  const selectFromSessions = db.prepare<[string, string, number], Memory>(
    `SELECT ${MEMORY_COLUMNS} FROM memories m
     WHERE m.user_id = ? AND m.session_id IN (SELECT value FROM json_each(?))
     ORDER BY m.observed_at DESC LIMIT ?`,
  );

  // Every value a subject has had. The subjects arrive as a JSON array.
  const selectAbout = db.prepare<[string, number], Memory>(
    `SELECT ${MEMORY_COLUMNS} FROM memories m
     WHERE m.user_id = ? AND m.kind != 'claim'
     ORDER BY m.observed_at DESC LIMIT ?`,
  );
  const selectHistory = db.prepare<[string, string], Memory>(
    `SELECT ${MEMORY_COLUMNS} FROM memories m
     WHERE m.user_id = ? AND m.subject IN (SELECT value FROM json_each(?))
     ORDER BY m.observed_at`,
  );
  const selectChangedSubjects = db.prepare<[string, number], { subject: string }>(
    `SELECT subject FROM memories WHERE user_id = ? AND subject IS NOT NULL
     GROUP BY subject HAVING COUNT(*) > 1 ORDER BY MAX(observed_at) DESC LIMIT ?`,
  );
  const selectSubjects = db.prepare<[string, number], { subject: string }>(
    `SELECT subject FROM memories WHERE user_id = ? AND subject IS NOT NULL
     GROUP BY subject ORDER BY MAX(observed_at) DESC LIMIT ?`,
  );

  const selectUnembedded = db.prepare<[string], { id: string; text: string; topic: string }>(
    `SELECT m.id, m.text, m.topic FROM memories m WHERE m.user_id = ?
       AND NOT EXISTS (SELECT 1 FROM memory_vectors v WHERE v.memory_id = m.id)`,
  );
  const insertVector = db.prepare(
    "INSERT OR REPLACE INTO memory_vectors (memory_id, vector) VALUES (?, ?)",
  );
  const selectVectors = db.prepare<[string], { id: string; vector: Buffer }>(
    `SELECT v.memory_id AS id, v.vector FROM memory_vectors v
     JOIN memories m ON m.id = v.memory_id WHERE m.user_id = ?`,
  );
  const selectByIds = db.prepare<[string, string], Memory>(
    `SELECT ${MEMORY_COLUMNS} FROM memories m
     WHERE m.user_id = ? AND m.id IN (SELECT value FROM json_each(?))`,
  );
  const saveVectors = db.transaction((vectors: { id: string; vector: Float32Array }[]) => {
    for (const { id, vector } of vectors) {
      insertVector.run(id, Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength));
    }
  });

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
        (memory.subject && normalize(memory.subject)) || null,
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
    /** The entities these memories mention. */
    entitiesOf(memoryIds: string[]): number[] {
      return selectEntitiesOf.all(JSON.stringify(memoryIds)).map((row) => row.id);
    },
    /** Keyword search (BM25, stemmed), best first. `query` uses FTS5 syntax. */
    matching(userId: string, query: string, limit: number): Memory[] {
      return selectMatching.all(query, userId, limit);
    },
    /** What was remembered from these conversations, newest first. */
    fromSessions(userId: string, sessionIds: string[], limit: number): Memory[] {
      if (sessionIds.length === 0) return [];
      return selectFromSessions.all(userId, JSON.stringify(sessionIds), limit);
    },
    /** What the user said about themselves and decided, newest first: all but the web's claims. */
    about(userId: string, limit: number): Memory[] {
      return selectAbout.all(userId, limit);
    },
    /** Every memory about these subjects, oldest first: the last one of a subject is current. */
    historyOf(userId: string, subjects: string[]): Memory[] {
      if (subjects.length === 0) return [];
      return selectHistory.all(userId, JSON.stringify(subjects));
    },
    /** The subjects in use, most recently used first. */
    /** Subjects that have had more than one value, the latest change first. */
    changedSubjects(userId: string, limit: number): string[] {
      return selectChangedSubjects.all(userId, limit).map((row) => row.subject);
    },
    subjects(userId: string, limit: number): string[] {
      return selectSubjects.all(userId, limit).map((row) => row.subject);
    },
    /** Memories with no embedding yet. */
    unembedded(userId: string): { id: string; text: string; topic: string }[] {
      return selectUnembedded.all(userId);
    },
    saveVectors,
    /**
     * Search by meaning: the memories whose embeddings are closest to `query`, best first, at
     * least `minSimilarity` (cosine) close. Compares against every vector the user has, which
     * takes about a millisecond per thousand memories.
     */
    nearest(userId: string, query: Float32Array, limit: number, minSimilarity: number): Memory[] {
      const best = selectVectors
        .all(userId)
        .map(({ id, vector }) => ({ id, similarity: dot(query, toFloats(vector)) }))
        .filter((hit) => hit.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      const found = selectByIds.all(userId, JSON.stringify(best.map((hit) => hit.id)));
      const byId = new Map(found.map((memory) => [memory.id, memory]));
      return best.flatMap((hit) => byId.get(hit.id) ?? []);
    },
    textsOfSession(userId: string, sessionId: string): string[] {
      return selectOfSession.all(userId, sessionId).map((row) => row.text);
    },
    /** Forgets everything derived, so extraction can rebuild it from the log. */
    reset(): void {
      db.exec(
        "DELETE FROM memory_vectors; DELETE FROM memory_entities; DELETE FROM memories_fts; DELETE FROM memories; DELETE FROM entities; DELETE FROM memorized;",
      );
    },
  };
}

/** A copy, since a Buffer's bytes aren't always aligned for floats. */
function toFloats(bytes: Buffer): Float32Array {
  return new Float32Array(new Uint8Array(bytes).buffer);
}

/** The cosine similarity of two unit-length vectors. */
function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;
