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
  | 'SSH_IDLE_TIMEOUT'
  | 'SFTP_DISABLED'
  | 'SFTP_NOT_FOUND'
  | 'SFTP_PERMISSION_DENIED'
  | 'SFTP_TIMEOUT'
  | 'SFTP_TOO_LARGE'
  | 'SFTP_BINARY'
  | 'SFTP_BUSY'
  | 'SFTP_FAILED';

export type SshFsEntryType = 'file' | 'dir' | 'link' | 'other';

export interface SshFsEntry {
  name: string;
  type: SshFsEntryType;
  size: number;
  mtime: number;
}

export interface SshFsStat {
  type: SshFsEntryType;
  size: number;
  mtime: number;
}

/** 客户端 → 服务端的控制消息（文本帧）；终端输入走二进制帧 */
export type SshClientMessage =
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping'; t: number }
  | { type: 'close' }
  | { type: 'fs-list'; id: number; path: string; limit?: number }
  | { type: 'fs-stat'; id: number; path: string }
  | { type: 'fs-read'; id: number; path: string; intent: 'edit' | 'download' }
  | { type: 'fs-write-start'; id: number; path: string; size: number; intent: 'edit' | 'upload' }
  | { type: 'fs-write-chunk'; id: number; seq: number; data: string }
  | { type: 'fs-mkdir'; id: number; path: string }
  | { type: 'fs-touch'; id: number; path: string }
  | { type: 'fs-rm'; id: number; path: string; recursive: boolean }
  | { type: 'fs-rename'; id: number; from: string; to: string }
  | { type: 'fs-cancel'; id: number };

/** 服务端 → 客户端的控制消息（文本帧）；终端输出走二进制帧 */
export type SshServerMessage =
  | {
      type: 'ready';
      protocol: typeof SSH_PROTOCOL;
      serverId: string;
      sessionId: string;
      fingerprint: string;
      /** 服务端支持 SFTP 文件管理时的能力位 */
      sftp?: true;
      fsMaxEdit?: number;
      fsMaxTransfer?: number;
    }
  | { type: 'pong'; t: number }
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'error'; code: SshErrorCode; message: string }
  | { type: 'fs-ok'; id: number }
  | { type: 'fs-error'; id: number | null; code: SshErrorCode; message: string }
  | { type: 'fs-list'; id: number; path: string; entries: SshFsEntry[]; truncated: boolean }
  | { type: 'fs-stat'; id: number; stat: SshFsStat }
  | { type: 'fs-read-meta'; id: number; size: number; mtime: number }
  | { type: 'fs-read-chunk'; id: number; seq: number; data: string }
  | { type: 'fs-read-end'; id: number }
  | { type: 'fs-ack'; id: number; seq: number };

export type SshFsClientMessage = Extract<SshClientMessage, { type: `fs-${string}` }>;
export type SshFsServerMessage = Extract<SshServerMessage, { type: `fs-${string}` }>;

export interface SshTicketResponse {
  ticket: string;
  expiresAt: number;
  protocol: typeof SSH_PROTOCOL;
}
