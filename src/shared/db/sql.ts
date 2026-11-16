import type { DbDialect } from '@protocol/db';

/** 按方言给标识符加引号：MySQL 用反引号，其余用双引号 */
export function quoteIdent(name: string, dialect: DbDialect | null | undefined): string {
  if (dialect === 'mysql') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/** 库.表 的限定名 */
export function qualifiedTable(
  schema: string | undefined,
  table: string,
  dialect: DbDialect | null | undefined,
): string {
  const quoted = quoteIdent(table, dialect);
  return schema ? `${quoteIdent(schema, dialect)}.${quoted}` : quoted;
}
