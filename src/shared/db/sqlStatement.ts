/** 语句边界解析：按顶层的 ; 切分，跳过字符串/注释/$$ 引号块 */

export interface SqlStatement {
  /** 语句文本（不含结尾分号，含内部空白） */
  text: string;
  /** 在原文中的起始偏移 */
  start: number;
  /** 在原文中的结束偏移（不含结尾分号） */
  end: number;
}

interface ScanState {
  inSingle: boolean;
  inDouble: boolean;
  inBacktick: boolean;
  inLineComment: boolean;
  inBlockComment: boolean;
  dollarTag: string | null;
}

function isIdentifierChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

/** 顶层 ; 的位置（跳过字符串、注释、$$ 块） */
function topLevelSemicolons(sql: string): number[] {
  const marks: number[] = [];
  const state: ScanState = {
    inSingle: false,
    inDouble: false,
    inBacktick: false,
    inLineComment: false,
    inBlockComment: false,
    dollarTag: null,
  };

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (state.inLineComment) {
      if (ch === '\n') state.inLineComment = false;
      continue;
    }
    if (state.inBlockComment) {
      if (ch === '*' && next === '/') { state.inBlockComment = false; i += 1; }
      continue;
    }
    if (state.dollarTag) {
      if (ch === '$' && sql.startsWith(state.dollarTag, i)) {
        i += state.dollarTag.length - 1;
        state.dollarTag = null;
      }
      continue;
    }
    if (state.inSingle) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === "'") state.inSingle = false;
      continue;
    }
    if (state.inDouble) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === '"') state.inDouble = false;
      continue;
    }
    if (state.inBacktick) {
      if (ch === '`') state.inBacktick = false;
      continue;
    }

    if (ch === '-' && next === '-') { state.inLineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { state.inBlockComment = true; i += 1; continue; }
    if (ch === "'") { state.inSingle = true; continue; }
    if (ch === '"') { state.inDouble = true; continue; }
    if (ch === '`') { state.inBacktick = true; continue; }
    if (ch === '$') {
      // $$ 或 $tag$ 开头的引用块
      let j = i + 1;
      while (j < sql.length && isIdentifierChar(sql[j])) j += 1;
      if (sql[j] === '$') {
        state.dollarTag = sql.slice(i, j + 1);
        i = j;
        continue;
      }
    }
    if (ch === ';') marks.push(i);
  }
  return marks;
}

/** 把 SQL 切成若干条语句 */
export function splitSqlStatements(sql: string): SqlStatement[] {
  const out: SqlStatement[] = [];
  const marks = topLevelSemicolons(sql);
  let cursor = 0;
  const push = (from: number, to: number) => {
    const raw = sql.slice(from, to);
    const text = raw.trim();
    if (!text) return;
    const offset = raw.indexOf(text);
    out.push({ text, start: from + offset, end: from + offset + text.length });
  };
  for (const mark of marks) {
    push(cursor, mark);
    cursor = mark + 1;
  }
  push(cursor, sql.length);
  return out;
}

/**
 * 取光标所在的那条语句。
 * 光标落在语句之间的空白里时，取后面最近的一条；没有后面就取前面最后一条。
 */
export function statementAtCursor(sql: string, cursor: number): SqlStatement | null {
  const statements = splitSqlStatements(sql);
  if (statements.length === 0) return null;
  for (const statement of statements) {
    if (cursor >= statement.start && cursor <= statement.end) return statement;
  }
  const next = statements.find(statement => statement.start > cursor);
  if (next) return next;
  return statements[statements.length - 1];
}
