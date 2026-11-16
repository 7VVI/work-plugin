import mysql from 'mysql2/promise';
import type { DbCell, DbCellUpdate, DbColumn, DbForeignKeyInfo, DbIndexInfo, DbObjectItem, DbObjectKind, DbRoutineInfo, DbTriggerInfo } from '@protocol/db';
import { mapDriverError } from '../errors';
import type { DbDriver, DbQueryOptions, DbQueryResult, DbSession, DbTarget } from '../types';
import { applyPaging, buildUpdateSql, columnsFromNames, normalizeCell, quoteIdentifier, useDatabaseSql } from './shared';

export const MYSQL_LIST_SQL: Record<DbObjectKind, string> = {
  schemas: `SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA
    WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
    ORDER BY 1`,
  tables: `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ? ORDER BY 1, 2`,
  views: `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_TYPE = 'VIEW' AND TABLE_SCHEMA = ? ORDER BY 1, 2`,
  functions: `SELECT ROUTINE_SCHEMA AS schema_name, ROUTINE_NAME AS name, ROUTINE_TYPE AS detail
    FROM information_schema.ROUTINES
    WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION' ORDER BY 1, 2`,
  procedures: `SELECT ROUTINE_SCHEMA AS schema_name, ROUTINE_NAME AS name, ROUTINE_TYPE AS detail
    FROM information_schema.ROUTINES
    WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE' ORDER BY 1, 2`,
  triggers: `SELECT TRIGGER_SCHEMA AS schema_name, TRIGGER_NAME AS name, EVENT_OBJECT_TABLE AS detail
    FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY 1, 2`,
};

export const MYSQL_DESCRIBE_SQL = `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS data_type,
    IS_NULLABLE = 'YES' AS is_nullable, COLUMN_KEY = 'PRI' AS is_primary, ORDINAL_POSITION AS ordinal
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`;

export const MYSQL_INDEX_SQL = `SELECT INDEX_NAME AS name, NON_UNIQUE = 0 AS is_unique,
    INDEX_NAME = 'PRIMARY' AS is_primary, COLUMN_NAME AS column_name, SEQ_IN_INDEX AS seq
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX`;

export const MYSQL_FOREIGN_KEY_SQL = `SELECT CONSTRAINT_NAME AS name, COLUMN_NAME AS column_name,
    REFERENCED_TABLE_SCHEMA AS foreign_schema, REFERENCED_TABLE_NAME AS foreign_table,
    REFERENCED_COLUMN_NAME AS foreign_column
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
  ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION`;

export const MYSQL_TRIGGER_SQL = `SELECT TRIGGER_NAME AS name, EVENT_OBJECT_TABLE AS table_name,
    ACTION_TIMING AS timing, EVENT_MANIPULATION AS event, ACTION_STATEMENT AS definition
  FROM information_schema.TRIGGERS
  WHERE TRIGGER_SCHEMA = ? AND EVENT_OBJECT_TABLE = ? ORDER BY 1`;

class MysqlSession implements DbSession {
  readonly dialect = 'mysql' as const;

  /** 当前 USE 到的库 */
  private currentDb: string | undefined;

  constructor(
    private readonly conn: mysql.Connection,
    private readonly databaseName?: string,
  ) {}

  private async raw(sql: string, params: unknown[] = []): Promise<{ fields: string[]; rows: unknown[][] }> {
    const [rows, fields] = await this.conn.query({
      sql,
      values: params,
      rowsAsArray: true,
    } as never);
    const list = (rows ?? []) as unknown[][];
    const meta = (fields ?? []) as Array<{ name?: string }>;
    return {
      fields: meta.map((f, i) => f?.name ?? `col_${i + 1}`),
      rows: list,
    };
  }

  async query(sql: string, options: DbQueryOptions): Promise<DbQueryResult> {
    const started = Date.now();
    await this.switchDatabase(options.database);
    const { sql: finalSql } = applyPaging(sql, options.maxRows, options.offset ?? 0, 'mysql');
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

  /** 修改一个单元格：UPDATE ... SET col = ? WHERE pk = ? */
  async updateCell(update: DbCellUpdate): Promise<number> {
    const { sql, values } = buildUpdateSql(update, 'mysql', () => '?');
    try {
      const [result] = await this.conn.execute({ sql, values } as never);
      return Number((result as { affectedRows?: number })?.affectedRows ?? 0);
    } catch (error) {
      throw mapDriverError(error);
    }
  }

  /** 取存储过程 / 函数 / 触发器的定义与参数 */
  async getRoutine(
    kind: 'functions' | 'procedures' | 'triggers',
    schema: string | undefined,
    name: string,
  ): Promise<DbRoutineInfo> {
    const db = schema ?? this.currentDatabase();
    const keyword = kind === 'functions' ? 'FUNCTION' : kind === 'procedures' ? 'PROCEDURE' : 'TRIGGER';
    const qualified = `${quoteIdentifier(db, 'mysql')}.${quoteIdentifier(name, 'mysql')}`;
    try {
      const { rows } = await this.raw(`SHOW CREATE ${keyword} ${qualified}`);
      // MySQL 8 的列顺序是：名称 / sql_mode / CREATE 语句 / ...，直接找 CREATE 开头的那列更稳
      const row = rows[0] ?? [];
      let definition = '';
      for (const cell of row) {
        const text = cell === null || cell === undefined ? '' : String(cell);
        if (/^\s*CREATE\b/i.test(text)) {
          definition = text;
          break;
        }
      }
      const { rows: params } = await this.raw(
        `SELECT PARAMETER_NAME, DTD_IDENTIFIER, PARAMETER_MODE
           FROM information_schema.PARAMETERS
          WHERE SPECIFIC_SCHEMA = ? AND SPECIFIC_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [db, name],
      );
      return {
        definition,
        parameters: params.map(row => ({
          name: String(row[0] ?? ''),
          type: row[1] === null || row[1] === undefined ? undefined : String(row[1]),
          mode: row[2] === null || row[2] === undefined ? undefined : String(row[2]),
        })),
      };
    } catch (error) {
      throw mapDriverError(error);
    }
  }

  async listObjects(kind: DbObjectKind, schema?: string): Promise<DbObjectItem[]> {
    if (kind === 'schemas') {
      const { rows } = await this.raw(MYSQL_LIST_SQL.schemas);
      return rows.map((row) => ({ name: String(row[0]) }));
    }
    const { rows } = await this.raw(MYSQL_LIST_SQL[kind], [schema ?? this.currentDatabase()]);
    return rows.map((row) => ({
      schema: row[0] === null || row[0] === undefined ? undefined : String(row[0]),
      name: String(row[1]),
      detail: row[2] === null || row[2] === undefined ? undefined : String(row[2]),
    }));
  }

  async describeTable(schema: string | undefined, table: string): Promise<DbColumn[]> {
    const { rows } = await this.raw(MYSQL_DESCRIBE_SQL, [schema ?? this.currentDatabase(), table]);
    return rows.map((row, index) => ({
      name: String(row[0]),
      dataType: row[1] === null ? undefined : String(row[1]),
      nullable: Boolean(row[2]),
      primary: Boolean(row[3]),
      ordinal: Number(row[4] ?? index + 1),
    }));
  }

  async listIndexes(schema: string | undefined, table: string): Promise<DbIndexInfo[]> {
    const { rows } = await this.raw(MYSQL_INDEX_SQL, [schema ?? this.currentDatabase(), table]);
    const grouped = new Map<string, DbIndexInfo>();
    for (const row of rows) {
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
    const { rows } = await this.raw(MYSQL_FOREIGN_KEY_SQL, [schema ?? this.currentDatabase(), table]);
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
    const { rows } = await this.raw(MYSQL_TRIGGER_SQL, [schema ?? this.currentDatabase(), table]);
    return rows.map((row) => ({
      name: String(row[0]),
      table: row[1] === null ? undefined : String(row[1]),
      timing: row[2] === null ? undefined : String(row[2]),
      event: row[3] === null ? undefined : String(row[3]),
      definition: row[4] === null ? undefined : String(row[4]),
    }));
  }

  async close(): Promise<void> {
    await this.conn.end().catch(() => undefined);
  }

  /** 中断当前语句：直接销毁连接 */
  abort(): void {
    try { this.conn.destroy(); } catch { /* already dead */ }
  }

  private currentDatabase(): string {
    return this.databaseName ?? '';
  }

  /** 切到目标库，之后可以用不带库名的表名 */
  private async switchDatabase(database?: string): Promise<void> {
    const target = database?.trim();
    if (!target || target === this.currentDb) return;
    const stmt = useDatabaseSql('mysql', target);
    if (!stmt) return;
    await this.raw(stmt);
    this.currentDb = target;
  }
}

export class MysqlDriver implements DbDriver {
  readonly dialect = 'mysql' as const;

  async connect(target: DbTarget, options: { connectTimeoutMs: number }): Promise<DbSession> {
    const connectTimeout = Number(target.params?.connectTimeout ?? options.connectTimeoutMs);
    const conn = await mysql
      .createConnection({
        host: target.host,
        port: target.port,
        user: target.username,
        password: target.password,
        database: target.database,
        connectTimeout,
        ssl: target.ssl ? { rejectUnauthorized: false } : undefined,
        multipleStatements: false,
        charset: String(target.params?.charset ?? 'utf8mb4_general_ci'),
        timezone: (target.params?.timezone ? String(target.params.timezone) : 'Z') as 'Z',
      })
      .catch((error) => {
        throw mapDriverError(error);
      });
    const session = new MysqlSession(conn, target.database);
    return session;
  }
}
