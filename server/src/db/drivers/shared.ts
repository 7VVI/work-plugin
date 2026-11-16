import type { DbCell, DbColumn, DbDialect } from '@protocol/db';
import { stripLiterals } from '../sqlGuard';

export interface WrappedQuery {
  sql: string;
  /** 是否被改写成分页语句（决定能否继续翻页） */
  wrapped: boolean;
}

/** 去掉结尾分号 */
export function trimSemicolon(sql: string): string {
  return sql.trim().replace(/;\s*$/, '');
}

/** 去掉结尾的注释与空白（追加 LIMIT 前必须先清理） */
export function trimTrailingNoise(sql: string): string {
  let text = sql.trim();
  for (;;) {
    const next = text
      .replace(/\s*--[^\n]*$/, '')
      .replace(/\s*\/\*[\s\S]*\*\/$/, '')
      .trim();
    if (next === text) return text;
    text = next;
  }
}

/**
 * 只有"普通查询"才能被包成子查询分页。
 * SHOW / DESCRIBE / EXPLAIN 之类虽然也是只读，但不能放进 FROM 子句里。
 */
export function isPlainSelect(sql: string): boolean {
  const skeleton = stripLiterals(sql).trim().toLowerCase();
  return /^(select|with|table|values)\b/.test(skeleton) && !/\bfor\s+update\b/.test(skeleton);
}

/**
 * 只读语句统一加分页，避免一次性拉全表；写语句原样执行。
 * PG/MySQL/ClickHouse 用子查询包裹（保留用户自带 LIMIT 的语义）；
 * SQLite 不允许子查询里带 WITH，改成直接追加 LIMIT/OFFSET；
 * SQL Server 没有 LIMIT，用 OFFSET/FETCH（必须自己补 ORDER BY）。
 */
export function applyPaging(
  sql: string,
  maxRows: number,
  offset = 0,
  dialect: DbDialect = 'postgres',
): WrappedQuery {
  const trimmed = trimSemicolon(sql);
  if (!isPlainSelect(trimmed)) {
    return { sql: trimmed, wrapped: false };
  }
  const limit = Math.max(1, maxRows) + 1;
  const skip = Math.max(0, Math.floor(offset));

  if (dialect === 'sqlite') {
    const clean = trimTrailingNoise(trimmed);
    // 用户自带 LIMIT 时不再追加，避免语法错误（此时无法继续翻页）
    if (/\blimit\b/i.test(stripLiterals(clean))) {
      return { sql: clean, wrapped: false };
    }
    return { sql: `${clean} LIMIT ${limit} OFFSET ${skip}`, wrapped: true };
  }

  if (dialect === 'mssql') {
    const clean = trimTrailingNoise(trimmed);
    // 已经有 OFFSET/FETCH 就不能再追加
    if (/\b(offset|fetch)\b/i.test(stripLiterals(clean))) {
      return { sql: clean, wrapped: false };
    }
    // T-SQL 的 OFFSET/FETCH 必须配合 ORDER BY，用户没写就补一个空排序
    const ordered = /\border\s+by\b/i.test(stripLiterals(clean))
      ? clean
      : `${clean} ORDER BY (SELECT NULL)`;
    return { sql: `${ordered} OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY`, wrapped: true };
  }

  return {
    sql: `SELECT * FROM (${trimmed}) AS __dock_page LIMIT ${limit} OFFSET ${skip}`,
    wrapped: true,
  };
}

/** 单元格归一化：二进制标记化，超长文本截断 */
export function normalizeCell(value: unknown, maxTextBytes: number): DbCell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > maxTextBytes
      ? `${value.slice(0, maxTextBytes)}…[truncated]`
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) {
    return {
      __bin: true,
      bytes: value.length,
      base64: value.length <= 16 * 1024 ? value.toString('base64') : '',
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try {
      const text = JSON.stringify(value);
      return text.length > maxTextBytes
        ? `${text.slice(0, maxTextBytes)}…[truncated]`
        : text;
    } catch {
      return '[unserializable]';
    }
  }
  return String(value);
}

/** 按方言给标识符加引号（MySQL 反引号、SQL Server 方括号、其余双引号） */
export function quoteIdentifier(name: string, dialect: DbDialect): string {
  if (dialect === 'mysql') return `\`${name.replace(/`/g, '``')}\``;
  if (dialect === 'mssql') return `[${name.replace(/]/g, ']]')}]`;
  return `"${name.replace(/"/g, '""')}"`;
}

/** 库.表 的限定名 */
export function qualifiedName(schema: string | undefined, name: string, dialect: DbDialect): string {
  return schema
    ? `${quoteIdentifier(schema, dialect)}.${quoteIdentifier(name, dialect)}`
    : quoteIdentifier(name, dialect);
}

/**
 * 单元格修改：按主键定位一行，改一个列。
 * 值全部走参数绑定，标识符才拼进 SQL。
 */
export function buildUpdateSql(
  update: { schema?: string; table: string; column: string; value: string | null; keys: Array<{ column: string; value: string | null }> },
  dialect: DbDialect,
  placeholder: (index: number) => string,
): { sql: string; values: Array<string | null> } {
  const table = qualifiedName(update.schema, update.table, dialect);
  const values: Array<string | null> = [];
  const setValue = placeholder(values.length);
  values.push(update.value);
  const where = update.keys
    .map(key => {
      const mark = placeholder(values.length);
      values.push(key.value);
      return `${quoteIdentifier(key.column, dialect)} = ${mark}`;
    })
    .join(' AND ');
  return {
    sql: `UPDATE ${table} SET ${quoteIdentifier(update.column, dialect)} = ${setValue} WHERE ${where}`,
    values,
  };
}

/** 由字段名数组构造列定义 */
export function columnsFromNames(names: string[]): DbColumn[] {
  return names.map((name, index) => ({ name, ordinal: index + 1 }));
}

/** 库名只允许常规字符，避免拼进 USE/SET 语句造成注入 */
const SAFE_DATABASE = /^[\p{L}\p{N}_$.-]+$/u;

/**
 * 切换会话当前库的语句。
 * PG 的「库」是 schema（用 search_path），MySQL/MSSQL/ClickHouse 是真正的库。
 */
export function useDatabaseSql(dialect: DbDialect, database: string): string | null {
  const name = database.trim();
  if (!name || !SAFE_DATABASE.test(name)) return null;
  switch (dialect) {
    case 'postgres':
      return `SET search_path TO "${name.replace(/"/g, '""')}"`;
    case 'mysql':
      return `USE \`${name.replace(/`/g, '``')}\``;
    case 'mssql':
      return `USE [${name.replace(/]/g, ']]')}]`;
    case 'clickhouse':
      return `USE ${name}`;
    default:
      return null;
  }
}
