export const SSH_PROTOCOL = 1;

export type SshErrorCode =
  | 'TICKET_INVALID'
  | 'SSH_DISABLED'
  | 'SERVER_NOT_FOUND'
  | 'SSH_NO_CREDENTIALS'
  | 'SSH_INVALID_TARGET'
  | 'SSH_AUTH_FAILED'
  | 'SSH_KEY_INVALID'
  | 'SSH_TIMEOUT'
  | 'SSH_REFUSED'
  | 'SSH_UNREACHABLE'
  | 'SSH_SHELL_FAILED'
  | 'SSH_SESSION_LIMIT'
  | 'SSH_IDLE_TIMEOUT';

/** 客户端 → 服务端的控制消息（文本帧）；终端输入走二进制帧 */
export type SshClientMessage =
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping'; t: number }
  | { type: 'close' };

/** 服务端 → 客户端的控制消息（文本帧）；终端输出走二进制帧 */
export type SshServerMessage =
  | {
      type: 'ready';
      protocol: typeof SSH_PROTOCOL;
      serverId: string;
      sessionId: string;
      fingerprint: string;
    }
  | { type: 'pong'; t: number }
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'error'; code: SshErrorCode; message: string };

export interface SshTicketResponse {
  ticket: string;
  expiresAt: number;
  protocol: typeof SSH_PROTOCOL;
}
