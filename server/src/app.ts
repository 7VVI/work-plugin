import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { ServerConfig } from './config';
import { openDatabase, pruneExpiredSessions, setSetting, type Db } from './db';
import { StateStore } from './stateStore';
import { AuthService, getBearer } from './auth';
import { HttpError, unauthorized } from './errors';import { validateLoginBody, validatePushRequest, validateSessionDays } from './validation';

export interface DockApp {
  app: FastifyInstance;
  db: Db;
  store: StateStore;
  auth: AuthService;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');

export async function buildApp(config: ServerConfig): Promise<DockApp> {
  const db = openDatabase(config.dbPath);
  pruneExpiredSessions(db);
  const store = new StateStore(db, config);
  await store.init();
  const auth = new AuthService(db, config);

  const app = Fastify({
    logger: false,
    bodyLimit: 16 * 1024 * 1024,
    trustProxy: config.trustProxy,
  });
  await app.register(cookie);

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (req.url.startsWith('/api/sync/') || req.url.startsWith('/api/health')) {
      reply.header('Access-Control-Allow-Origin', '*');
    }
    if (typeof payload === 'string' && payload.includes('<!DOCTYPE html>')) {
      reply.header('Content-Security-Policy', CSP);
    }
    return payload;
  });

  app.options('/api/sync/*', async (_req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'authorization, content-type, x-dock-csrf');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return reply.code(204).send();
  });

  app.get('/api/health', async (_req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    return { ok: true, service: 'dock-cloud', version: '1.0.0', time: Date.now() };
  });

  async function requireCookie(req: FastifyRequest): Promise<void> {
    const token = req.cookies[auth.cookieName];
    const session = auth.verifyToken(token);
    if (!session) throw unauthorized();
    req.dockSession = session;
    req.dockAuthKind = 'cookie';
  }

  async function requireSyncAuth(req: FastifyRequest): Promise<void> {
    if (auth.verifyBearer(getBearer(req))) {
      req.dockAuthKind = 'bearer';
      return;
    }
    const token = req.cookies[auth.cookieName];
    const session = auth.verifyToken(token);
    if (!session) throw unauthorized();
    req.dockSession = session;
    req.dockAuthKind = 'cookie';
  }

  function assertCsrfForCookie(req: FastifyRequest): void {
    if (req.dockAuthKind === 'cookie') auth.assertCookieCsrf(req);
  }

  app.post('/api/auth/login', async (req, reply) => {
    const secret = validateLoginBody(req.body);
    const result = auth.login(secret, req.ip);
    reply.setCookie(auth.cookieName, result.token, auth.cookieOptions());
    return {
      ok: true,
      expiresAt: result.expiresAt,
      sessionDays: auth.sessionDays,
    };
  });

  app.get('/api/auth/session', { preHandler: requireCookie }, async req => ({
    authenticated: true,
    expiresAt: req.dockSession!.expires_at,
    sessionDays: auth.sessionDays,
  }));

  app.post('/api/auth/logout', { preHandler: requireCookie }, async (req, reply) => {
    auth.assertCookieCsrf(req);
    const token = req.cookies[auth.cookieName];
    auth.logout(token);
    reply.clearCookie(auth.cookieName, { path: '/', secure: config.cookieSecure });
    return { ok: true };
  });

  app.get('/api/settings', { preHandler: requireCookie }, async () => ({
    sessionDays: auth.sessionDays,
    serverTime: Date.now(),
    version: '1.0.0',
  }));

  app.patch('/api/settings', { preHandler: requireCookie }, async (req, reply) => {
    assertCsrfForCookie(req);
    const days = validateSessionDays(req.body);
    setSetting(db, 'session_days', String(days));
    auth.setSessionDays(days);
    return { ok: true, sessionDays: days };
  });

  app.post('/api/settings/revoke-sessions', { preHandler: requireCookie }, async (req, reply) => {
    assertCsrfForCookie(req);
    auth.revokeAll();
    reply.clearCookie(auth.cookieName, { path: '/', secure: config.cookieSecure });
    return { ok: true };
  });

  app.get('/api/sync/ping', { preHandler: requireSyncAuth }, async () => ({
    ok: true,
    revision: store.getRevision(),
    serverTime: Date.now(),
  }));

  app.get('/api/sync/state', { preHandler: requireSyncAuth }, async () => {
    const state = store.getState();
    return {
      revision: state.revision,
      serverTime: Date.now(),
      snapshot: state.snapshot,
      tombstones: state.tombstones,
    };
  });

  app.post('/api/sync/push', { preHandler: requireSyncAuth }, async req => {
    assertCsrfForCookie(req);
    const payload = validatePushRequest(req.body);
    const result = await store.commit(payload);
    return {
      revision: result.state.revision,
      serverTime: Date.now(),
      reset: result.reset,
      snapshot: result.state.snapshot,
      tombstones: result.state.tombstones,
      stats: result.stats,
    };
  });

  if (existsSync(config.webDist)) {
    const assetsDir = join(config.webDist, 'assets');
    if (existsSync(assetsDir)) {
      await app.register(fastifyStatic, {
        root: assetsDir,
        prefix: '/assets/',
        decorateReply: false,
      });
    }
    const webHtmlPath = join(config.webDist, 'web.html');
    if (existsSync(webHtmlPath)) {
      const webHtml = await readFile(webHtmlPath);
      const sendWeb = async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.type('text/html; charset=utf-8').send(webHtml);
      };
      app.get('/', sendWeb);
      app.get('/web.html', sendWeb);
    }
  }

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({ error: 'RATE_LIMITED' });
    }
    console.error('[dock-cloud]', error instanceof Error ? error.message : error);
    return reply.code(500).send({ error: 'INTERNAL' });
  });

  app.addHook('onClose', async () => {
    store.close();
  });

  return { app, db, store, auth };
}
