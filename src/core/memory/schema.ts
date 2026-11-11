// The message log is the source of truth.
export const LOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions (user_id, updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  meta_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_by_session ON messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS messages_by_user_time ON messages (user_id, created_at);
`;

// A keyword index over the log itself: one row per answer, holding the question and the answer.
// Advice (directions, an agenda, a recipe) leaves no saved memory, so this is how it is found.
// It stores no text of its own (content = ''), and a trigger keeps it up to date.
const TURN_TEXT = `COALESCE((SELECT q.content FROM messages q WHERE q.session_id = a.session_id
  AND q.role = 'user' AND q.rowid < a.rowid ORDER BY q.rowid DESC LIMIT 1), '') || ' ' || a.content`;
export const TURN_INDEX_SCHEMA = `
CREATE VIRTUAL TABLE turns_fts USING fts5 (text, content = '', tokenize = 'porter unicode61');
CREATE TRIGGER turns_fts_insert AFTER INSERT ON messages WHEN new.role = 'assistant' BEGIN
  INSERT INTO turns_fts (rowid, text)
  SELECT a.rowid, ${TURN_TEXT} FROM messages a WHERE a.rowid = new.rowid;
END;
INSERT INTO turns_fts (rowid, text)
SELECT a.rowid, ${TURN_TEXT} FROM messages a WHERE a.role = 'assistant';
`;

// Memories are derived from the log, so all of this can be dropped and rebuilt (npm run reindex).
export const MEMORY_SCHEMA = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('preference', 'fact', 'decision', 'claim')),
  text TEXT NOT NULL,
  topic TEXT NOT NULL,
  source_url TEXT,
  subject TEXT,
  observed_at TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions (id),
  message_id TEXT NOT NULL REFERENCES messages (id),
  hash TEXT NOT NULL,
  UNIQUE (user_id, hash)
);

CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  norm TEXT NOT NULL,
  UNIQUE (user_id, norm)
);

CREATE TABLE IF NOT EXISTS memory_entities (
  memory_id TEXT NOT NULL REFERENCES memories (id),
  entity_id INTEGER NOT NULL REFERENCES entities (id),
  PRIMARY KEY (memory_id, entity_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5 (
  memory_id UNINDEXED, text, topic, tokenize = 'porter unicode61'
);

-- For finding a memory by meaning: its embedding, as raw 32-bit floats.
CREATE TABLE IF NOT EXISTS memory_vectors (
  memory_id TEXT PRIMARY KEY REFERENCES memories (id),
  vector BLOB NOT NULL
);

-- Answers whose turn has been through extraction, whether or not it produced memories.
CREATE TABLE IF NOT EXISTS memorized (
  message_id TEXT PRIMARY KEY REFERENCES messages (id)
);
`;
