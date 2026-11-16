import { WsTicketStore, type IssuedTicket, type WsAuthKind } from '../ticketStore';

export type SshAuthKind = WsAuthKind;

export type ConsumeResult =
  | { ok: true; serverId: string; authKind: SshAuthKind }
  | { ok: false; reason: 'invalid' | 'expired' | 'origin' };

/**
 * SSH WebSocket 的一次性票据：只存散列，短 TTL，使用即销毁。
 * 票据绑定 serverId 与发起请求的 Origin，升级时再比对一次。
 */
export class SshTicketStore extends WsTicketStore {
  issue(
    serverId: string,
    authKind: SshAuthKind,
    origin: string | undefined,
    ip: string,
  ): IssuedTicket {
    return super.issue('ssh', serverId, authKind, origin, ip);
  }

  consume(ticket: string, origin: string | undefined): ConsumeResult {
    const result = this.consumeScoped(ticket, origin, 'ssh');
    if (!result.ok) {
      return result.reason === 'scope'
        ? { ok: false, reason: 'invalid' }
        : { ok: false, reason: result.reason };
    }
    return { ok: true, serverId: result.resourceId, authKind: result.authKind };
  }
}
