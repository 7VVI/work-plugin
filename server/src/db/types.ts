import type {
  DbCell,
  DbColumn,
  DbDialect,
  DbForeignKeyInfo,
  DbIndexInfo,
  DbObjectItem,
  DbObjectKind,
  DbTriggerInfo,
} from '@protocol/db';

/** 连接参数（唯一来源：云端快照里的中间件记录） */
export interface DbTarget {
  dialect: DbDialect;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  /** sqlite 专用：服务端本地文件绝对路径（已做根目录白名单校验） */
  file?: string;
  ssl?: boolean;
  /** extra.params 白名单后的附加参数 */
  params?: Record<string, string | number | boolean>;
}

export interface DbQueryOptions {
  maxRows: number;
  maxResultBytes: number;
  maxTextCellBytes: number;
  timeoutMs: number;
  /** 结果起始行（分页） */
  offset?: number;
}

export interface DbQueryResult {
  columns: DbColumn[];
  rows: DbCell[][];
  rowCount: number;
  affectedRows?: number;
  truncated: boolean;
  elapsedMs: number;
}

/** 一次已建立的数据库会话（独占一条连接） */
export interface DbSession {
  readonly dialect: DbDialect;
  query(sql: string, options: DbQueryOptions): Promise<DbQueryResult>;
  listObjects(kind: DbObjectKind, schema?: string): Promise<DbObjectItem[]>;
  describeTable(schema: string | undefined, table: string): Promise<DbColumn[]>;
  listIndexes(schema: string | undefined, table: string): Promise<DbIndexInfo[]>;
  listForeignKeys(schema: string | undefined, table: string): Promise<DbForeignKeyInfo[]>;
  listTriggers(schema: string | undefined, table: string): Promise<DbTriggerInfo[]>;
  /** 中断当前语句并断开连接（取消查询用） */
  abort(): void;
  close(): Promise<void>;
}

export interface DbDriver {
  readonly dialect: DbDialect;
  connect(target: DbTarget, options: { connectTimeoutMs: number }): Promise<DbSession>;
}

export type DbDriverFactory = (dialect: DbDialect) => DbDriver;

/** 各方言的能力位（前端据此隐藏不可用标签页） */
export interface DbCapabilities {
  schemas: boolean;
  functions: boolean;
  procedures: boolean;
  triggers: boolean;
  indexes: boolean;
  foreignKeys: boolean;
}
