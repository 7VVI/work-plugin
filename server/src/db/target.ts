import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import type { MiddlewareRec } from '@protocol/types';
import type { DbDialect } from '@protocol/db';
import { DbError } from './errors';
import type { DbTarget } from './types';

const DIALECT_BY_TYPE: Record<string, DbDialect> = {
  mysql: 'mysql',
  postgresql: 'postgres',
  mssql: 'mssql',
  sqlite: 'sqlite',
  clickhouse: 'clickhouse',
};

/** extra.params 里允许透传给驱动的参数名 */
const PARAM_ALLOWLIST = [
  'application_name',
  'connectTimeout',
  'instanceName',
  'charset',
  'timezone',
  'search_path',
  'sslmode',
  'maxRows',
];

export function dialectForType(type: string): DbDialect | null {
  return DIALECT_BY_TYPE[type] ?? null;
}

export function isDbMiddlewareType(type: string): boolean {
  return dialectForType(type) !== null;
}

/** "a=1,b=2" → { a: '1', b: '2' }，再按白名单过滤 */
export function parseAllowedParams(raw: unknown): Record<string, string> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(',')) {
    const [key, ...rest] = part.split('=');
    const name = key?.trim();
    if (!name || !PARAM_ALLOWLIST.includes(name)) continue;
    out[name] = rest.join('=').trim();
  }
  return out;
}

function isUnderRoot(file: string, roots: string[]): boolean {
  return roots.some((root) => file === root || file.startsWith(root.endsWith(sep) ? root : root + sep));
}

/** SQLite 文件路径必须落在 DOCK_DB_SQLITE_ROOTS 之下，防止越权读取服务端任意文件 */
export function resolveSqliteFile(file: string, roots: string[]): string {
  const abs = isAbsolute(file) ? resolve(file) : resolve(process.cwd(), file);
  const real = existsSync(abs) ? realpathSync(abs) : abs;
  if (!isUnderRoot(real, roots)) {
    throw new DbError('DB_INVALID_TARGET', 'SQLite 文件路径不在服务端允许的目录内');
  }
  return real;
}

/** 从快照里的中间件记录解析出连接参数（客户端无法影响这里） */
export function resolveDbTarget(rec: MiddlewareRec, opts: { sqliteRoots: string[] }): DbTarget {
  const dialect = dialectForType(rec.type);
  if (!dialect) throw new DbError('DB_TYPE_UNSUPPORTED');
  const extra = (rec.extra ?? {}) as Record<string, unknown>;

  if (dialect === 'sqlite') {
    const file = String(extra.filePath ?? rec.database ?? '').trim();
    if (!file) throw new DbError('DB_INVALID_TARGET', '未配置 SQLite 文件路径');
    return {
      dialect,
      host: '',
      port: 0,
      file: resolveSqliteFile(file, opts.sqliteRoots),
      params: parseAllowedParams(extra.params),
    };
  }

  const host = String(rec.host ?? '').trim();
  if (!host) throw new DbError('DB_INVALID_TARGET', '未配置数据库地址');
  const port = Number(rec.port);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new DbError('DB_INVALID_TARGET', '数据库端口不合法');
  }

  const target: DbTarget = {
    dialect,
    host,
    port,
    database: rec.database?.trim() || undefined,
    username: rec.username?.trim() || undefined,
    password: rec.password || undefined,
    ssl: extra.ssl === true,
    params: parseAllowedParams(extra.params),
  };
  // ClickHouse 默认账号是 default，允许留空；其余数据库必须显式指定账号
  if (dialect === 'clickhouse') {
    target.username = target.username || 'default';
  } else if (!target.username) {
    throw new DbError('DB_NO_CREDENTIALS');
  }
  return target;
}
