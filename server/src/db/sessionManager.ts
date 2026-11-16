import { randomUUID } from 'node:crypto';
import type { MiddlewareRec } from '@protocol/types';
import { DB_PROTOCOL, type DbErrorCode, type DbServerMessage } from '@protocol/db';
import { DbError, DB_ERROR_TEXT } from './errors';
import { DbGateway, DB_CONTROL_MAX_CHARS } from './gateway';
import { resolveDbTarget } from './target';
import type { DbDriverFactory, DbSession } from './types';

export interface DbSocketLike {
  send(data: string, cb?: (err?: Error) => void): void;
  close(code?: number, reason?: string): void;
  on(event: string, listener: (...args: never[]) => void): void;
  bufferedAmount?: number;
}

export interface DbSessionLimits {
  maxSessions: number;
  maxPerMiddleware: number;
  idleMs: number;
  connectTimeoutMs: number;
  queryTimeoutMs: number;
  maxRows: number;
  maxResultBytes: number;
  maxTextCellBytes: number;
  readOnly: boolean;
  sqliteRoots: string[];
}

interface Session {
  id: string;
  middlewareId: string;
  socket: DbSocketLike;
  startedAt: number;
  lastActivity: number;
  closed: boolean;
  idleTimer: NodeJS.Timeout | null;
  cleanup: () => void;
  gateway: DbGateway | null;
  dbSession: DbSession | null;
}

/**
 * 管理 WS ↔ 数据库连接的生命周期：并发预占、连接建立、查询串行化、空闲清理。
 * 日志只记录 middlewareId / 方言 / 行数 / 耗时，不记录 SQL 文本与凭据。
 */
export class DbSessionManager {
  private readonly sessions = new Set<Session>();
  private readonly perMiddleware = new Map<string, number>();

  constructor(
    private readonly driverFactory: DbDriverFactory,
    private readonly limits: DbSessionLimits,
    private readonly logger: Pick<Console, 'info' | 'warn'> = console,
  ) {}

  attach(socket: DbSocketLike, middleware: MiddlewareRec): void {
    const limit = this.limits.maxPerMiddleware;
    if (this.sessions.size >= this.limits.maxSessions
      || (this.perMiddleware.get(middleware.id) ?? 0) >= limit) {
      this.sendError(socket, 'DB_SESSION_LIMIT');
      try { socket.close(1013, 'session limit'); } catch { /* closed */ }
      return;
    }

    const session: Session = {
      id: randomUUID(),
      middlewareId: middleware.id,
      socket,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      closed: false,
      idleTimer: null,
      cleanup: () => undefined,
      gateway: null,
      dbSession: null,
    };
    this.sessions.add(session);
    this.perMiddleware.set(middleware.id, (this.perMiddleware.get(middleware.id) ?? 0) + 1);

    const sendJson = (message: DbServerMessage): void => {
      if (session.closed) return;
      try {
        socket.send(JSON.stringify(message));
      } catch {
        /* closed */
      }
    };

    /** 连接建立前收到的 db-* 帧先缓冲，连上后补发 */
    const pendingFrames: Array<Record<string, unknown>> = [];

    const sendError = (code: DbErrorCode, message?: string): void => {
      sendJson({ type: 'db-error', code, message: message ?? DB_ERROR_TEXT[code] });
    };

    const cleanup = (): void => {
      if (session.closed) return;
      session.closed = true;
      if (session.idleTimer) clearInterval(session.idleTimer);
      session.gateway?.abortAll();
      void session.dbSession?.close().catch(() => undefined);
      this.sessions.delete(session);
      const remaining = (this.perMiddleware.get(middleware.id) ?? 1) - 1;
      if (remaining <= 0) this.perMiddleware.delete(middleware.id);
      else this.perMiddleware.set(middleware.id, remaining);
      this.logger.info?.('[dock-db] closed', middleware.id, `${Math.round((Date.now() - session.startedAt) / 1000)}s`);
    };
    session.cleanup = cleanup;

    const handleControl = (text: string): void => {
      if (!text || !text.length) return;
      let message: { type?: unknown; t?: unknown };
      try { message = JSON.parse(text) as typeof message; } catch { return; }
      const type = typeof message.type === 'string' ? message.type : '';
      if (type.startsWith('db-')) {
        if (text.length > DB_CONTROL_MAX_CHARS) return;
        session.lastActivity = Date.now();
        if (type === 'db-ping') {
          sendJson({ type: 'db-pong', t: Number(message.t) || 0 });
          return;
        }
        if (type === 'db-close') {
          cleanup();
          try { socket.close(1000); } catch { /* closed */ }
          return;
        }
        if (!session.gateway) {
          pendingFrames.push(message as Record<string, unknown>);
          return;
        }
        session.gateway.handleMessage(message as Record<string, unknown>);
        return;
      }
      if (text.length > 4096) return;
    };

    socket.on('message', (data: never) => {
      const raw = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
      handleControl(raw.toString('utf8'));
    });
    socket.on('close', cleanup);
    socket.on('error', cleanup);

    session.idleTimer = setInterval(() => {
      if (session.closed) return;
      if (Date.now() - session.lastActivity >= this.limits.idleMs) {
        sendError('DB_IDLE_TIMEOUT');
        cleanup();
        try { socket.close(1000); } catch { /* closed */ }
      }
    }, Math.min(30_000, Math.max(1_000, Math.floor(this.limits.idleMs / 2))));
    session.idleTimer.unref?.();

    let target;
    try {
      target = resolveDbTarget(middleware, { sqliteRoots: this.limits.sqliteRoots });
    } catch (error) {
      const code = error instanceof DbError ? error.code : 'DB_INVALID_TARGET';
      sendError(code, (error as Error).message);
      cleanup();
      try { socket.close(1011); } catch { /* closed */ }
      return;
    }

    const driver = this.driverFactory(target.dialect);
    driver.connect(target, { connectTimeoutMs: this.limits.connectTimeoutMs }).then((dbSession) => {
      if (session.closed) {
        void dbSession.close().catch(() => undefined);
        return;
      }
      session.dbSession = dbSession;
      session.gateway = new DbGateway({
        session: dbSession,
        caps: {
          maxRows: this.limits.maxRows,
          maxResultBytes: this.limits.maxResultBytes,
          maxTextCellBytes: this.limits.maxTextCellBytes,
          queryTimeoutMs: this.limits.queryTimeoutMs,
          readOnly: this.limits.readOnly,
        },
        sendJson,
        onActivity: () => { session.lastActivity = Date.now(); },
        logger: console,
      });
      sendJson({
        type: 'db-ready',
        protocol: DB_PROTOCOL,
        dialect: target.dialect,
        middlewareId: middleware.id,
        sessionId: session.id,
        caps: {
          maxRows: this.limits.maxRows,
          maxResultBytes: this.limits.maxResultBytes,
          queryTimeoutMs: this.limits.queryTimeoutMs,
          readOnly: this.limits.readOnly,
        },
      });
      // 连接建立前排队的请求在这里补发
      for (const frame of pendingFrames.splice(0)) {
        session.gateway?.handleMessage(frame);
      }
      this.logger.info?.('[dock-db] connected', middleware.id, target.dialect);
    }).catch((error: unknown) => {
      if (session.closed) return;
      const code = error instanceof DbError ? error.code : 'DB_CONNECT_FAILED';
      this.logger.warn?.('[dock-db] failed', middleware.id, code);
      sendError(code, (error as Error).message);
      cleanup();
      try { socket.close(1011); } catch { /* closed */ }
    });
  }

  closeAll(): void {
    for (const session of [...this.sessions]) {
      try { session.socket.close(1001, 'server shutting down'); } catch { /* closed */ }
      session.cleanup();
    }
    this.sessions.clear();
    this.perMiddleware.clear();
  }

  private sendError(socket: DbSocketLike, code: DbErrorCode): void {
    try {
      socket.send(JSON.stringify({ type: 'db-error', code, message: DB_ERROR_TEXT[code] } satisfies DbServerMessage));
    } catch {
      /* closed */
    }
  }
}
