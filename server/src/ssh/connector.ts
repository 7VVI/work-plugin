import { createHash } from 'node:crypto';
import { Client } from 'ssh2';
import type { ClientChannel, ConnectConfig } from 'ssh2';
import type { SshErrorCode } from '@protocol/ssh';

export class SshConnectError extends Error {
  constructor(
    public readonly code: SshErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SshConnectError';
  }
}

export interface SshTarget {
  serverId: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SshConnectOptions {
  cols: number;
  rows: number;
  onFingerprint: (fingerprint: string) => void;
  onData: (chunk: Buffer) => void;
  onExit: (code: number | null, signal: string | null) => void;
}

export interface SshChannel {
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  pause(): void;
  resume(): void;
  close(): void;
}

export interface SshConnector {
  connect(target: SshTarget, options: SshConnectOptions): Promise<SshChannel>;
}

function fingerprintOf(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
}

function mapError(error: Error & { level?: string; code?: string }): SshErrorCode {
  const message = error.message || '';
  if (error.level === 'client-authentication') return 'SSH_AUTH_FAILED';
  if (/encrypted private|private ?key|cannot parse.*key|parse.*private/i.test(message)) return 'SSH_KEY_INVALID';
  if (error.code === 'ECONNREFUSED') return 'SSH_REFUSED';
  if (error.code === 'ENOTFOUND' || error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH') return 'SSH_UNREACHABLE';
  if (error.code === 'ETIMEDOUT' || /timed? ?out/i.test(message)) return 'SSH_TIMEOUT';
  return 'SSH_UNREACHABLE';
}

export class RealSshConnector implements SshConnector {
  constructor(private readonly connectTimeoutMs = 20_000) {}

  connect(target: SshTarget, options: SshConnectOptions): Promise<SshChannel> {
    const privateKey = target.privateKey?.trim() ? target.privateKey : undefined;
    const password = target.password ? target.password : undefined;
    if (!target.host.trim() || !target.username.trim()) {
      return Promise.reject(new SshConnectError('SSH_INVALID_TARGET', 'Missing SSH host or username'));
    }
    if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65535) {
      return Promise.reject(new SshConnectError('SSH_INVALID_TARGET', 'Invalid SSH port'));
    }
    if (!privateKey && !password) {
      return Promise.reject(new SshConnectError('SSH_NO_CREDENTIALS', 'No SSH password or private key'));
    }

    return new Promise<SshChannel>((resolve, reject) => {
      const client = new Client();
      let settled = false;
      let fingerprint = '';
      let timer: NodeJS.Timeout | null = null;

      const clearTimer = (): void => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const fail = (code: SshErrorCode, message: string): void => {
        if (settled) return;
        settled = true;
        clearTimer();
        try { client.end(); } catch { /* already closed */ }
        reject(new SshConnectError(code, message));
      };

      client.on('error', (error: Error & { level?: string; code?: string }) => {
        fail(mapError(error), error.message || 'SSH connection failed');
      });
      client.on('close', () => {
        fail('SSH_UNREACHABLE', 'SSH connection closed before ready');
      });

      client.on('ready', () => {
        client.shell({ term: 'xterm-256color', cols: options.cols, rows: options.rows }, (error, stream) => {
          if (error) {
            fail('SSH_SHELL_FAILED', error.message || 'Failed to open SSH shell');
            return;
          }
          settled = true;
          clearTimer();
          stream.on('data', (chunk: Buffer) => options.onData(chunk));
          stream.stderr.on('data', (chunk: Buffer) => options.onData(chunk));
          stream.on('close', (code: number | null, signal: string | null) => {
            options.onExit(code ?? null, signal ?? null);
          });
          resolve({
            write: (data) => {
              if (!stream.writable) return;
              stream.write(Buffer.from(data));
            },
            resize: (cols, rows) => {
              try { stream.setWindow(rows, cols, 0, 0); } catch { /* stream closed */ }
            },
            pause: () => {
              stream.pause();
              stream.stderr.pause();
            },
            resume: () => {
              stream.resume();
              stream.stderr.resume();
            },
            close: () => {
              try { stream.close(); } catch { /* already closed */ }
              try { client.end(); } catch { /* already closed */ }
            },
          });
        });
      });

      const config: ConnectConfig = {
        host: target.host,
        port: target.port,
        username: target.username,
        readyTimeout: 15_000,
        keepaliveInterval: 20_000,
        keepaliveCountMax: 3,
        hostVerifier: (key: Buffer) => {
          if (!fingerprint) {
            fingerprint = fingerprintOf(key);
            options.onFingerprint(fingerprint);
          }
          return true;
        },
      };
      if (privateKey) config.privateKey = privateKey;
      else config.password = password;

      // readyTimeout 只覆盖握手；目标不可达时 TCP 建连可能长期挂起，这里兜底。
      timer = setTimeout(() => {
        fail('SSH_TIMEOUT', `Timed out connecting to ${target.host}:${target.port}`);
      }, this.connectTimeoutMs);

      try {
        client.connect(config);
      } catch (error) {
        const err = error as Error;
        fail(privateKey ? 'SSH_KEY_INVALID' : 'SSH_UNREACHABLE', err.message || 'SSH connect failed');
      }
    });
  }
}
