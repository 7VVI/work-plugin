import { Client } from 'pg';
import type { DbColumn, DbForeignKeyInfo, DbIndexInfo, DbObjectItem, DbObjectKind, DbTriggerInfo } from '@protocol/db';
import { DbError, mapDriverError } from '../errors';
import type { DbDriver, DbQueryOptions, DbQueryResult, DbSession, DbTarget } from '../types';
import { applyPaging, columnsFromNames, normalizeCell } from './shared';

export const PG_LIST_SQL: Record<DbObjectKind, string> = {
  schemas: `SELECT n.nspname AS name
    FROM pg_namespace n
    WHERE n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
    ORDER BY 1`,
  tables: `SELECT n.nspname AS schema_name, c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
      AND ($1::text[] IS NULL OR n.nspname = ANY($1::text[]))
    ORDER BY 1, 2`,
  views: `SELECT n.nspname AS schema_name, c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm') AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
      AND ($1::text[] IS NULL OR n.nspname = ANY($1::text[]))
    ORDER BY 1, 2`,
  functions: `SELECT n.nspname AS schema_name, p.proname AS name, 'function' AS detail
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'f' AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
      AND ($1::text[] IS NULL OR n.nspname = ANY($1::text[]))
    ORDER BY 1, 2`,
  procedures: `SELECT n.nspname AS schema_name, p.proname AS name, 'procedure' AS detail
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'p' AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
      AND ($1::text[] IS NULL OR n.nspname = ANY($1::text[]))
    ORDER BY 1, 2`,
  triggers: `SELECT n.nspname AS schema_name, t.tgname AS name, c.relname AS detail
    FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
      AND ($1::text[] IS NULL OR n.nspname = ANY($1::text[]))
    ORDER BY 1, 2`,
};

export const PG_DESCRIBE_SQL = `SELECT c.column_name AS name, c.data_type AS data_type,
    c.is_nullable = 'YES' AS is_nullable,
    c.ordinal_position AS ordinal,
    COALESCE(pk.is_pk, false) AS is_primary
  FROM information_schema.columns c
  LEFT JOIN (
    SELECT ku.table_schema, ku.table_name, ku.column_name
      FROM information_schema.key_column_usage ku
      JOIN information_schema.table_constraints tc
        ON tc.constraint_name = ku.constraint_name AND tc.constraint_schema = ku.constraint_schema
     WHERE tc.constraint_type = 'PRIMARY KEY'
  ) pk ON pk.table_schema = c.table_schema AND pk.table_name = c.table_name AND pk.column_name = c.column_name
  WHERE c.table_schema = $1 AND c.table_name = $2
  ORDER BY c.ordinal_position`;

export const PG_INDEX_SQL = `SELECT i.relname AS name, ix.indisunique AS is_unique,
    ix.indisprimary AS is_primary, pg_get_indexdef(ix.indexrelid) AS definition
  FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class c ON c.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = $1 AND c.relname = $2
  ORDER BY 1`;

export const PG_FOREIGN_KEY_SQL = `SELECT tc.constraint_name AS name, kcu.column_name AS column_name,
    ccu.table_schema AS foreign_schema, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
  FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1 AND tc.table_name = $2
  ORDER BY 1, 2`;

export const PG_TRIGGER_SQL = `SELECT t.tgname AS name, c.relname AS table_name,
    pg_get_triggerdef(t.oid) AS definition
  FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal AND n.nspname = $1 AND c.relname = $2
  ORDER BY 1`;

class PostgresSession implements DbSession {
  readonly dialect = 'postgres' as const;

  constructor(private readonly client: Client) {}

  private async raw(sql: string, params: unknown[] = []): Promise<{ fields: string[]; rows: unknown[][] }> {
    const res = await this.client.query({ text: sql, values: params, rowMode: 'array' });
    return {
      fields: res.fields.map((f) => f.name),
      rows: res.rows as unknown[][],
    };
  }

  async query(sql: string, options: DbQueryOptions): Promise<DbQueryResult> {
    const started = Date.now();
    const { sql: finalSql } = applyPaging(sql, options.maxRows, options.offset ?? 0, 'postgres');
    try {
      const { fields, rows } = await this.raw(finalSql);
      const truncated = rows.length > options.maxRows;
      const limited = truncated ? rows.slice(0, options.maxRows) : rows;
      return {
        columns: columnsFromNames(fields),
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
    if (kind === 'schemas') {
      const { rows } = await this.raw(PG_LIST_SQL.schemas);
      return rows.map((row) => ({ name: String(row[0]) }));
    }
    const params = schema ? [schema] : [null];
    const { rows } = await this.raw(PG_LIST_SQL[kind], params);
    return rows.map((row) => ({
      schema: row[0] === null || row[0] === undefined ? undefined : String(row[0]),
      name: String(row[1]),
      detail: row[2] === null || row[2] === undefined ? undefined : String(row[2]),
    }));
  }

  async describeTable(schema: string | undefined, table: string): Promise<DbColumn[]> {
    const { rows } = await this.raw(PG_DESCRIBE_SQL, [schema ?? 'public', table]);
    return rows.map((row, index) => ({
      name: String(row[0]),
      dataType: row[1] === null ? undefined : String(row[1]),
      nullable: Boolean(row[2]),
      primary: Boolean(row[3]),
      ordinal: Number(row[4] ?? index + 1),
    }));
  }

  async listIndexes(schema: string | undefined, table: string): Promise<DbIndexInfo[]> {
    const { rows } = await this.raw(PG_INDEX_SQL, [schema ?? 'public', table]);
    return rows.map((row) => ({
      name: String(row[0]),
      unique: Boolean(row[1]),
      primary: Boolean(row[2]),
      columns: [],
      definition: row[3] === null ? undefined : String(row[3]),
    }));
  }

  async listForeignKeys(schema: string | undefined, table: string): Promise<DbForeignKeyInfo[]> {
    const { rows } = await this.raw(PG_FOREIGN_KEY_SQL, [schema ?? 'public', table]);
    const grouped = new Map<string, DbForeignKeyInfo>();
    for (const row of rows) {
      const name = String(row[0]);
      const current = grouped.get(name) ?? {
        name,
        columns: [],
        foreignSchema: row[2] === null ? undefined : String(row[2]),
        foreignTable: String(row[3] ?? ''),
        foreignColumns: [],
      };
      current.columns.push(String(row[1]));
      current.foreignColumns.push(String(row[4]));
      grouped.set(name, current);
    }
    return [...grouped.values()];
  }

  async listTriggers(schema: string | undefined, table: string): Promise<DbTriggerInfo[]> {
    const { rows } = await this.raw(PG_TRIGGER_SQL, [schema ?? 'public', table]);
    return rows.map((row) => ({
      name: String(row[0]),
      table: row[1] === null ? undefined : String(row[1]),
      definition: row[2] === null ? undefined : String(row[2]),
    }));
  }

  async close(): Promise<void> {
    await this.client.end().catch(() => undefined);
  }

  /** 中断当前语句：直接销毁连接 */
  abort(): void {
    void this.client.end().catch(() => undefined);
  }
}

export class PostgresDriver implements DbDriver {
  readonly dialect = 'postgres' as const;

  async connect(target: DbTarget, options: { connectTimeoutMs: number }): Promise<DbSession> {
    const client = new Client({
      host: target.host,
      port: target.port,
      user: target.username,
      password: target.password,
      database: target.database,
      ssl: target.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: options.connectTimeoutMs,
      statement_timeout: options.connectTimeoutMs * 4,
      application_name: String(target.params?.application_name ?? 'dock-db'),
    });
    client.on('error', () => { /* 连接异常由调用方处理 */ });
    try {
      await client.connect();
    } catch (error) {
      await client.end().catch(() => undefined);
      throw mapDriverError(error);
    }
    return new PostgresSession(client);
  }
}

export function assertPostgresDialect(dialect: string): void {
  if (dialect !== 'postgres') throw new DbError('DB_TYPE_UNSUPPORTED');
}
