import { randomUUID } from 'node:crypto';
import type { ServerRec } from '@protocol/types';
import { SSH_PROTOCOL, type SshErrorCode, type SshServerMessage } from '@protocol/ssh';
import { SshConnectError, type SshChannel, type SshConnector, type SshTarget } from './connector';

export interface SshSessionLimits {
  maxSessions: number;
  maxPerServer: number;
  idleMs: number;
}

export interface SshSocketLike {
  send(data: string | Uint8Array, options?: { binary?: boolean }, callback?: (error?: Error) => void): void;
  close(code?: number, reason?: string): void;
  on(event: 'message', listener: (data: unknown, isBinary: boolean) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  readonly bufferedAmount: number;
}

interface Session {
  id: string;
  serverId: string;
  socket: SshSocketLike;
  startedAt: number;
  lastActivity: number;
  fingerprint: string;
  channel: SshChannel | null;
  pending: Buffer[];
  pendingBytes: number;
  cols: number;
  rows: number;
  closed: boolean;
  paused: boolean;
  idleTimer: NodeJS.Timeout | null;
  drainTimer: NodeJS.Timeout | null;
  cleanup: () => void;
}

const ERROR_TEXT: Record<SshErrorCode, string> = {
  TICKET_INVALID: '连接票据无效或已过期',
  SSH_DISABLED: '服务端未启用 SSH 终端',
  SERVER_NOT_FOUND: '服务器不存在或尚未同步到云端',
  SSH_NO_CREDENTIALS: '该服务器没有可用的 SSH 密码或私钥',
  SSH_INVALID_TARGET: '服务器地址、端口或用户名不完整',
  SSH_AUTH_FAILED: 'SSH 认证失败，请检查用户名、密码或私钥',
  SSH_KEY_INVALID: 'SSH 私钥无法解析（不支持带口令的私钥）',
  SSH_TIMEOUT: 'SSH 连接超时，请确认云端服务端能访问目标 IP 和端口',
  SSH_REFUSED: 'SSH 端口拒绝连接，请确认目标端口已开放',
  SSH_UNREACHABLE: '无法连接 SSH 服务器，请确认云端服务端与目标网络互通',
  SSH_SHELL_FAILED: 'SSH 终端创建失败',
  SSH_SESSION_LIMIT: 'SSH 会话数已达上限，请稍后再试',
  SSH_IDLE_TIMEOUT: 'SSH 会话空闲超时，已断开',
};

const HIGH_WATER = 1024 * 1024;
const LOW_WATER = 256 * 1024;
const MAX_PENDING_INPUT = 64 * 1024;

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data as Buffer[]);
  if (typeof data === 'string') return Buffer.from(data);
  return Buffer.alloc(0);
}

function clamp(value: unknown, min: number, max: number): number | null {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function targetOf(server: ServerRec): { ok: true; target: SshTarget } | { ok: false; code: SshErrorCode } {
  const host = server.ip?.trim();
  const username = server.username?.trim();
  const port = Number(server.sshPort) || 22;
  if (!host || !username || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, code: 'SSH_INVALID_TARGET' };
  }
  const privateKey = server.sshKey && server.sshKey.trim() ? server.sshKey : undefined;
  const password = server.password || undefined;
  if (!privateKey && !password) return { ok: false, code: 'SSH_NO_CREDENTIALS' };
  return {
    ok: true,
    target: { serverId: server.id, host, port, username, password, privateKey },
  };
}

/**
 * 管理 WS ↔ SSH shell 的生命周期：并发预占、输入输出、resize、背压、空闲与时序清理。
 * 日志只记录 serverId/结果/指纹/时长，不记录凭据和终端内容。
 */
export class SshSessionManager {
  private readonly sessions = new Set<Session>();
  private readonly perServer = new Map<string, number>();

  constructor(
    private readonly connector: SshConnector,
    private readonly limits: SshSessionLimits,
    private readonly logger: Pick<Console, 'info' | 'warn'> = console,
  ) {}

  attach(socket: SshSocketLike, server: ServerRec): void {
    if (this.sessions.size >= this.limits.maxSessions
      || (this.perServer.get(server.id) ?? 0) >= this.limits.maxPerServer) {
      this.sendError(socket, 'SSH_SESSION_LIMIT');
      try { socket.close(1013, 'session limit'); } catch { /* closed */ }
      return;
    }

    const session: Session = {
      id: randomUUID(),
      serverId: server.id,
      socket,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      fingerprint: '',
      channel: null,
      pending: [],
      pendingBytes: 0,
      cols: 80,
      rows: 24,
      closed: false,
      paused: false,
      idleTimer: null,
      drainTimer: null,
      cleanup: () => undefined,
    };
    this.sessions.add(session);
    this.perServer.set(server.id, (this.perServer.get(server.id) ?? 0) + 1);

    const sendJson = (message: SshServerMessage): void => {
      if (session.closed) return;
      try { socket.send(JSON.stringify(message)); } catch { /* closed */ }
    };

    const cleanup = (): void => {
      if (session.closed) return;
      session.closed = true;
      if (session.idleTimer) clearInterval(session.idleTimer);
      if (session.drainTimer) clearInterval(session.drainTimer);
      try { session.channel?.close(); } catch { /* closed */ }
      this.sessions.delete(session);
      const remaining = (this.perServer.get(server.id) ?? 1) - 1;
      if (remaining <= 0) this.perServer.delete(server.id);
      else this.perServer.set(server.id, remaining);
      this.logger.info?.('[dock-ssh] closed', server.id, `${Math.round((Date.now() - session.startedAt) / 1000)}s`);
    };
    session.cleanup = cleanup;

    const sendError = (code: SshErrorCode): void => {
      sendJson({ type: 'error', code, message: ERROR_TEXT[code] });
    };

    const closeWithError = (code: SshErrorCode): void => {
      sendError(code);
      cleanup();
      try { socket.close(1011); } catch { /* closed */ }
    };

    const writeInput = (chunk: Buffer): void => {
      if (!chunk.length) return;
      if (session.channel) {
        session.channel.write(chunk);
        return;
      }
      if (session.pendingBytes + chunk.length > MAX_PENDING_INPUT) return;
      session.pending.push(chunk);
      session.pendingBytes += chunk.length;
    };

    const handleControl = (text: string): void => {
      if (!text || text.length > 4096) return;
      let message: { type?: unknown; cols?: unknown; rows?: unknown; t?: unknown };
      try { message = JSON.parse(text) as typeof message; } catch { return; }
      if (message.type === 'resize') {
        const cols = clamp(message.cols, 20, 500);
        const rows = clamp(message.rows, 5, 200);
        if (cols == null || rows == null) return;
        session.lastActivity = Date.now();
        session.cols = cols;
        session.rows = rows;
        session.channel?.resize(cols, rows);
        return;
      }
      if (message.type === 'ping') {
        sendJson({ type: 'pong', t: Number(message.t) || 0 });
        return;
      }
      if (message.type === 'close') {
        cleanup();
        try { socket.close(1000); } catch { /* closed */ }
      }
    };

    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        session.lastActivity = Date.now();
        writeInput(toBuffer(data));
        return;
      }
      handleControl(toBuffer(data).toString('utf8'));
    });
    socket.on('close', cleanup);
    socket.on('error', cleanup);

    session.idleTimer = setInterval(() => {
      if (session.closed) return;
      if (Date.now() - session.lastActivity >= this.limits.idleMs) {
        sendError('SSH_IDLE_TIMEOUT');
        cleanup();
        try { socket.close(1000); } catch { /* closed */ }
      }
    }, Math.min(30_000, Math.max(1_000, Math.floor(this.limits.idleMs / 2))));
    session.idleTimer.unref?.();

    const target = targetOf(server);
    if (!target.ok) {
      closeWithError(target.code);
      return;
    }

    this.connector.connect(target.target, {
      cols: session.cols,
      rows: session.rows,
      onFingerprint: (fingerprint) => { session.fingerprint = fingerprint; },
      onData: (chunk) => this.output(session, chunk),
      onExit: (code, signal) => {
        if (session.closed) return;
        sendJson({ type: 'exit', code, signal });
        cleanup();
        try { socket.close(1000); } catch { /* closed */ }
      },
    }).then((channel) => {
      if (session.closed) {
        channel.close();
        return;
      }
      session.channel = channel;
      channel.resize(session.cols, session.rows);
      sendJson({
        type: 'ready',
        protocol: SSH_PROTOCOL,
        serverId: server.id,
        sessionId: session.id,
        fingerprint: session.fingerprint,
      });
      this.logger.info?.('[dock-ssh] connected', server.id, session.fingerprint);
      for (const chunk of session.pending) channel.write(chunk);
      session.pending = [];
      session.pendingBytes = 0;
    }).catch((error: unknown) => {
      if (session.closed) return;
      const code = error instanceof SshConnectError ? error.code : 'SSH_UNREACHABLE';
      this.logger.warn?.('[dock-ssh] failed', server.id, code);
      closeWithError(code);
    });
  }

  closeAll(): void {
    for (const session of [...this.sessions]) {
      try { session.socket.close(1001, 'server shutting down'); } catch { /* closed */ }
      session.cleanup();
    }
    this.sessions.clear();
    this.perServer.clear();
  }

  private output(session: Session, chunk: Buffer): void {
    if (session.closed || !chunk.length) return;
    session.lastActivity = Date.now();
    try {
      session.socket.send(chunk, { binary: true }, () => this.maybeResume(session));
    } catch {
      return;
    }
    if (!session.paused && session.socket.bufferedAmount > HIGH_WATER) {
      session.paused = true;
      session.channel?.pause();
      session.drainTimer = setInterval(() => this.maybeResume(session), 50);
      session.drainTimer.unref?.();
    }
  }

  private maybeResume(session: Session): void {
    if (!session.paused || session.closed) return;
    if (session.socket.bufferedAmount > LOW_WATER) return;
    session.paused = false;
    session.channel?.resume();
    if (session.drainTimer) {
      clearInterval(session.drainTimer);
      session.drainTimer = null;
    }
  }

  private sendError(socket: SshSocketLike, code: SshErrorCode): void {
    try {
      socket.send(JSON.stringify({ type: 'error', code, message: ERROR_TEXT[code] } satisfies SshServerMessage));
    } catch {
      /* closed */
    }
  }
}
