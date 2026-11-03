import type {
  SshErrorCode,
  SshFsClientMessage,
  SshFsEntry,
  SshFsServerMessage,
  SshFsStat,
} from '@protocol/ssh';
import type { SshSocket } from './SshSocket';

export class SshFsError extends Error {
  constructor(public readonly code: SshErrorCode, message: string) {
    super(message);
    this.name = 'SshFsError';
  }
}

export interface SshFsProgress {
  loaded: number;
  total: number;
}

export interface SshFsListResult {
  entries: SshFsEntry[];
  truncated: boolean;
}

interface PendingOp {
  resolve: (value: unknown) => void;
  reject: (error: SshFsError) => void;
  onMessage?: (message: SshFsServerMessage, resolve: (value: unknown) => void) => void;
  ackWaiters: Map<number, () => void>;
}

const TERMINAL_TYPES = new Set(['fs-ok', 'fs-list', 'fs-stat', 'fs-read-end']);

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** 前 8KB 含 NUL 或不是合法 UTF-8 → 视为二进制，不可编辑 */
export function looksBinary(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 8192);
  if (head.includes(0)) return true;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head);
    return false;
  } catch {
    return true;
  }
}

export function joinPath(dir: string, name: string): string {
  if (!dir) return name;
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`;
}

export function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  if (index <= 0) return '/';
  return path.slice(0, index);
}

/**
 * SFTP 操作层：把 fs-* 控制帧包装成 Promise，并负责读写的分片与进度。
 */
export class SshFs {
  private nextId = 1;
  private readonly pending = new Map<number, PendingOp>();
  private disposed = false;

  constructor(
    private readonly socket: SshSocket,
    private readonly chunkBytes = 48 * 1024,
  ) {
    socket.onFsMessage = (message) => this.handle(message);
  }

  dispose(): void {
    this.disposed = true;
    for (const op of this.pending.values()) {
      op.reject(new SshFsError('SFTP_FAILED', '连接已断开'));
      for (const resolve of op.ackWaiters.values()) resolve();
      op.ackWaiters.clear();
    }
    this.pending.clear();
    this.socket.onFsMessage = null;
  }

  private send(message: SshFsClientMessage): void {
    if (this.disposed) return;
    this.socket.sendFs(message);
  }

  async list(path: string, limit = 1000): Promise<SshFsListResult> {
    const id = this.nextId++;
    const op = this.createOp<{ entries: SshFsEntry[]; truncated: boolean }>(id, (message, resolve) => {
      if (message.type === 'fs-list') {
        resolve({ entries: message.entries, truncated: message.truncated });
      }
    });
    this.send({ type: 'fs-list', id, path, limit });
    return op.promise;
  }

  async stat(path: string): Promise<SshFsStat> {
    const id = this.nextId++;
    const op = this.createOp<SshFsStat>(id, (message, resolve) => {
      if (message.type === 'fs-stat') resolve(message.stat);
    });
    this.send({ type: 'fs-stat', id, path });
    return op.promise;
  }

  /** 读取文件（intent 决定服务端大小上限） */
  async readFile(
    path: string,
    intent: 'edit' | 'download',
    onProgress?: (progress: SshFsProgress) => void,
  ): Promise<Uint8Array> {
    const id = this.nextId++;
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    let total = 0;
    const op = this.createOp<Uint8Array>(id, (message, resolve) => {
      if (message.type === 'fs-read-meta') {
        total = message.size;
        onProgress?.({ loaded: 0, total });
      } else if (message.type === 'fs-read-chunk') {
        const bytes = base64ToBytes(message.data);
        chunks.push(bytes);
        loaded += bytes.length;
        onProgress?.({ loaded, total });
      } else if (message.type === 'fs-read-end') {
        const merged = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(merged);
      }
    });
    this.send({ type: 'fs-read', id, path, intent });
    return op.promise;
  }

  /** 写入文件：分片发送并等待逐片 ack */
  async writeFile(
    path: string,
    data: Uint8Array | Blob,
    options: { intent?: 'edit' | 'upload'; onProgress?: (progress: SshFsProgress) => void } = {},
  ): Promise<void> {
    const size = data instanceof Blob ? data.size : data.byteLength;
    const id = this.nextId++;
    const op = this.createOp<void>(id);
    this.send({
      type: 'fs-write-start',
      id,
      path,
      size,
      intent: options.intent ?? 'upload',
    });

    let offset = 0;
    let seq = 0;
    while (offset < size) {
      const end = Math.min(offset + this.chunkBytes, size);
      const bytes = data instanceof Blob
        ? new Uint8Array(await data.slice(offset, end).arrayBuffer())
        : data.subarray(offset, end);
      const acknowledged = new Promise<void>((resolve) => {
        op.ackWaiters.set(seq, resolve);
      });
      this.send({ type: 'fs-write-chunk', id, seq, data: bytesToBase64(bytes) });
      await acknowledged;
      offset = end;
      seq += 1;
      options.onProgress?.({ loaded: offset, total: size });
    }
    await op.promise;
  }

  async mkdir(path: string): Promise<void> {
    const id = this.nextId++;
    const op = this.createOp<void>(id);
    this.send({ type: 'fs-mkdir', id, path });
    await op.promise;
  }

  async touch(path: string): Promise<void> {
    const id = this.nextId++;
    const op = this.createOp<void>(id);
    this.send({ type: 'fs-touch', id, path });
    await op.promise;
  }

  async remove(path: string, recursive = false): Promise<void> {
    const id = this.nextId++;
    const op = this.createOp<void>(id);
    this.send({ type: 'fs-rm', id, path, recursive });
    await op.promise;
  }

  async rename(from: string, to: string): Promise<void> {
    const id = this.nextId++;
    const op = this.createOp<void>(id);
    this.send({ type: 'fs-rename', id, from, to });
    await op.promise;
  }

  private createOp<T>(
    id: number,
    onMessage?: (message: SshFsServerMessage, resolve: (value: unknown) => void) => void,
  ): { promise: Promise<T>; ackWaiters: Map<number, () => void> } {
    let resolveFn!: (value: unknown) => void;
    let rejectFn!: (error: SshFsError) => void;
    const promise = new Promise<T>((resolve, reject) => {
      resolveFn = resolve as (value: unknown) => void;
      rejectFn = reject;
    });
    const ackWaiters = new Map<number, () => void>();
    this.pending.set(id, { resolve: resolveFn, reject: rejectFn, onMessage, ackWaiters });
    return { promise, ackWaiters };
  }

  private handle(message: SshFsServerMessage): void {
    const id = 'id' in message ? message.id : null;
    const op = id != null ? this.pending.get(id) : undefined;
    if (!op) return;
    if (message.type === 'fs-error') {
      this.pending.delete(id!);
      op.reject(new SshFsError(message.code, message.message));
      for (const resolve of op.ackWaiters.values()) resolve();
      op.ackWaiters.clear();
      return;
    }
    if (message.type === 'fs-ack') {
      const resolve = op.ackWaiters.get(message.seq);
      if (resolve) {
        op.ackWaiters.delete(message.seq);
        resolve();
      }
      return;
    }
    if (TERMINAL_TYPES.has(message.type)) this.pending.delete(id!);
    op.onMessage?.(message, op.resolve);
    if (message.type === 'fs-ok') op.resolve(undefined);
  }
}
