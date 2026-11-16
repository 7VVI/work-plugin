import { Connection, Request, TYPES } from 'tedious';
import type { DbColumn, DbForeignKeyInfo, DbIndexInfo, DbObjectItem, DbObjectKind, DbTriggerInfo } from '@protocol/db';
import { DbError, mapDriverError } from '../errors';
import type { DbDriver, DbQueryOptions, DbQueryResult, DbSession, DbTarget } from '../types';
import { applyPaging, columnsFromNames, normalizeCell } from './shared';

export const MSSQL_LIST_SQL: Record<DbObjectKind, string> = {
  schemas: `SELECT name FROM sys.schemas
    WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', 'db_owner', 'db_accessadmin',
      'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader', 'db_datawriter',
      'db_denydatareader', 'db_denydatawriter')
    ORDER BY name`,
  tables: `SELECT s.name AS schema_name, t.name AS name FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE (@schema IS NULL OR s.name = @schema) ORDER BY 1, 2`,
  views: `SELECT s.name AS schema_name, v.name AS name FROM sys.views v
    JOIN sys.schemas s ON s.schema_id = v.schema_id
    WHERE (@schema IS NULL OR s.name = @schema) ORDER BY 1, 2`,
  functions: `SELECT s.name AS schema_name, o.name AS name, o.type AS detail FROM sys.objects o
    JOIN sys.schemas s ON s.schema_id = o.schema_id
    WHERE o.type IN ('FN', 'IF', 'TF', 'AF') AND (@schema IS NULL OR s.name = @schema)
    ORDER BY 1, 2`,
  procedures: `SELECT s.name AS schema_name, p.name AS name, 'procedure' AS detail FROM sys.procedures p
    JOIN sys.schemas s ON s.schema_id = p.schema_id
    WHERE (@schema IS NULL OR s.name = @schema) ORDER BY 1, 2`,
  triggers: `SELECT s.name AS schema_name, tr.name AS name, OBJECT_NAME(tr.parent_id) AS detail FROM sys.triggers tr
    JOIN sys.schemas s ON s.schema_id = tr.schema_id
    WHERE (@schema IS NULL OR s.name = @schema) ORDER BY 1, 2`,
};

export const MSSQL_DESCRIBE_SQL = `SELECT c.name AS name, ty.name AS data_type,
    c.is_nullable AS is_nullable, c.column_id AS ordinal
  FROM sys.columns c
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = @schema AND t.name = @table ORDER BY c.column_id`;

export const MSSQL_INDEX_SQL = `SELECT i.name AS name, i.is_unique AS is_unique,
    i.is_primary_key AS is_primary, c.name AS column_name, ic.key_ordinal AS seq
  FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
    JOIN sys.tables t ON t.object_id = i.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = @schema AND t.name = @table ORDER BY i.name, ic.key_ordinal`;

export const MSSQL_FOREIGN_KEY_SQL = `SELECT fk.name AS name, cp.name AS column_name,
    rt.name AS foreign_table, cr.name AS foreign_column
  FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns cp ON cp.object_id = fkc.parent_object_id AND cp.column_id = fkc.parent_column_id
    JOIN sys.columns cr ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
    JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
    JOIN sys.schemas s ON s.schema_id = rt.schema_id
  WHERE fk.parent_object_id = OBJECT_ID(@qualified) ORDER BY fk.name`;

export const MSSQL_TRIGGER_SQL = `SELECT tr.name AS name, OBJECT_NAME(tr.parent_id) AS table_name
  FROM sys.triggers tr
    JOIN sys.tables t ON t.object_id = tr.parent_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = @schema AND t.name = @table ORDER BY tr.name`;

interface QueryOutcome {
  columns: string[];
  rows: unknown[][];
  affectedRows: number;
}

class MssqlSession implements DbSession {
  readonly dialect = 'mssql' as const;

  constructor(private readonly conn: Connection) {}

  private exec(sql: string, params: Array<{ name: string; value: string | null }>, timeoutMs: number): Promise<QueryOutcome> {
    return new Promise<QueryOutcome>((resolve, reject) => {
      let columns: string[] = [];
      const rows: unknown[][] = [];
      const request = new Request(sql, (error, rowCount) => {
        if (error) {
          reject(mapDriverError(error));
          return;
        }
        resolve({ columns, rows, affectedRows: rowCount ?? 0 });
      });
      request.on('columnMetadata', (meta) => {
        const raw = meta as unknown;
        const list = (Array.isArray(raw)
          ? raw
          : (raw as { columns?: unknown[] }).columns ?? [raw]) as Array<{ colName: string }>;
        columns = list.map((col) => col.colName);
      });
      request.on('row', (row) => {
        rows.push(row as unknown[]);
      });
      for (const param of params) {
        request.addParameter(param.name, TYPES.NVarChar, param.value ?? undefined);
      }
      this.conn.execSql(request);
      const timer = setTimeout(() => {
        this.conn.close();
        reject(new DbError('DB_TIMEOUT'));
      }, timeoutMs);
      timer.unref?.();
    });
  }

  async query(sql: string, options: DbQueryOptions): Promise<DbQueryResult> {
    const started = Date.now();
    const { sql: finalSql } = applyPaging(sql, options.maxRows, options.offset ?? 0, 'mssql');
    try {
      const outcome = await this.exec(finalSql, [], options.timeoutMs);
      const truncated = outcome.rows.length > options.maxRows;
      const limited = truncated ? outcome.rows.slice(0, options.maxRows) : outcome.rows;
      return {
        columns: columnsFromNames(outcome.columns),
        rows: limited.map((row) => row.map((cell) => normalizeCell(cell, options.maxTextCellBytes))),
        rowCount: limited.length,
        affectedRows: outcome.affectedRows,
        truncated,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      throw mapDriverError(error);
    }
  }

  async listObjects(kind: DbObjectKind, schema?: string): Promise<DbObjectItem[]> {
    if (kind === 'schemas') {
      const outcome = await this.exec(MSSQL_LIST_SQL.schemas, [], 15_000);
      return outcome.rows.map((row) => ({ name: String(row[0]) }));
    }
    const outcome = await this.exec(
      MSSQL_LIST_SQL[kind],
      [{ name: 'schema', value: schema ?? null }],
      15_000,
    );
    return outcome.rows.map((row) => ({
      schema: row[0] === null || row[0] === undefined ? undefined : String(row[0]),
      name: String(row[1]),
      detail: row[2] === null || row[2] === undefined ? undefined : String(row[2]),
    }));
  }

  async describeTable(schema: string | undefined, table: string): Promise<DbColumn[]> {
    const outcome = await this.exec(
      MSSQL_DESCRIBE_SQL,
      [
        { name: 'schema', value: schema ?? 'dbo' },
        { name: 'table', value: table },
      ],
      15_000,
    );
    return outcome.rows.map((row, index) => ({
      name: String(row[0]),
      dataType: row[1] === null ? undefined : String(row[1]),
      nullable: Boolean(row[2]),
      primary: false,
      ordinal: Number(row[3] ?? index + 1),
    }));
  }

  async listIndexes(schema: string | undefined, table: string): Promise<DbIndexInfo[]> {
    const outcome = await this.exec(
      MSSQL_INDEX_SQL,
      [
        { name: 'schema', value: schema ?? 'dbo' },
        { name: 'table', value: table },
      ],
      15_000,
    );
    const grouped = new Map<string, DbIndexInfo>();
    for (const row of outcome.rows) {
      const name = String(row[0]);
      const current = grouped.get(name) ?? {
        name,
        unique: Boolean(row[1]),
        primary: Boolean(row[2]),
        columns: [],
      };
      current.columns.push(String(row[3]));
      grouped.set(name, current);
    }
    return [...grouped.values()];
  }

  async listForeignKeys(schema: string | undefined, table: string): Promise<DbForeignKeyInfo[]> {
    const qualified = `${schema ?? 'dbo'}.${table}`;
    const outcome = await this.exec(
      MSSQL_FOREIGN_KEY_SQL,
      [{ name: 'qualified', value: qualified }],
      15_000,
    );
    const grouped = new Map<string, DbForeignKeyInfo>();
    for (const row of outcome.rows) {
      const name = String(row[0]);
      const current = grouped.get(name) ?? {
        name,
        columns: [],
        foreignTable: String(row[2] ?? ''),
        foreignColumns: [],
      };
      current.columns.push(String(row[1]));
      current.foreignColumns.push(String(row[3]));
      grouped.set(name, current);
    }
    return [...grouped.values()];
  }

  async listTriggers(schema: string | undefined, table: string): Promise<DbTriggerInfo[]> {
    const outcome = await this.exec(
      MSSQL_TRIGGER_SQL,
      [
        { name: 'schema', value: schema ?? 'dbo' },
        { name: 'table', value: table },
      ],
      15_000,
    );
    return outcome.rows.map((row) => ({
      name: String(row[0]),
      table: row[1] === null ? undefined : String(row[1]),
    }));
  }

  async close(): Promise<void> {
    this.conn.close();
  }

  /** 中断当前语句：直接断开连接 */
  abort(): void {
    try { this.conn.close(); } catch { /* already dead */ }
  }
}

export class MssqlDriver implements DbDriver {
  readonly dialect = 'mssql' as const;

  async connect(target: DbTarget, options: { connectTimeoutMs: number }): Promise<DbSession> {
    const conn = new Connection({
      server: target.host,
      options: {
        port: target.port,
        database: target.database,
        encrypt: target.ssl === true,
        trustServerCertificate: true,
        instanceName: target.params?.instanceName ? String(target.params.instanceName) : undefined,
      },
      authentication: {
        type: 'default',
        options: { userName: target.username ?? '', password: target.password ?? '' },
      },
      connectionTimeoutMillis: options.connectTimeoutMs,
      requestTimeout: options.connectTimeoutMs * 4,
    } as ConstructorParameters<typeof Connection>[0]);
    await new Promise<void>((resolve, reject) => {
      conn.once('connect', () => resolve());
      conn.once('error', (error) => reject(mapDriverError(error)));
      conn.connect();
    });
    return new MssqlSession(conn);
  }
}
