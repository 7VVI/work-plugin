import type {
  DbCell,
  DbColumn,
  DbErrorCode,
  DbForeignKeyInfo,
  DbIndexInfo,
  DbObjectItem,
  DbObjectKind,
  DbServerMessage,
  DbTriggerInfo,
} from '@protocol/db';
import type { DbSocket } from './DbSocket';

export interface DbQueryOutcome {
  columns: DbColumn[];
  rows: DbCell[][];
  rowCount: number;
  affectedRows?: number;
  truncated: boolean;
  elapsedMs: number;
  /** 还有下一页时的起始行 */
  nextOffset?: number;
}

export class DbRequestError extends Error {
  readonly code: DbErrorCode;

  constructor(code: DbErrorCode, message: string) {
    super(message);
    this.name = 'DbRequestError';
    this.code = code;
  }
}

interface PendingOp {
  resolve: (value: never) => void;
  reject: (error: Error) => void;
  /** 查询结果的三段式聚合状态 */
  query?: {
    columns: DbColumn[];
    rows: DbCell[][];
    totalRows: number;
    affectedRows?: number;
    elapsedMs: number;
    truncated: boolean;
  };
}

const TERMINAL_TYPES = new Set([
  'db-list',
  'db-describe',
  'db-indexes',
  'db-foreign-keys',
  'db-triggers',
  'db-result-end',
]);

/**
 * 数据库请求-响应客户端：请求带自增 id，服务端按 id 回帧；
 * 查询结果按 meta → chunk* → end 三段聚合。
 */
export class DbClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingOp>();
  private disposed = false;

  constructor(private readonly socket: DbSocket) {
    socket.onDbMessage = (message: DbServerMessage) => this.handle(message);
  }

  listObjects(kind: DbObjectKind, schema?: string): Promise<DbObjectItem[]> {
    return this.request('db-list', { kind, schema }) as Promise<DbObjectItem[]>;
  }

  describeTable(schema: string | undefined, table: string): Promise<DbColumn[]> {
    return this.request('db-describe', { schema, table }) as Promise<DbColumn[]>;
  }

  listIndexes(schema: string | undefined, table: string): Promise<DbIndexInfo[]> {
    return this.request('db-indexes', { schema, table }) as Promise<DbIndexInfo[]>;
  }

  listForeignKeys(schema: string | undefined, table: string): Promise<DbForeignKeyInfo[]> {
    return this.request('db-foreign-keys', { schema, table }) as Promise<DbForeignKeyInfo[]>;
  }

  listTriggers(schema: string | undefined, table: string): Promise<DbTriggerInfo[]> {
    return this.request('db-triggers', { schema, table }) as Promise<DbTriggerInfo[]>;
  }

  query(
    sql: string,
    options: { maxRows?: number; offset?: number; onRequestId?: (id: number) => void } = {},
  ): Promise<DbQueryOutcome> {
    const { onRequestId, ...payload } = options;
    return this.request('db-query', { sql, ...payload }, onRequestId) as Promise<DbQueryOutcome>;
  }

  /** 取消正在执行的查询（服务端会中断语句并断开会话） */
  cancel(id: number): void {
    this.socket.send({ type: 'db-cancel', id });
  }

  dispose(): void {
    this.disposed = true;
    for (const op of this.pending.values()) {
      op.reject(new DbRequestError('DB_CANCELED', '会话已关闭'));
    }
    this.pending.clear();
  }

  private request(type: string, payload: Record<string, unknown>, onRequestId?: (id: number) => void): Promise<unknown> {
    if (this.disposed) {
      return Promise.reject(new DbRequestError('DB_CANCELED', '会话已关闭'));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: never) => void,
        reject,
      });
      this.socket.send({ type, id, ...payload } as never);
      onRequestId?.(id);
    });
  }

  private handle(message: DbServerMessage): void {
    if (message.type === 'db-fail') {
      const op = message.id == null ? undefined : this.pending.get(message.id);
      if (!op) return;
      this.pending.delete(message.id!);
      op.reject(new DbRequestError(message.code, message.message));
      return;
    }
    if (!('id' in message) || typeof message.id !== 'number') return;
    const op = this.pending.get(message.id);
    if (!op) return;

    if (message.type === 'db-result-meta') {
      op.query = {
        columns: message.columns,
        rows: [],
        totalRows: message.totalRows,
        affectedRows: message.affectedRows,
        elapsedMs: message.elapsedMs,
        truncated: false,
      };
      return;
    }
    if (message.type === 'db-result-chunk') {
      if (!op.query) return;
      op.query.rows.push(...message.rows);
      return;
    }
    if (message.type === 'db-result-end') {
      this.pending.delete(message.id);
      const query = op.query;
      op.resolve((query
        ? {
            columns: query.columns,
            rows: query.rows,
            rowCount: message.rowCount,
            affectedRows: query.affectedRows,
            truncated: message.truncated || query.truncated,
            elapsedMs: query.elapsedMs,
            nextOffset: message.nextOffset,
          }
        : {
            columns: [],
            rows: [],
            rowCount: message.rowCount,
            truncated: message.truncated,
            elapsedMs: 0,
            nextOffset: message.nextOffset,
          }) as never);
      return;
    }
    if (TERMINAL_TYPES.has(message.type)) {
      this.pending.delete(message.id);
      op.resolve((payloadOf(message) ?? message) as never);
    }
  }
}

/** 终态帧里真正要交给调用方的数据 */
function payloadOf(message: DbServerMessage): unknown {
  switch (message.type) {
    case 'db-list':
      return message.items;
    case 'db-describe':
      return message.columns;
    case 'db-indexes':
      return message.indexes;
    case 'db-foreign-keys':
      return message.foreignKeys;
    case 'db-triggers':
      return message.triggers;
    default:
      return null;
  }
}
