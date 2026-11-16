import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface ServerConfig {
  host: string;
  port: number;
  dbPath: string;
  adminSecret: string;
  apiToken: string;
  dataKey: string;
  dataKeyOld?: string;
  sessionDays: number;
  historyLimit: number;
  publicOrigin?: string;
  cookieSecure: boolean;
  trustProxy: boolean;
  webDist: string;
  sshEnabled: boolean;
  sshMaxSessions: number;
  sshMaxPerServer: number;
  sshIdleMs: number;
  sshTicketTtlMs: number;
  sshFsEnabled: boolean;
  sshFsMaxEdit: number;
  sshFsMaxTransfer: number;
  dbEnabled: boolean;
  dbMaxSessions: number;
  dbMaxPerMiddleware: number;
  dbIdleMs: number;
  dbTicketTtlMs: number;
  dbConnectTimeoutMs: number;
  dbQueryTimeoutMs: number;
  dbMaxRows: number;
  dbMaxResultBytes: number;
  dbMaxTextCellBytes: number;
  dbSqliteRoots: string[];
  dbReadOnly: boolean;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function parseDays(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(3650, Math.max(1, Math.floor(parsed)));
}

function parseHistoryLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1000, Math.max(1, Math.floor(parsed)));
}

function parseLimit(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const adminSecret = required(env, 'DOCK_ADMIN_SECRET');
  const apiToken = required(env, 'DOCK_API_TOKEN');
  const dataKey = env.DOCK_DATA_KEY?.trim() || adminSecret;
  if (dataKey.length < 32) {
    throw new Error('DOCK_DATA_KEY must be at least 32 characters (or set a long DOCK_ADMIN_SECRET)');
  }

  const dbPath = env.DOCK_DB?.trim() || './data/dock.sqlite';
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  }

  const publicOrigin = env.DOCK_PUBLIC_ORIGIN?.trim() || undefined;
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('DOCK_PUBLIC_ORIGIN must be http(s)');
  }

  return {
    host: env.HOST?.trim() || '0.0.0.0',
    port: Number(env.PORT) || 8080,
    dbPath,
    adminSecret,
    apiToken,
    dataKey,
    dataKeyOld: env.DOCK_DATA_KEY_OLD?.trim() || undefined,
    sessionDays: parseDays(env.DOCK_SESSION_DAYS, 30),
    historyLimit: parseHistoryLimit(env.DOCK_HISTORY_LIMIT, 100),
    publicOrigin,
    cookieSecure: env.DOCK_COOKIE_SECURE !== 'false',
    trustProxy: env.DOCK_TRUST_PROXY === 'true',
    webDist: resolve(env.DOCK_WEB_DIST?.trim() || '../dist-web'),
    sshEnabled: env.DOCK_SSH_ENABLED !== 'false',
    sshMaxSessions: parseLimit(env.DOCK_SSH_MAX_SESSIONS, 8, 1, 64),
    sshMaxPerServer: parseLimit(env.DOCK_SSH_MAX_PER_SERVER, 2, 1, 16),
    sshIdleMs: parseLimit(env.DOCK_SSH_IDLE_MS, 30 * 60_000, 60_000, 24 * 60 * 60_000),
    sshTicketTtlMs: parseLimit(env.DOCK_SSH_TICKET_TTL_MS, 30_000, 5_000, 5 * 60_000),
    sshFsEnabled: env.DOCK_SSH_FS_ENABLED !== 'false',
    sshFsMaxEdit: parseLimit(env.DOCK_SSH_FS_MAX_EDIT, 2 * 1024 * 1024, 1024, 64 * 1024 * 1024),
    sshFsMaxTransfer: parseLimit(env.DOCK_SSH_FS_MAX_TRANSFER, 200 * 1024 * 1024, 1024, 2 * 1024 * 1024 * 1024),
    dbEnabled: env.DOCK_DB_ENABLED !== 'false',
    dbMaxSessions: parseLimit(env.DOCK_DB_MAX_SESSIONS, 8, 1, 64),
    dbMaxPerMiddleware: parseLimit(env.DOCK_DB_MAX_PER_MIDDLEWARE, 2, 1, 16),
    dbIdleMs: parseLimit(env.DOCK_DB_IDLE_MS, 30 * 60_000, 60_000, 24 * 60 * 60_000),
    dbTicketTtlMs: parseLimit(env.DOCK_DB_TICKET_TTL_MS, 30_000, 5_000, 5 * 60_000),
    dbConnectTimeoutMs: parseLimit(env.DOCK_DB_CONNECT_TIMEOUT_MS, 8_000, 1_000, 120_000),
    dbQueryTimeoutMs: parseLimit(env.DOCK_DB_QUERY_TIMEOUT_MS, 30_000, 1_000, 10 * 60_000),
    dbMaxRows: parseLimit(env.DOCK_DB_MAX_ROWS, 500, 1, 5_000),
    dbMaxResultBytes: parseLimit(env.DOCK_DB_MAX_RESULT_BYTES, 2 * 1024 * 1024, 1024, 64 * 1024 * 1024),
    dbMaxTextCellBytes: parseLimit(env.DOCK_DB_MAX_TEXT_CELL_BYTES, 64 * 1024, 256, 1024 * 1024),
    dbSqliteRoots: (env.DOCK_DB_SQLITE_ROOTS?.trim() || './data/sqlite')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => resolve(s)),
    dbReadOnly: env.DOCK_DB_READ_ONLY === 'true',
  };
}
