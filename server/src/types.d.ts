import type { ServerRec } from '@protocol/types';
import type { SessionRow } from './db';
import type { SshAuthKind } from './ssh/ticketStore';

declare module 'fastify' {
  interface FastifyRequest {
    dockSession?: SessionRow;
    dockAuthKind?: 'cookie' | 'bearer';
    sshTicket?: { serverId: string; authKind: SshAuthKind };
    sshServer?: ServerRec;
  }
}
