import { createClient, type ClickHouseClient } from '@clickhouse/client';
import type { DbCell, DbCellUpdate, DbColumn, DbForeignKeyInfo, DbIndexInfo, DbObjectItem, DbObjectKind, DbRoutineInfo, DbTriggerInfo } from '@protocol/db';
import { DbError, mapDriverError } from '../errors';
import type { DbDriver, DbQueryOptions, DbQueryResult, DbSession, DbTarget } from '../types';
import { applyPaging, columnsFromNames, normalizeCell, useDatabaseSql } from './shared';

export const CH_LIST_SQL: Record<DbObjectKind, string> = {
  schemas: `SELECT name FROM system.databases
    WHERE name NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA') ORDER BY name`,
  tables: `SELECT database AS schema_name, name, engine FROM system.tables
    WHERE database = {database:String} AND engine NOT LIKE '%View' ORDER BY name`,
  views: `SELECT database AS schema_name, name, engine FROM system.tables
    WHERE database = {database:String} AND engine LIKE '%View' ORDER BY name`,
  functions: `SELECT name FROM system.functions WHERE origin != 'System' ORDER BY name`,
  procedures: `SELECT name FROM system.tables WHERE 0`,
  triggers: `SELECT name FROM system.tables WHERE 0`,
};

export const CH_DESCRIBE_SQL = `SELECT name, type, default_kind, comment FROM system.columns
  WHERE database = {database:String} AND table = {table:String} ORDER BY position`;

export const CH_INDEX_SQL = `SELECT name, type, expr, granularity FROM system.data_skipping_indices
  WHERE database = {database:String} AND table = {table:String} ORDER BY name`;

class ClickhouseSession implements DbSession {
  readonly dialect = 'clickhouse' as const;

  /** 当前查询使用的库（HTTP 协议无会话状态，每次查询随参数带上） */
  private currentDb: string;

  constructor(
    private readonly client: ClickHouseClient,
    database: string,
  ) {
    this.currentDb = database;
  }

  private async queryRows(
    sql: string,
    params: Record<string, unknown> = {},
  ): Promise<{ columns: string[]; rows: unknown[][] }> {
    const result = await this.client.query({
      query: sql,
      format: 'JSONCompact',
      query_params: { database: this.currentDb, ...params },
    });
    const payload = (await result.json()) as {
      meta?: Array<{ name: string; type: string }>;
      data?: unknown[][];
    };
    const columns = (payload.meta ?? []).map((c) => c.name);
    return { columns, rows: payload.data ?? [] };
  }

  /** 切到目标库，之后可以用不带库名的表名 */
  private switchDatabase(database?: string): void {
    const target = database?.trim();
    if (!target) return;
    if (!useDatabaseSql('clickhouse', target)) return;
    this.currentDb = target;
  }

  async query(sql: string, options: DbQueryOptions): Promise<DbQueryResult> {
    const started = Date.now();
    this.switchDatabase(options.database);
    const { sql: finalSql } = applyPaging(sql, options.maxRows, options.offset ?? 0, 'clickhouse');
    try {
      const { columns, rows } = await this.queryRows(finalSql);
      const truncated = rows.length > options.maxRows;
      const limited = truncated ? rows.slice(0, options.maxRows) : rows;
      return {
        columns: columnsFromNames(columns),
        rows: limited.map((row) => row.map((cell) => normalizeCell(cell, options.maxTextCellBytes))),
        rowCount: limited.length,
        truncated,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      throw mapDriverError(error);
    }
  }

  /** ClickHouse 不支持直接改单行数据 */
  async updateCell(): Promise<number> {
    throw new DbError('DB_UNSUPPORTED', 'ClickHouse 不支持直接修改数据');
  }

  /** ClickHouse 没有存储过程 */
  async getRoutine(): Promise<DbRoutineInfo> {
    throw new DbError('DB_UNSUPPORTED', 'ClickHouse 不支持存储过程');
  }

  async listObjects(kind: DbObjectKind, schema?: string): Promise<DbObjectItem[]> {
    if (kind === 'schemas') {
      const { rows } = await this.queryRows(CH_LIST_SQL.schemas);
      return rows.map((row) => ({ name: String(row[0]) }));
    }
    const database = schema ?? this.currentDb;
    const { rows } = await this.queryRows(CH_LIST_SQL[kind], { database });
    if (kind === 'functions' || kind === 'procedures' || kind === 'triggers') {
      return rows.map((row) => ({ name: String(row[0]) }));
    }
    return rows.map((row) => ({
      schema: row[0] === null || row[0] === undefined ? undefined : String(row[0]),
      name: String(row[1]),
      detail: row[2] === null || row[2] === undefined ? undefined : String(row[2]),
    }));
  }

  async describeTable(schema: string | undefined, table: string): Promise<DbColumn[]> {
    const { rows } = await this.queryRows(CH_DESCRIBE_SQL, {
      database: schema ?? this.currentDb,
      table,
    });
    return rows.map((row, index) => ({
      name: String(row[0]),
      dataType: row[1] === null ? undefined : String(row[1]),
      nullable: true,
      primary: false,
      ordinal: index + 1,
    }));
  }

  async listIndexes(schema: string | undefined, table: string): Promise<DbIndexInfo[]> {
    const { rows } = await this.queryRows(CH_INDEX_SQL, {
      database: schema ?? this.currentDb,
      table,
    });
    return rows.map((row) => ({
      name: String(row[0]),
      unique: false,
      primary: false,
      columns: [],
      definition: row[2] === null ? undefined : String(row[2]),
    }));
  }

  async listForeignKeys(): Promise<DbForeignKeyInfo[]> {
    return [];
  }

  async listTriggers(): Promise<DbTriggerInfo[]> {
    return [];
  }

  async close(): Promise<void> {
    await this.client.close().catch(() => undefined);
  }

  /** 中断当前语句：关闭客户端连接 */
  abort(): void {
    void this.client.close().catch(() => undefined);
  }
}

export class ClickhouseDriver implements DbDriver {
  readonly dialect = 'clickhouse' as const;

  async connect(target: DbTarget, options: { connectTimeoutMs: number }): Promise<DbSession> {
    const protocol = target.ssl ? 'https' : 'http';
    const url = `${protocol}://${target.host}:${target.port}`;
    const client = createClient({
      url,
      username: target.username ?? 'default',
      password: target.password ?? '',
      database: target.database ?? 'default',
      request_timeout: options.connectTimeoutMs * 4,
      clickhouse_settings: {
        max_result_rows: '100000',
        max_result_bytes: String(64 * 1024 * 1024),
      },
    });
    try {
      await client.query({ query: 'SELECT 1', format: 'JSONEachRow' });
    } catch (error) {
      await client.close().catch(() => undefined);
      throw mapDriverError(error);
    }
    return new ClickhouseSession(client, target.database ?? 'default');
  }
}
