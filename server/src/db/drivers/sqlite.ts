import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import type { DbColumn, DbForeignKeyInfo, DbIndexInfo, DbObjectItem, DbObjectKind, DbTriggerInfo } from '@protocol/db';
import { DbError, mapDriverError } from '../errors';
import type { DbDriver, DbQueryOptions, DbQueryResult, DbSession, DbTarget } from '../types';
import { applyPaging, normalizeCell } from './shared';

const requireFromHere = createRequire(import.meta.url);

/** SQLite 驱动跑在 worker 线程里，避免长查询阻塞服务端事件循环 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const Database = require(workerData.modulePath);
let db;
try {
  db = new Database(workerData.file, { fileMustExist: false });
  db.pragma('busy_timeout = 5000');
} catch (err) {
  db = null;
  parentPort.postMessage({ id: -1, ok: false, error: String(err && err.message || err) });
}
parentPort.on('message', (msg) => {
  if (!db) {
    parentPort.postMessage({ id: msg.id, ok: false, error: 'sqlite open failed' });
    return;
  }
  try {
    const stmt = db.prepare(msg.sql);
    if (msg.mode === 'run' || !stmt.reader) {
      const info = msg.params && msg.params.length ? stmt.run(...msg.params) : stmt.run();
      parentPort.postMessage({ id: msg.id, ok: true, columns: [], rows: [], affectedRows: info.changes });
      return;
    }
    const rows = msg.params && msg.params.length ? stmt.all(...msg.params) : stmt.all();
    const columns = stmt.columns().map((c) => c.name);
    const values = rows.map((row) => columns.map((col) => (row ? row[col] : null)));
    parentPort.postMessage({ id: msg.id, ok: true, columns, rows: values, affectedRows: 0 });
  } catch (err) {
    parentPort.postMessage({ id: msg.id, ok: false, error: String(err && err.message || err) });
  }
});
`;

interface WorkerReply {
  id: number;
  ok: boolean;
  columns?: string[];
  rows?: unknown[][];
  affectedRows?: number;
  error?: string;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

export function assertSafeIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new DbError('DB_INVALID_TARGET', '对象名不合法');
  return `"${name.replace(/"/g, '""')}"`;
}

export class SqliteSession implements DbSession {
  readonly dialect = 'sqlite' as const;
  private broken = false;
  private seq = 0;
  private readonly pending = new Map<number, { resolve: (v: WorkerReply) => void; reject: (e: Error) => void }>();

  constructor(
    private readonly worker: Worker,
    private readonly maxTextBytes: number,
  ) {
    worker.on('message', (reply: WorkerReply) => {
      const entry = this.pending.get(reply.id);
      if (!entry) return;
      this.pending.delete(reply.id);
      entry.resolve(reply);
    });
    worker.on('error', (error) => this.failAll(error));
    worker.on('exit', () => {
      if (!this.broken) this.failAll(new Error('sqlite worker exited'));
    });
  }

  private failAll(error: Error): void {
    this.broken = true;
    for (const entry of this.pending.values()) entry.reject(error);
    this.pending.clear();
  }

  private run(sql: string, mode: 'all' | 'run', timeoutMs: number, params: unknown[] = []): Promise<WorkerReply> {
    if (this.broken) return Promise.reject(new DbError('DB_FAILED', 'SQLite 会话已断开'));
    const id = ++this.seq;
    return new Promise<WorkerReply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.broken = true;
        void this.worker.terminate();
        reject(new DbError('DB_TIMEOUT'));
      }, timeoutMs);
      timer.unref?.();
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.worker.postMessage({ id, sql, mode, params });
    });
  }

  private async all(sql: string, timeoutMs: number, params: unknown[] = []): Promise<{ columns: string[]; rows: unknown[][] }> {
    const reply = await this.run(sql, 'all', timeoutMs, params);
    if (!reply.ok) throw new DbError('DB_QUERY_FAILED', reply.error ?? 'SQLite 执行失败');
    return { columns: reply.columns ?? [], rows: reply.rows ?? [] };
  }

  async query(sql: string, options: DbQueryOptions): Promise<DbQueryResult> {
    const started = Date.now();
    const { sql: finalSql } = applyPaging(sql, options.maxRows, options.offset ?? 0, 'sqlite');
    try {
      const { columns, rows } = await this.all(finalSql, options.timeoutMs);
      const truncated = rows.length > options.maxRows;
      const limited = truncated ? rows.slice(0, options.maxRows) : rows;
      return {
        columns: columns.map((name, index) => ({ name, ordinal: index + 1 })),
        rows: limited.map((row) => row.map((cell) => normalizeCell(cell, options.maxTextCellBytes))),
        rowCount: limited.length,
        truncated,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      throw mapDriverError(error);
    }
  }

  async listObjects(kind: DbObjectKind, schema?: string): Promise<DbObjectItem[]> {
    if (kind === 'schemas') return [{ name: 'main' }];
    if (kind === 'procedures') return [];
    const sql = kind === 'tables'
      ? `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      : kind === 'views'
        ? `SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name`
        : kind === 'functions'
          ? `SELECT name FROM pragma_function_list WHERE type IN ('function', 'aggregate', 'window') GROUP BY name ORDER BY name`
          : `SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name`;
    const { rows } = await this.all(sql, 10_000);
    return rows.map((row) => ({ schema: 'main', name: String(row[0]) }));
  }

  async describeTable(schema: string | undefined, table: string): Promise<DbColumn[]> {
    const { rows } = await this.all(`PRAGMA table_info(${assertSafeIdentifier(table)})`, 10_000);
    return rows.map((row, index) => ({
      name: String(row[1]),
      dataType: row[2] === null ? undefined : String(row[2]),
      nullable: Number(row[3] ?? 0) === 0,
      primary: Number(row[5] ?? 0) > 0,
      ordinal: Number(row[0] ?? index + 1) + 1,
    }));
  }

  async listIndexes(schema: string | undefined, table: string): Promise<DbIndexInfo[]> {
    const { rows } = await this.all(`PRAGMA index_list(${assertSafeIdentifier(table)})`, 10_000);
    const result: DbIndexInfo[] = [];
    for (const row of rows) {
      const name = String(row[1]);
      const { rows: cols } = await this.all(`PRAGMA index_info(${assertSafeIdentifier(name)})`, 10_000);
      result.push({
        name,
        unique: Number(row[2] ?? 0) === 1,
        primary: String(row[3] ?? '') === 'pk',
        columns: cols.map((c) => String(c[2])).filter(Boolean),
      });
    }
    return result;
  }

  async listForeignKeys(schema: string | undefined, table: string): Promise<DbForeignKeyInfo[]> {
    const { rows } = await this.all(`PRAGMA foreign_key_list(${assertSafeIdentifier(table)})`, 10_000);
    const grouped = new Map<number, DbForeignKeyInfo>();
    for (const row of rows) {
      const id = Number(row[0] ?? 0);
      const current = grouped.get(id) ?? {
        name: `fk_${id}`,
        columns: [],
        foreignTable: String(row[2] ?? ''),
        foreignColumns: [],
      };
      current.columns.push(String(row[3]));
      current.foreignColumns.push(String(row[4] ?? ''));
      grouped.set(id, current);
    }
    return [...grouped.values()];
  }

  async listTriggers(schema: string | undefined, table: string): Promise<DbTriggerInfo[]> {
    const { rows } = await this.all(
      `SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?`,
      10_000,
      [table],
    );
    return rows.map((row) => ({ name: String(row[0]), table: String(row[1]) }));
  }

  async close(): Promise<void> {
    this.broken = true;
    await this.worker.terminate();
  }

  /** 中断当前语句：终止 worker 线程 */
  abort(): void {
    this.broken = true;
    void this.worker.terminate();
  }
}

export class SqliteDriver implements DbDriver {
  readonly dialect = 'sqlite' as const;

  async connect(target: DbTarget): Promise<DbSession> {
    if (!target.file) throw new DbError('DB_INVALID_TARGET', '未配置 SQLite 文件路径');
    let modulePath: string;
    try {
      modulePath = requireFromHere.resolve('better-sqlite3');
    } catch {
      throw new DbError('DB_CONNECT_FAILED', '服务端未安装 SQLite 驱动');
    }
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { modulePath, file: target.file },
    });
    await new Promise<void>((resolve, reject) => {
      const onMessage = (reply: WorkerReply) => {
        if (reply.id === -1) {
          reject(new DbError('DB_CONNECT_FAILED', reply.error ?? '无法打开 SQLite 文件'));
        }
      };
      worker.on('message', onMessage);
      worker.once('error', (error) => reject(mapDriverError(error)));
      worker.once('exit', () => resolve());
      setTimeout(() => resolve(), 200);
    });
    return new SqliteSession(worker, 64 * 1024);
  }
}
