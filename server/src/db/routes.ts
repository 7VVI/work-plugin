import type { FastifyInstance, FastifyRequest } from 'fastify';
import { DB_PROTOCOL } from '@protocol/db';
import type { ServerConfig } from '../config';
import { HttpError, forbidden, unauthorized } from '../errors';
import type { StateStore } from '../stateStore';
import type { WsTicketStore } from '../ticketStore';
import { validateDbTicketBody } from '../validation';
import type { DbSessionManager, DbSocketLike } from './sessionManager';
import { isDbMiddlewareType } from './target';

export interface DbRouteDeps {
  config: ServerConfig;
  store: StateStore;
  tickets: WsTicketStore;
  sessions: DbSessionManager;
  requireSyncAuth: (req: FastifyRequest) => Promise<void>;
  assertCsrfForCookie: (req: FastifyRequest) => void;
}

export function registerDbRoutes(app: FastifyInstance, deps: DbRouteDeps): void {
  app.post('/api/db/ticket', { preHandler: deps.requireSyncAuth }, async (req) => {
    deps.assertCsrfForCookie(req);
    if (!deps.config.dbEnabled) {
      throw new HttpError(503, 'DB_DISABLED', 'Database management is disabled');
    }
    const { middlewareId } = validateDbTicketBody(req.body);
    const middleware = deps.store.getMiddleware(middlewareId);
    if (!middleware) {
      throw new HttpError(404, 'DB_NOT_FOUND', 'Middleware not found');
    }
    if (!isDbMiddlewareType(middleware.type)) {
      throw new HttpError(400, 'DB_TYPE_UNSUPPORTED', 'Middleware type does not support database management');
    }
    const issued = deps.tickets.issue(
      'db',
      middlewareId,
      req.dockAuthKind ?? 'bearer',
      req.headers.origin,
      req.ip,
    );
    return { ticket: issued.ticket, expiresAt: issued.expiresAt, protocol: DB_PROTOCOL };
  });

  app.get('/api/db/ws', {
    websocket: true,
    preValidation: async (req) => {
      if (!deps.config.dbEnabled) {
        throw new HttpError(503, 'DB_DISABLED', 'Database management is disabled');
      }
      const query = req.query as { ticket?: unknown };
      const ticket = typeof query.ticket === 'string' ? query.ticket : '';
      const consumed = deps.tickets.consumeScoped(ticket, req.headers.origin, 'db');
      if (!consumed.ok) {
        if (consumed.reason === 'origin') throw forbidden('ORIGIN', 'Origin mismatch');
        throw unauthorized('Invalid or expired database ticket');
      }
      const middleware = deps.store.getMiddleware(consumed.resourceId);
      if (!middleware) throw new HttpError(404, 'DB_NOT_FOUND', 'Middleware not found');
      req.dbTicket = { middlewareId: consumed.resourceId, authKind: consumed.authKind };
      req.dbMiddleware = middleware;
    },
  }, (socket, req) => {
    if (!req.dbTicket || !req.dbMiddleware) {
      try { socket.close(1008, 'invalid ticket'); } catch { /* closed */ }
      return;
    }
    deps.sessions.attach(socket as unknown as DbSocketLike, req.dbMiddleware);
  });
}
