import type { SessionRow } from './db';

declare module 'fastify' {
  interface FastifyRequest {
    dockSession?: SessionRow;
    dockAuthKind?: 'cookie' | 'bearer';
  }
}
