import type { FastifyRequest } from 'fastify';
import type { ServerConfig } from './config';
import type { Db, SessionRow } from './db';
import {
  clampSessions,
  createSession,
  deleteAllSessions,
  deleteSession,
  findSession,
  getSessionDays,
} from './db';
import { authEpoch, deriveDataKey, hashToken, randomToken, safeEqual } from './crypto';
import { HttpError, forbidden, unauthorized } from './errors';

interface Attempt {
  count: number;
  resetAt: number;
  blockedUntil: number;
}

export interface LoginResult {
  token: string;
  expiresAt: number;
}

export class AuthService {
  private readonly epoch: string;
  private readonly attempts = new Map<string, Attempt>();

  constructor(
    private readonly db: Db,
    private readonly config: ServerConfig,
  ) {
    this.epoch = authEpoch(deriveDataKey(config.dataKey), config.adminSecret);
  }

  get sessionDays(): number {
    return getSessionDays(this.db, this.config.sessionDays);
  }

  get cookieName(): string {
    return this.config.cookieSecure ? '__Host-dock_sid' : 'dock_sid';
  }

  cookieOptions(): { path: string; httpOnly: boolean; sameSite: 'strict'; secure: boolean; maxAge: number } {
    return {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.cookieSecure,
      maxAge: this.sessionDays * 24 * 60 * 60,
    };
  }

  login(secret: string, ip: string): LoginResult {
    this.checkRateLimit(ip);
    if (!safeEqual(secret, this.config.adminSecret)) {
      this.recordFailure(ip);
      unauthorized('Invalid secret');
    }
    this.attempts.delete(ip);

    const token = randomToken();
    const tokenHash = hashToken(token);
    const { expiresAt } = createSession(this.db, tokenHash, this.epoch, this.sessionDays);
    return { token, expiresAt };
  }

  verifyToken(token: string | undefined): SessionRow | undefined {
    if (!token) return undefined;
    return findSession(this.db, hashToken(token), this.epoch);
  }

  verifyBearer(header: string | undefined): boolean {
    if (!header) return false;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return false;
    return safeEqual(match[1], this.config.apiToken);
  }

  logout(token: string | undefined): void {
    if (!token) return;
    deleteSession(this.db, hashToken(token));
  }

  revokeAll(): void {
    deleteAllSessions(this.db);
  }

  setSessionDays(days: number): void {
    clampSessions(this.db, days);
  }

  assertCookieCsrf(req: FastifyRequest): void {
    const header = req.headers['x-dock-csrf'];
    if (header !== '1') forbidden('CSRF', 'Missing CSRF header');
    const origin = req.headers.origin;
    if (this.config.publicOrigin && origin && origin !== this.config.publicOrigin) {
      forbidden('ORIGIN', 'Origin mismatch');
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      forbidden('ORIGIN', 'Cross-site request');
    }
  }

  private checkRateLimit(ip: string): void {
    const now = Date.now();
    const attempt = this.attempts.get(ip);
    if (!attempt) return;
    if (attempt.blockedUntil > now) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many login attempts');
    }
    if (attempt.resetAt <= now) this.attempts.delete(ip);
  }

  private recordFailure(ip: string): void {
    const now = Date.now();
    const attempt = this.attempts.get(ip) ?? { count: 0, resetAt: now + 5 * 60 * 1000, blockedUntil: 0 };
    attempt.count++;
    if (attempt.count >= 5) {
      attempt.blockedUntil = now + 15 * 60 * 1000;
      attempt.count = 0;
    }
    this.attempts.set(ip, attempt);
  }
}

export function readSessionToken(req: FastifyRequest & { cookies: Record<string, string | undefined> }, cookieName: string): string | undefined {
  return req.cookies[cookieName];
}

export function getBearer(req: FastifyRequest): string | undefined {
  return typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
}
