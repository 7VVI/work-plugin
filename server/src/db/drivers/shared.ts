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
 * PG/MySQL/MSSQL/ClickHouse 用子查询包裹（保留用户自带 LIMIT 的语义）；
 * SQLite 不允许子查询里带 WITH，改成直接追加 LIMIT/OFFSET。
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

/** 由字段名数组构造列定义 */
export function columnsFromNames(names: string[]): DbColumn[] {
  return names.map((name, index) => ({ name, ordinal: index + 1 }));
}
