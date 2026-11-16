import type { DbDialect } from '@protocol/db';
import { PostgresDriver } from './drivers/postgres';
import { MysqlDriver } from './drivers/mysql';
import { SqliteDriver } from './drivers/sqlite';
import { MssqlDriver } from './drivers/mssql';
import { ClickhouseDriver } from './drivers/clickhouse';
import type { DbDriver, DbDriverFactory } from './types';

/** 方言 → 驱动工厂（协议兼容库由原生驱动自动覆盖） */
export function createDefaultDbDriver(dialect: DbDialect): DbDriver {
  switch (dialect) {
    case 'postgres':
      return new PostgresDriver();
    case 'mysql':
      return new MysqlDriver();
    case 'sqlite':
      return new SqliteDriver();
    case 'mssql':
      return new MssqlDriver();
    case 'clickhouse':
      return new ClickhouseDriver();
    default:
      throw new Error(`unsupported dialect: ${dialect}`);
  }
}

export const defaultDbDriverFactory: DbDriverFactory = (dialect) => createDefaultDbDriver(dialect);
