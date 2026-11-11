import type { Db } from "@/adapters/db";
import type { SessionSummary, StoredMessage } from "@/shared/dto";
import type { Source } from "@/shared/events";
import { LOG_SCHEMA, TURN_INDEX_SCHEMA } from "./schema";

export type NewMessage = {
  id?: string;
  sessionId: string;
  userId: string;
  role: StoredMessage["role"];
  content: string;
  sources?: Source[];
  meta?: Record<string, unknown>;
  createdAt: string;
};

/** A message from any of the user's sessions, for recalling conversations by date. */
export type LoggedMessage = StoredMessage & { sessionId: string; sessionTitle: string };
/** An answer from any of the user's sessions, with the question it answered. */
export type LoggedTurn = LoggedMessage & { question: string };

type MessageRow = Omit<StoredMessage, "sources"> & { sourcesJson: string };
type LoggedRow = Omit<LoggedMessage, "sources"> & { sourcesJson: string };
type TurnRow = Omit<LoggedTurn, "sources"> & { sourcesJson: string };

/** The message log: sessions and messages. Every query is scoped by user id. */
export function createStore(db: Db) {
  db.exec(LOG_SCHEMA);
  // Built once, from the messages already there, in a database made before the index existed.
  const indexed = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'turns_fts'").get();
  if (!indexed) db.exec(TURN_INDEX_SCHEMA);

  const insertSession = db.prepare(
    "INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  );
  const findSession = db.prepare("SELECT 1 FROM sessions WHERE id = ? AND user_id = ?");
  const touchSession = db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?");
  const updateTitle = db.prepare("UPDATE sessions SET title = ? WHERE id = ? AND user_id = ?");
  const insertMessage = db.prepare(
    `INSERT INTO messages (id, session_id, user_id, role, content, sources_json, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectSessions = db.prepare<[string, number], SessionSummary>(
    `SELECT id, title, updated_at AS updatedAt FROM sessions
     WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`,
  );
  // Newest N, returned oldest first.
  const selectMessages = db.prepare<[string, string, number], MessageRow>(
    `SELECT id, role, content, sourcesJson, createdAt FROM (
       SELECT id, role, content, sources_json AS sourcesJson, created_at AS createdAt, rowid AS seq
       FROM messages WHERE session_id = ? AND user_id = ? ORDER BY seq DESC LIMIT ?
     ) ORDER BY seq`,
  );
  // Newest N in [from, to), returned oldest first. ISO-8601 UTC strings sort as times.
  const selectBetween = db.prepare<[string, string, string, string, number], LoggedRow>(
    `SELECT id, role, content, sourcesJson, createdAt, sessionId, sessionTitle FROM (
       SELECT m.id, m.role, m.content, m.sources_json AS sourcesJson, m.created_at AS createdAt,
              m.session_id AS sessionId, s.title AS sessionTitle, m.rowid AS seq
       FROM messages m JOIN sessions s ON s.id = m.session_id
       WHERE m.user_id = ? AND m.created_at >= ? AND m.created_at < ? AND m.session_id != ?
       ORDER BY createdAt DESC, seq DESC LIMIT ?
     ) ORDER BY createdAt, seq`,
  );
  // An answer with the question it answered.
  const turnColumns = `a.id, a.role, a.content, a.sources_json AS sourcesJson,
    a.created_at AS createdAt, a.session_id AS sessionId, s.title AS sessionTitle,
    COALESCE((SELECT q.content FROM messages q WHERE q.session_id = a.session_id
       AND q.role = 'user' AND q.rowid < a.rowid ORDER BY q.rowid DESC LIMIT 1), '') AS question`;
  // `sessions` is a JSON list of session ids to look in, or null for all of them.
  const selectTurnsMatching = db.prepare<[string, string, string, string | null, number], TurnRow>(
    `SELECT ${turnColumns}
     FROM turns_fts f JOIN messages a ON a.rowid = f.rowid JOIN sessions s ON s.id = a.session_id
     WHERE turns_fts MATCH ?1 AND a.user_id = ?2 AND a.session_id != ?3
       AND (?4 IS NULL OR a.session_id IN (SELECT value FROM json_each(?4)))
     ORDER BY bm25(turns_fts) LIMIT ?5`,
  );
  const selectTurn = db.prepare<[string, string, string], TurnRow>(
    `SELECT ${turnColumns} FROM messages a JOIN sessions s ON s.id = a.session_id
     WHERE a.id = ? AND a.user_id = ? AND a.session_id != ?`,
  );
  const selectFirst = db.prepare<[string], { title: string; createdAt: string; count: number }>(
    `SELECT title, MIN(created_at) AS createdAt, COUNT(*) AS count FROM sessions WHERE user_id = ?`,
  );
  const selectUsers = db.prepare<[], { userId: string }>(
    "SELECT DISTINCT user_id AS userId FROM sessions",
  );

  const addMessage = db.transaction((message: NewMessage): string => {
    const id = message.id ?? crypto.randomUUID();
    insertMessage.run(
      id,
      message.sessionId,
      message.userId,
      message.role,
      message.content,
      JSON.stringify(message.sources ?? []),
      message.meta ? JSON.stringify(message.meta) : null,
      message.createdAt,
    );
    touchSession.run(message.createdAt, message.sessionId);
    return id;
  });

  return {
    createSession(userId: string, title: string, now: string): string {
      const id = crypto.randomUUID();
      insertSession.run(id, userId, title, now, now);
      return id;
    },
    hasSession(userId: string, sessionId: string): boolean {
      return findSession.get(sessionId, userId) !== undefined;
    },
    addMessage,
    listSessions(userId: string, limit = 50): SessionSummary[] {
      return selectSessions.all(userId, limit);
    },
    /** How many sessions the user has, and the first of them. */
    sessionStats(userId: string): { count: number; first?: { title: string; createdAt: string } } {
      const row = selectFirst.get(userId);
      return row?.count ? { count: row.count, first: row } : { count: 0 };
    },
    messages(userId: string, sessionId: string, limit = 500): StoredMessage[] {
      return selectMessages.all(sessionId, userId, limit).map(withSources);
    },
    /** Messages sent in [from, to) in the user's other sessions. */
    messagesBetween(
      userId: string,
      range: { from: Date; to: Date },
      exceptSessionId: string,
      limit: number,
    ): LoggedMessage[] {
      const { from, to } = range;
      return selectBetween
        .all(userId, from.toISOString(), to.toISOString(), exceptSessionId, limit)
        .map(withSources);
    },
    /**
     * The answers in the user's other sessions that match an FTS5 query best, with their
     * questions. `inSessions` narrows the search to those sessions.
     */
    turnsMatching(
      userId: string,
      query: string,
      exceptSessionId: string,
      inSessions: string[] | null,
      limit: number,
    ): LoggedTurn[] {
      const sessions = inSessions ? JSON.stringify(inSessions) : null;
      return selectTurnsMatching
        .all(query, userId, exceptSessionId, sessions, limit)
        .map(withSources);
    },
    /** One answer with its question, unless it is in `exceptSessionId`. */
    turn(userId: string, answerId: string, exceptSessionId: string): LoggedTurn | undefined {
      const row = selectTurn.get(answerId, userId, exceptSessionId);
      return row && withSources(row);
    },
    setTitle(userId: string, sessionId: string, title: string): void {
      updateTitle.run(title, sessionId, userId);
    },
    userIds(): string[] {
      return selectUsers.all().map((row) => row.userId);
    },
  };
}

function withSources<T extends { sourcesJson: string }>({ sourcesJson, ...row }: T) {
  return { ...row, sources: JSON.parse(sourcesJson) as Source[] };
}

export type Store = ReturnType<typeof createStore>;
