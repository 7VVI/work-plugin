import { DbError } from './errors';

/** 去掉字符串字面量与注释后的 SQL 骨架 */
export function stripLiterals(sql: string): string {
  let out = '';
  let i = 0;
  const len = sql.length;
  while (i < len) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < len) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      out += ' ';
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < len && sql[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < len && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** 只允许单条语句：去掉字面量后，分号之后不能再有内容 */
export function assertSingleStatement(sql: string): void {
  const skeleton = stripLiterals(sql);
  const first = skeleton.indexOf(';');
  if (first < 0) return;
  if (skeleton.slice(first + 1).trim().length > 0) {
    throw new DbError('DB_MULTI_STATEMENT');
  }
}

export type SqlStatementKind =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'ddl'
  | 'transaction'
  | 'other';

export function statementKind(sql: string): SqlStatementKind {
  const skeleton = stripLiterals(sql).trim().toLowerCase();
  const word = skeleton.match(/^[a-z]+/)?.[0] ?? '';
  if (word === 'select' || word === 'with' || word === 'show' || word === 'explain' || word === 'desc' || word === 'describe') {
    return 'select';
  }
  if (word === 'insert' || word === 'replace') return 'insert';
  if (word === 'update') return 'update';
  if (word === 'delete' || word === 'truncate') return 'delete';
  if (['create', 'alter', 'drop', 'grant', 'revoke', 'comment', 'rename'].includes(word)) return 'ddl';
  if (['begin', 'commit', 'rollback', 'start'].includes(word)) return 'transaction';
  return 'other';
}

/** 只读模式下允许的语句 */
export function isReadOnlyStatement(sql: string): boolean {
  const kind = statementKind(sql);
  if (kind === 'select') return true;
  if (kind === 'other') {
    const skeleton = stripLiterals(sql).trim().toLowerCase();
    return /^(desc|describe|show|explain|values)\b/.test(skeleton);
  }
  return false;
}
