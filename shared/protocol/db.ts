export const DB_PROTOCOL = 1;

export type DbDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'clickhouse';

export type DbObjectKind =
  | 'schemas'
  | 'tables'
  | 'views'
  | 'functions'
  | 'procedures'
  | 'triggers';

export interface DbColumn {
  name: string;
  dataType?: string;
  nullable?: boolean;
  primary?: boolean;
  ordinal: number;
}

export interface DbObjectItem {
  schema?: string;
  name: string;
  detail?: string;
}

export interface DbIndexInfo {
  name: string;
  unique: boolean;
  primary: boolean;
  columns: string[];
  definition?: string;
}

export interface DbForeignKeyInfo {
  name: string;
  columns: string[];
  foreignSchema?: string;
  foreignTable: string;
  foreignColumns: string[];
}

export interface DbTriggerInfo {
  name: string;
  table?: string;
  timing?: string;
  event?: string;
  definition?: string;
}

export type DbCell =
  | string
  | number
  | boolean
  | null
  | { __bin: true; bytes: number; base64: string };

export type DbErrorCode =
  | 'DB_DISABLED'
  | 'DB_NOT_FOUND'
  | 'DB_TYPE_UNSUPPORTED'
  | 'DB_NO_CREDENTIALS'
  | 'DB_INVALID_TARGET'
  | 'DB_AUTH_FAILED'
  | 'DB_CONNECT_TIMEOUT'
  | 'DB_REFUSED'
  | 'DB_UNREACHABLE'
  | 'DB_CONNECT_FAILED'
  | 'DB_SESSION_LIMIT'
  | 'DB_IDLE_TIMEOUT'
  | 'DB_BUSY'
  | 'DB_QUERY_FAILED'
  | 'DB_SYNTAX_ERROR'
  | 'DB_TIMEOUT'
  | 'DB_MULTI_STATEMENT'
  | 'DB_RESULT_TOO_LARGE'
  | 'DB_ROW_LIMIT'
  | 'DB_CANCELED'
  | 'DB_UNSUPPORTED'
  | 'DB_FAILED';

export interface DbCaps {
  maxRows: number;
  maxResultBytes: number;
  queryTimeoutMs: number;
  readOnly: boolean;
}

export type DbClientMessage =
  | { type: 'db-list'; id: number; kind: DbObjectKind; schema?: string }
  | { type: 'db-describe'; id: number; schema?: string; table: string }
  | { type: 'db-indexes'; id: number; schema?: string; table: string }
  | { type: 'db-foreign-keys'; id: number; schema?: string; table: string }
  | { type: 'db-triggers'; id: number; schema?: string; table: string }
  | { type: 'db-query'; id: number; sql: string; maxRows?: number; offset?: number }
  | { type: 'db-cancel'; id: number }
  | { type: 'db-ping'; t: number }
  | { type: 'db-close' };

export type DbServerMessage =
  | {
      type: 'db-ready';
      protocol: typeof DB_PROTOCOL;
      dialect: DbDialect;
      middlewareId: string;
      sessionId: string;
      serverVersion?: string;
      caps: DbCaps;
    }
  | { type: 'db-pong'; t: number }
  | { type: 'db-error'; code: DbErrorCode; message: string }
  | { type: 'db-fail'; id: number | null; code: DbErrorCode; message: string }
  | { type: 'db-list'; id: number; kind: DbObjectKind; items: DbObjectItem[]; truncated: boolean }
  | { type: 'db-describe'; id: number; columns: DbColumn[] }
  | { type: 'db-indexes'; id: number; indexes: DbIndexInfo[] }
  | { type: 'db-foreign-keys'; id: number; foreignKeys: DbForeignKeyInfo[] }
  | { type: 'db-triggers'; id: number; triggers: DbTriggerInfo[] }
  | {
      type: 'db-result-meta';
      id: number;
      columns: DbColumn[];
      totalRows: number;
      affectedRows?: number;
      elapsedMs: number;
    }
  | { type: 'db-result-chunk'; id: number; seq: number; rows: DbCell[][] }
  | {
      type: 'db-result-end';
      id: number;
      rowCount: number;
      truncated: boolean;
      nextOffset?: number;
    };

export type DbWsClientMessage = Extract<DbClientMessage, { type: `db-${string}` }>;
export type DbWsServerMessage = Extract<DbServerMessage, { type: `db-${string}` }>;

export interface DbTicketResponse {
  ticket: string;
  expiresAt: number;
  protocol: typeof DB_PROTOCOL;
}
