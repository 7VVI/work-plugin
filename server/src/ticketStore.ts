import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from './errors';

export type WsAuthKind = 'bearer' | 'cookie';

/** 票据用途：ssh = 终端/SFTP，db = 数据库工作台 */
export type WsTicketScope = 'ssh' | 'db';

export interface IssuedTicket {
  ticket: string;
  expiresAt: number;
}

export type WsConsumeResult =
  | { ok: true; resourceId: string; authKind: WsAuthKind; scope: WsTicketScope }
  | { ok: false; reason: 'invalid' | 'expired' | 'origin' | 'scope' };

interface StoredTicket {
  scope: WsTicketScope;
  resourceId: string;
  authKind: WsAuthKind;
  origin?: string;
  expiresAt: number;
}

function digest(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}

/**
 * WebSocket 一次性票据：只存散列，短 TTL，使用即销毁。
 * 票据绑定用途（scope）、目标资源 id 与发起请求的 Origin，升级时再比对一次。
 */
export class WsTicketStore {
  private readonly tickets = new Map<string, StoredTicket>();
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly options: {
      ttlMs: number;
      maxTickets?: number;
      maxPerMinute?: number;
      now?: () => number;
    },
  ) {
    this.timer = setInterval(() => this.cleanup(), 30_000);
    this.timer.unref?.();
  }

  issue(
    scope: WsTicketScope,
    resourceId: string,
    authKind: WsAuthKind,
    origin: string | undefined,
    ip: string,
  ): IssuedTicket {
    const now = this.options.now?.() ?? Date.now();
    this.cleanup(now);
    this.checkRate(ip, now);
    const maxTickets = this.options.maxTickets ?? 256;
    if (this.tickets.size >= maxTickets) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many pending tickets');
    }
    const ticket = randomBytes(32).toString('base64url');
    const expiresAt = now + this.options.ttlMs;
    this.tickets.set(digest(ticket), { scope, resourceId, authKind, origin, expiresAt });
    return { ticket, expiresAt };
  }

  consumeScoped(
    ticket: string,
    origin: string | undefined,
    scope: WsTicketScope,
  ): WsConsumeResult {
    if (!ticket) return { ok: false, reason: 'invalid' };
    const key = digest(ticket);
    const record = this.tickets.get(key);
    if (!record) return { ok: false, reason: 'invalid' };
    this.tickets.delete(key);
    const now = this.options.now?.() ?? Date.now();
    if (record.expiresAt <= now) return { ok: false, reason: 'expired' };
    if (record.scope !== scope) return { ok: false, reason: 'scope' };
    if (record.origin && record.origin !== origin) return { ok: false, reason: 'origin' };
    return {
      ok: true,
      resourceId: record.resourceId,
      authKind: record.authKind,
      scope: record.scope,
    };
  }

  close(): void {
    clearInterval(this.timer);
    this.tickets.clear();
    this.attempts.clear();
  }

  private cleanup(now = this.options.now?.() ?? Date.now()): void {
    for (const [key, record] of this.tickets) {
      if (record.expiresAt <= now) this.tickets.delete(key);
    }
    for (const [ip, attempt] of this.attempts) {
      if (attempt.resetAt <= now) this.attempts.delete(ip);
    }
  }

  private checkRate(ip: string, now: number): void {
    const limit = this.options.maxPerMinute ?? 10;
    const attempt = this.attempts.get(ip);
    if (!attempt || attempt.resetAt <= now) {
      this.attempts.set(ip, { count: 1, resetAt: now + 60_000 });
      return;
    }
    if (attempt.count >= limit) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many ticket requests');
    }
    attempt.count += 1;
  }
}
