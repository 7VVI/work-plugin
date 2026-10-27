import Database from 'better-sqlite3';

export type Db = Database.Database;

export interface SessionRow {
  token_hash: string;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
  auth_epoch: string;
}

export interface StateRow {
  id: number;
  schema_version: number;
  revision: number;
  state_hash: string;
  updated_at: number;
  key_id: string;
  iv: Buffer;
  tag: Buffer;
  payload: Buffer;
}

export interface VersionRow {
  revision: number;
  created_at: number;
  note: string | null;
  summary: string;
  state_hash: string;
  key_id: string;
  iv: Buffer;
  tag: Buffer;
  payload: Buffer;
}

export function openDatabase(path: string): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      state_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      key_id TEXT NOT NULL,
      iv BLOB NOT NULL,
      tag BLOB NOT NULL,
      payload BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      auth_epoch TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS versions (
      revision INTEGER PRIMARY KEY,
      created_at INTEGER NOT NULL,
      note TEXT,
      summary TEXT NOT NULL,
      state_hash TEXT NOT NULL,
      key_id TEXT NOT NULL,
      iv BLOB NOT NULL,
      tag BLOB NOT NULL,
      payload BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_versions_created ON versions(created_at DESC);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getMeta(db: Db, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMeta(db: Db, key: string, value: string): void {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

export function getSetting(db: Db, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, Date.now());
}

export function getSessionDays(db: Db, fallback: number): number {
  const raw = getSetting(db, 'session_days');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(3650, Math.max(1, Math.floor(parsed)));
}

export function createSession(db: Db, tokenHash: string, epoch: string, days: number): { expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + days * 24 * 60 * 60 * 1000;
  db.prepare(`
    INSERT INTO sessions (token_hash, created_at, expires_at, last_seen_at, auth_epoch)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenHash, now, expiresAt, now, epoch);
  return { expiresAt };
}

export function findSession(db: Db, tokenHash: string, epoch: string, now = Date.now()): SessionRow | undefined {
  const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash) as SessionRow | undefined;
  if (!row) return undefined;
  if (row.expires_at <= now || row.auth_epoch !== epoch) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return undefined;
  }
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(now, tokenHash);
  return row;
}

export function deleteSession(db: Db, tokenHash: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function deleteAllSessions(db: Db): void {
  db.prepare('DELETE FROM sessions').run();
}

export function clampSessions(db: Db, days: number): void {
  const maxAge = days * 24 * 60 * 60 * 1000;
  db.prepare('UPDATE sessions SET expires_at = MIN(expires_at, created_at + ?)').run(maxAge);
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

export function pruneExpiredSessions(db: Db, now = Date.now()): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}
