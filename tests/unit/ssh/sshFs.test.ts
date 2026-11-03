import { describe, it, expect } from 'vitest';
import type { SshFsClientMessage, SshFsServerMessage } from '@protocol/ssh';
import {
  SshFs,
  base64ToBytes,
  bytesToBase64,
  joinPath,
  looksBinary,
  parentPath,
} from '../../../src/shared/ssh/sshFs';
import type { SshSocket } from '../../../src/shared/ssh/SshSocket';

class FakeSocket {
  sent: SshFsClientMessage[] = [];
  onFsMessage: ((message: SshFsServerMessage) => void) | null = null;

  sendFs(message: SshFsClientMessage): void {
    this.sent.push(message);
  }

  emit(message: SshFsServerMessage): void {
    this.onFsMessage?.(message);
  }
}

function createFs(): { fs: SshFs; socket: FakeSocket } {
  const socket = new FakeSocket();
  const fs = new SshFs(socket as unknown as SshSocket);
  return { fs, socket };
}

function lastId(socket: FakeSocket): number {
  return socket.sent[socket.sent.length - 1]!.id;
}

describe('SshFs', () => {
  it('lists a directory and resolves with entries', async () => {
    const { fs, socket } = createFs();
    const promise = fs.list('/work');
    const id = lastId(socket);
    expect(socket.sent[0]).toMatchObject({ type: 'fs-list', id, path: '/work' });

    socket.emit({
      type: 'fs-list',
      id,
      path: '/work',
      entries: [{ name: 'a.md', type: 'file', size: 3, mtime: 1 }],
      truncated: false,
    });
    await expect(promise).resolves.toEqual({
      entries: [{ name: 'a.md', type: 'file', size: 3, mtime: 1 }],
      truncated: false,
    });
  });

  it('rejects with the server error code', async () => {
    const { fs, socket } = createFs();
    const promise = fs.list('/missing');
    const id = lastId(socket);
    socket.emit({ type: 'fs-error', id, code: 'SFTP_NOT_FOUND', message: '文件或目录不存在' });
    await expect(promise).rejects.toMatchObject({ code: 'SFTP_NOT_FOUND' });
  });

  it('assembles a multi-chunk read and reports progress', async () => {
    const { fs, socket } = createFs();
    const progress: number[] = [];
    const promise = fs.readFile('/big.bin', 'download', p => progress.push(p.loaded));
    const id = lastId(socket);
    socket.emit({ type: 'fs-read-meta', id, size: 4, mtime: 0 });
    socket.emit({ type: 'fs-read-chunk', id, seq: 0, data: bytesToBase64(new Uint8Array([1, 2])) });
    socket.emit({ type: 'fs-read-chunk', id, seq: 1, data: bytesToBase64(new Uint8Array([3, 4])) });
    socket.emit({ type: 'fs-read-end', id });
    const bytes = await promise;
    expect([...bytes]).toEqual([1, 2, 3, 4]);
    expect(progress).toEqual([0, 2, 4]);
  });

  it('writes in chunks and waits for each ack', async () => {
    const { fs, socket } = createFs();
    const payload = new Uint8Array(100 * 1024);
    const promise = fs.writeFile('/new.bin', payload);
    const id = lastId(socket);
    expect(socket.sent[0]).toMatchObject({ type: 'fs-write-start', id, size: payload.length, intent: 'upload' });

    const flush = () => new Promise(resolve => setTimeout(resolve, 0));
    // write-start 后立即发第一片；未收到 ack 前不再发下一片
    expect(socket.sent).toHaveLength(2);
    socket.emit({ type: 'fs-ack', id, seq: 0 });
    await flush();
    expect(socket.sent).toHaveLength(3);
    socket.emit({ type: 'fs-ack', id, seq: 1 });
    await flush();
    expect(socket.sent).toHaveLength(4);
    socket.emit({ type: 'fs-ack', id, seq: 2 });
    await flush();
    expect(socket.sent).toHaveLength(4);
    socket.emit({ type: 'fs-ok', id });
    await expect(promise).resolves.toBeUndefined();
    expect(socket.sent.filter(message => message.type === 'fs-write-chunk')).toHaveLength(3);
  });

  it('rejects pending operations when disposed', async () => {
    const { fs, socket } = createFs();
    const promise = fs.list('/work');
    fs.dispose();
    await expect(promise).rejects.toMatchObject({ code: 'SFTP_FAILED' });
    expect(socket.onFsMessage).toBeNull();
  });

  it('ignores responses for unknown ids', async () => {
    const { fs, socket } = createFs();
    const promise = fs.list('/work');
    const id = lastId(socket);
    socket.emit({ type: 'fs-list', id: id + 99, path: '/x', entries: [], truncated: false });
    socket.emit({ type: 'fs-list', id, path: '/work', entries: [], truncated: false });
    await expect(promise).resolves.toEqual({ entries: [], truncated: false });
  });
});

describe('ssh fs helpers', () => {
  it('round-trips base64 including binary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 65]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });

  it('detects binary content', () => {
    expect(looksBinary(new Uint8Array([104, 105, 0]))).toBe(true);
    expect(looksBinary(new TextEncoder().encode('中文内容 ok'))).toBe(false);
  });

  it('joins and splits paths', () => {
    expect(joinPath('/work', 'a.md')).toBe('/work/a.md');
    expect(joinPath('/work/', 'a.md')).toBe('/work/a.md');
    expect(parentPath('/work/a.md')).toBe('/work');
    expect(parentPath('/a.md')).toBe('/');
  });
});
