import type { DbCell, DbCellUpdate, DbErrorCode, DbObjectKind, DbServerMessage } from '@protocol/db';
import { DbError, redactDriverError } from './errors';
import { assertSingleStatement, isReadOnlyStatement } from './sqlGuard';
import type { DbQueryResult, DbSession } from './types';

/** db- 文本帧的字符上限（< WS 256KiB maxPayload） */
export const DB_CONTROL_MAX_CHARS = 200_000;
/** 单个结果分片的序列化体积上限 */
export const DB_CHUNK_MAX_BYTES = 180 * 1024;
const MAX_SQL_CHARS = 64 * 1024;
const MAX_DATABASE_CHARS = 128;
const MAX_OBJECTS = 2000;
/** 单元格修改时标识符与值的上限 */
const MAX_IDENT_CHARS = 128;
const MAX_CELL_VALUE_CHARS = 8192;

export interface DbGatewayCaps {
  maxRows: number;
  maxResultBytes: number;
  maxTextCellBytes: number;
  queryTimeoutMs: number;
  readOnly: boolean;
}

export interface DbGatewayOptions {
  session: DbSession;
  caps: DbGatewayCaps;
  sendJson: (message: DbServerMessage) => void;
  /** 每个收发的 db 帧调用一次（空闲计时） */
  onActivity: () => void;
  logger?: Pick<Console, 'warn'>;
}

function estimateRowBytes(row: DbCell[]): number {
  let bytes = 16;
  for (const cell of row) {
    if (typeof cell === 'string') bytes += cell.length;
    else if (cell && typeof cell === 'object' && '__bin' in cell) bytes += 32;
    else bytes += 16;
  }
  return bytes;
}

/**
 * 会话内数据库操作网关：db-* 控制帧 → 驱动调用。
 * 所有语句串行执行；结果按体积分片下发（meta → chunk* → end）。
 */
export class DbGateway {
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  /** 被显式取消的请求 id（用于把中断错误翻译成 DB_CANCELED） */
  private readonly cancelled = new Set<number>();

  constructor(private readonly options: DbGatewayOptions) {}

  /** 会话 cleanup 时调用 */
  abortAll(): void {
    this.closed = true;
  }

  /** 处理 db-* 控制消息；返回 true 表示已被网关消费 */
  handleMessage(message: Record<string, unknown>): boolean {
    const type = message.type;
    if (typeof type !== 'string' || !type.startsWith('db-')) return false;
    this.options.onActivity();
    const id = this.readId(message);
    if (id == null) {
      this.fail(null, 'DB_FAILED', '参数不合法');
      return true;
    }
    switch (type) {
      case 'db-list':
        this.onList(id, message);
        return true;
      case 'db-describe':
        this.onDescribe(id, message);
        return true;
      case 'db-indexes':
        this.onIndexes(id, message);
        return true;
      case 'db-foreign-keys':
        this.onForeignKeys(id, message);
        return true;
      case 'db-triggers':
        this.onTriggers(id, message);
        return true;
      case 'db-query':
        this.onQuery(id, message);
        return true;
      case 'db-update':
        this.onUpdate(id, message);
        return true;
      case 'db-routine':
        this.onRoutine(id, message);
        return true;
      case 'db-cancel':
        this.onCancel(id);
        return true;
      default:
        return true;
    }
  }

  // ---------- 基础设施 ----------

  private fail(id: number | null, code: DbErrorCode, message: string): void {
    if (this.closed) return;
    this.options.sendJson({ type: 'db-fail', id, code, message });
  }

  private enqueue(id: number | null, run: () => Promise<void>): void {
    this.queue = this.queue
      .then(run)
      .catch((error) => {
        const cancelled = id != null && this.cancelled.delete(id);
        const code = cancelled
          ? 'DB_CANCELED'
          : (error && typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: DbErrorCode }).code
            : 'DB_FAILED');
        const message = cancelled
          ? '查询已取消'
          : (error instanceof Error ? redactDriverError(error) : '数据库操作失败');
        this.options.logger?.warn?.('[dock-db] op failed:', code);
        this.fail(id, code, message);
      });
  }

  private readId(message: Record<string, unknown>): number | null {
    const id = message.id;
    return typeof id === 'number' && Number.isInteger(id) && id >= 1 ? id : null;
  }

  private readSchema(message: Record<string, unknown>): string | undefined {
    const schema = message.schema;
    return typeof schema === 'string' && schema.length > 0 && schema.length <= 128 ? schema : undefined;
  }

  private readTable(message: Record<string, unknown>): string | null {
    const table = message.table;
    return typeof table === 'string' && table.length > 0 && table.length <= 128 && !table.includes('\0')
      ? table
      : null;
  }

  // ---------- 元数据 ----------

  private onList(id: number, message: Record<string, unknown>): void {
    const kind = message.kind;
    const valid: DbObjectKind[] = ['schemas', 'tables', 'views', 'functions', 'procedures', 'triggers'];
    if (typeof kind !== 'string' || !valid.includes(kind as DbObjectKind)) {
      this.fail(id, 'DB_FAILED', '对象类型不合法');
      return;
    }
    const schema = this.readSchema(message);
    this.enqueue(id, async () => {
      const items = await this.options.session.listObjects(kind as DbObjectKind, schema);
      const truncated = items.length > MAX_OBJECTS;
      this.options.sendJson({
        type: 'db-list',
        id,
        kind: kind as DbObjectKind,
        items: truncated ? items.slice(0, MAX_OBJECTS) : items,
        truncated,
      });
    });
  }

  private onDescribe(id: number, message: Record<string, unknown>): void {
    const table = this.readTable(message);
    if (!table) {
      this.fail(id, 'DB_FAILED', '表名不合法');
      return;
    }
    const schema = this.readSchema(message);
    this.enqueue(id, async () => {
      const columns = await this.options.session.describeTable(schema, table);
      this.options.sendJson({ type: 'db-describe', id, columns });
    });
  }

  private onIndexes(id: number, message: Record<string, unknown>): void {
    const table = this.readTable(message);
    if (!table) {
      this.fail(id, 'DB_FAILED', '表名不合法');
      return;
    }
    const schema = this.readSchema(message);
    this.enqueue(id, async () => {
      const indexes = await this.options.session.listIndexes(schema, table);
      this.options.sendJson({ type: 'db-indexes', id, indexes });
    });
  }

  private onForeignKeys(id: number, message: Record<string, unknown>): void {
    const table = this.readTable(message);
    if (!table) {
      this.fail(id, 'DB_FAILED', '表名不合法');
      return;
    }
    const schema = this.readSchema(message);
    this.enqueue(id, async () => {
      const foreignKeys = await this.options.session.listForeignKeys(schema, table);
      this.options.sendJson({ type: 'db-foreign-keys', id, foreignKeys });
    });
  }

  private onTriggers(id: number, message: Record<string, unknown>): void {
    const table = this.readTable(message);
    if (!table) {
      this.fail(id, 'DB_FAILED', '表名不合法');
      return;
    }
    const schema = this.readSchema(message);
    this.enqueue(id, async () => {
      const triggers = await this.options.session.listTriggers(schema, table);
      this.options.sendJson({ type: 'db-triggers', id, triggers });
    });
  }

  // ---------- 查询 ----------

  private onQuery(id: number, message: Record<string, unknown>): void {
    const sql = typeof message.sql === 'string' ? message.sql : '';
    if (!sql.trim()) {
      this.fail(id, 'DB_FAILED', 'SQL 为空');
      return;
    }
    if (sql.length > MAX_SQL_CHARS) {
      this.fail(id, 'DB_FAILED', 'SQL 过长');
      return;
    }
    try {
      assertSingleStatement(sql);
    } catch (error) {
      this.fail(id, (error as DbError).code ?? 'DB_MULTI_STATEMENT', (error as Error).message);
      return;
    }
    if (this.options.caps.readOnly && !isReadOnlyStatement(sql)) {
      this.fail(id, 'DB_UNSUPPORTED', '服务端开启了只读模式，仅允许查询语句');
      return;
    }
    const requested = Number(message.maxRows);
    const maxRows = Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), this.options.caps.maxRows)
      : this.options.caps.maxRows;
    const requestedOffset = Number(message.offset);
    const offset = Number.isFinite(requestedOffset) && requestedOffset > 0
      ? Math.floor(requestedOffset)
      : 0;
    const database = typeof message.database === 'string' && message.database.length <= MAX_DATABASE_CHARS
      ? message.database
      : undefined;
    this.enqueue(id, async () => {
      const result = await this.options.session.query(sql, {
        maxRows,
        maxResultBytes: this.options.caps.maxResultBytes,
        maxTextCellBytes: this.options.caps.maxTextCellBytes,
        timeoutMs: this.options.caps.queryTimeoutMs,
        offset,
        database,
      });
      this.sendResult(id, result, offset);
    });
  }

  // ---------- 单元格修改 ----------

  private onUpdate(id: number, message: Record<string, unknown>): void {
    if (this.options.caps.readOnly) {
      this.fail(id, 'DB_UNSUPPORTED', '服务端开启了只读模式，不能修改数据');
      return;
    }
    const update = this.readUpdate(message);
    if (!update) {
      this.fail(id, 'DB_FAILED', '修改参数不合法');
      return;
    }
    this.enqueue(id, async () => {
      const affectedRows = await this.options.session.updateCell(update);
      this.options.sendJson({ type: 'db-update-result', id, affectedRows });
    });
  }

  private readUpdate(message: Record<string, unknown>): DbCellUpdate | null {
    const raw = message.update;
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;
    const table = source.table;
    const column = source.column;
    if (typeof table !== 'string' || !table || table.length > MAX_IDENT_CHARS) return null;
    if (typeof column !== 'string' || !column || column.length > MAX_IDENT_CHARS) return null;
    const schema = typeof source.schema === 'string' && source.schema.length <= MAX_IDENT_CHARS
      ? source.schema
      : undefined;
    const value = source.value === null || source.value === undefined ? null : String(source.value).slice(0, MAX_CELL_VALUE_CHARS);
    const keysRaw = Array.isArray(source.keys) ? source.keys : [];
    const keys: Array<{ column: string; value: string | null }> = [];
    for (const item of keysRaw) {
      if (!item || typeof item !== 'object') return null;
      const key = item as Record<string, unknown>;
      if (typeof key.column !== 'string' || !key.column || key.column.length > MAX_IDENT_CHARS) return null;
      keys.push({
        column: key.column,
        value: key.value === null || key.value === undefined ? null : String(key.value).slice(0, MAX_CELL_VALUE_CHARS),
      });
    }
    if (keys.length === 0) return null;
    return { schema, table, column, value, keys };
  }

  // ---------- 存储过程 / 函数 / 触发器 ----------

  private onRoutine(id: number, message: Record<string, unknown>): void {
    const kind = message.kind;
    if (kind !== 'functions' && kind !== 'procedures' && kind !== 'triggers') {
      this.fail(id, 'DB_FAILED', '对象类型不合法');
      return;
    }
    const name = typeof message.name === 'string' ? message.name : '';
    if (!name || name.length > MAX_IDENT_CHARS) {
      this.fail(id, 'DB_FAILED', '对象名不合法');
      return;
    }
    const schema = this.readSchema(message);
    this.enqueue(id, async () => {
      const info = await this.options.session.getRoutine(kind, schema, name);
      this.options.sendJson({
        type: 'db-routine-result',
        id,
        kind,
        name,
        definition: info.definition,
        parameters: info.parameters,
      });
    });
  }

  /** 取消查询：销毁当前连接（驱动层中断语句），会话需要重连 */
  private onCancel(id: number): void {    this.cancelled.add(id);
    try {
      this.options.session.abort();
    } catch {
      /* already dead */
    }
    this.options.sendJson({
      type: 'db-error',
      code: 'DB_CANCELED',
      message: '查询已取消，会话已断开，请重新连接',
    });
  }

  private sendResult(id: number, result: DbQueryResult, offset: number): void {
    this.options.sendJson({
      type: 'db-result-meta',
      id,
      columns: result.columns,
      totalRows: result.rowCount,
      affectedRows: result.affectedRows,
      elapsedMs: result.elapsedMs,
    });

    let seq = 0;
    let buffer: DbCell[][] = [];
    let bufferBytes = 0;
    let totalBytes = 0;
    let truncated = result.truncated;

    for (const row of result.rows) {
      const rowBytes = estimateRowBytes(row);
      if (totalBytes + rowBytes > this.options.caps.maxResultBytes) {
        truncated = true;
        break;
      }
      if (buffer.length > 0 && bufferBytes + rowBytes > DB_CHUNK_MAX_BYTES) {
        this.options.sendJson({ type: 'db-result-chunk', id, seq: seq++, rows: buffer });
        buffer = [];
        bufferBytes = 0;
      }
      buffer.push(row);
      bufferBytes += rowBytes;
      totalBytes += rowBytes;
    }
    if (buffer.length > 0) {
      this.options.sendJson({ type: 'db-result-chunk', id, seq, rows: buffer });
    }
    this.options.sendJson({
      type: 'db-result-end',
      id,
      rowCount: result.rowCount,
      truncated,
      ...(truncated ? { nextOffset: offset + result.rowCount } : {}),
    });
  }
}
