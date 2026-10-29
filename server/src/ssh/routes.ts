import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SSH_PROTOCOL } from '@protocol/ssh';
import type { ServerConfig } from '../config';
import { HttpError, forbidden, unauthorized } from '../errors';
import type { StateStore } from '../stateStore';
import { validateSshTicketBody } from '../validation';
import type { SshSocketLike } from './sessionManager';
import type { SshSessionManager } from './sessionManager';
import type { SshTicketStore } from './ticketStore';

export interface SshRouteDeps {
  config: ServerConfig;
  store: StateStore;
  tickets: SshTicketStore;
  sessions: SshSessionManager;
  requireSyncAuth: (req: FastifyRequest) => Promise<void>;
  assertCsrfForCookie: (req: FastifyRequest) => void;
}

export function registerSshRoutes(app: FastifyInstance, deps: SshRouteDeps): void {
  app.post('/api/ssh/ticket', { preHandler: deps.requireSyncAuth }, async (req) => {
    deps.assertCsrfForCookie(req);
    if (!deps.config.sshEnabled) {
      throw new HttpError(503, 'SSH_DISABLED', 'SSH terminal is disabled');
    }
    const { serverId } = validateSshTicketBody(req.body);
    if (!deps.store.getServer(serverId)) {
      throw new HttpError(404, 'SERVER_NOT_FOUND', 'Server not found');
    }
    const issued = deps.tickets.issue(
      serverId,
      req.dockAuthKind ?? 'bearer',
      req.headers.origin,
      req.ip,
    );
    return { ticket: issued.ticket, expiresAt: issued.expiresAt, protocol: SSH_PROTOCOL };
  });

  app.get('/api/ssh/ws', {
    websocket: true,
    preValidation: async (req) => {
      if (!deps.config.sshEnabled) {
        throw new HttpError(503, 'SSH_DISABLED', 'SSH terminal is disabled');
      }
      const query = req.query as { ticket?: unknown };
      const ticket = typeof query.ticket === 'string' ? query.ticket : '';
      const consumed = deps.tickets.consume(ticket, req.headers.origin);
      if (!consumed.ok) {
        if (consumed.reason === 'origin') throw forbidden('ORIGIN', 'Origin mismatch');
        throw unauthorized('Invalid or expired SSH ticket');
      }
      const server = deps.store.getServer(consumed.serverId);
      if (!server) throw new HttpError(404, 'SERVER_NOT_FOUND', 'Server not found');
      req.sshTicket = { serverId: consumed.serverId, authKind: consumed.authKind };
      req.sshServer = server;
    },
  }, (socket, req) => {
    if (!req.sshTicket || !req.sshServer) {
      try { socket.close(1008, 'invalid ticket'); } catch { /* closed */ }
      return;
    }
    deps.sessions.attach(socket as unknown as SshSocketLike, req.sshServer);
  });
}
