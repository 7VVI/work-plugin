import { languages as codeLanguages } from '@codemirror/language-data';
import type { Extension } from '@codemirror/state';
import type { DbDialect } from '@protocol/db';

/** 方言 → CodeMirror 语言名（@codemirror/language-data 内的 name） */
const DIALECT_LANGUAGE: Record<DbDialect, string[]> = {
  postgres: ['PostgreSQL', 'SQL'],
  mysql: ['MySQL', 'MariaDB SQL', 'SQL'],
  sqlite: ['SQLite', 'SQL'],
  mssql: ['MS SQL', 'SQL'],
  clickhouse: ['SQL', 'PostgreSQL'],
};

/** 按方言解析 SQL 高亮扩展；解析不到返回 null（纯文本编辑器） */
export async function sqlLanguageExtension(dialect: DbDialect | null | undefined): Promise<Extension | null> {
  if (!dialect) return null;
  const names = DIALECT_LANGUAGE[dialect] ?? ['SQL'];
  for (const name of names) {
    const descriptor = codeLanguages.find(language => language.name === name);
    if (!descriptor) continue;
    try {
      return await descriptor.load();
    } catch {
      /* 继续尝试下一个 */
    }
  }
  return null;
}
