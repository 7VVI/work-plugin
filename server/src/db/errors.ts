import type { DbErrorCode } from '@protocol/db';

export const DB_ERROR_TEXT: Record<DbErrorCode, string> = {
  DB_DISABLED: '服务端未启用数据库管理（DOCK_DB_ENABLED=false）',
  DB_NOT_FOUND: '中间件不存在或尚未同步到云端',
  DB_TYPE_UNSUPPORTED: '该中间件类型不支持数据库管理',
  DB_NO_CREDENTIALS: '缺少数据库账号或密码',
  DB_INVALID_TARGET: '数据库连接地址不合法',
  DB_AUTH_FAILED: '数据库认证失败，请检查账号密码',
  DB_CONNECT_TIMEOUT: '数据库连接超时，请确认云端服务端能访问该地址和端口',
  DB_REFUSED: '数据库端口拒绝连接',
  DB_UNREACHABLE: '无法连接数据库，请确认云端服务端与目标网络互通',
  DB_CONNECT_FAILED: '数据库连接失败',
  DB_SESSION_LIMIT: '并发会话数已达上限，请关闭其他会话后重试',
  DB_IDLE_TIMEOUT: '会话空闲超时，已断开',
  DB_BUSY: '会话繁忙，请稍后重试',
  DB_QUERY_FAILED: 'SQL 执行失败',
  DB_SYNTAX_ERROR: 'SQL 语法错误',
  DB_TIMEOUT: 'SQL 执行超时',
  DB_MULTI_STATEMENT: '只允许执行单条 SQL',
  DB_RESULT_TOO_LARGE: '结果集超出大小限制',
  DB_ROW_LIMIT: '结果集超出行数限制',
  DB_CANCELED: '查询已取消',
  DB_UNSUPPORTED: '当前数据库不支持该操作',
  DB_FAILED: '操作失败',
};

export class DbError extends Error {
  readonly code: DbErrorCode;

  constructor(code: DbErrorCode, message?: string) {
    super(message ?? DB_ERROR_TEXT[code]);
    this.name = 'DbError';
    this.code = code;
  }
}

const SENSITIVE_PATTERNS = [
  /password\s*=\s*'?[^'\s]*/gi,
  /passwd\s*=\s*'?[^'\s]*/gi,
  /\b[a-z]+:\/\/[^\s]*@/gi,
];

/** 驱动原始错误常含 DSN/账号，回传前必须脱敏并截断 */
export function redactDriverError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  let text = raw.replace(/\s+/g, ' ').trim();
  for (const pattern of SENSITIVE_PATTERNS) {
    text = text.replace(pattern, '***');
  }
  if (text.length > 200) text = `${text.slice(0, 200)}…`;
  return text;
}

/** 把驱动异常映射为受控错误码 */
export function mapDriverError(error: unknown): DbError {
  if (error instanceof DbError) return error;
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const code = raw.toLowerCase();
  if (code.includes('password authentication failed') || code.includes('access denied')) {
    return new DbError('DB_AUTH_FAILED');
  }
  if (code.includes('syntax error') || code.includes('sqlstate')) {
    return new DbError('DB_QUERY_FAILED', `SQL 执行失败：${redactDriverError(error)}`);
  }
  if (code.includes('timeout') || code.includes('timed out')) {
    return new DbError('DB_TIMEOUT');
  }
  if (code.includes('econnrefused')) return new DbError('DB_REFUSED');
  if (code.includes('enotfound') || code.includes('ehostunreach') || code.includes('enetunreach')) {
    return new DbError('DB_UNREACHABLE');
  }
  return new DbError('DB_QUERY_FAILED', `SQL 执行失败：${redactDriverError(error)}`);
}
