import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ServerRec } from '@protocol/index';
import { buildApp } from '../src/app';
import type { ServerConfig } from '../src/config';
import { FakeSshConnector } from './sshFake';
import { collector, waitTick, type WsMessage } from './wsTest';

const serverRec: ServerRec = {
  id: 'srv_1',
  name: 'test-server',
  ip: '127.0.0.1',
  sshPort: 22,
  username: 'root',
  password: 'secret',
  environment: 'development',
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  tagIds: [],
};

interface Harness {
  fake: FakeSshConnector;
  app: FastifyInstance;
  dir: string;
}

function parseWs(message: WsMessage): Record<string, unknown> {
  return JSON.parse(message.data.toString('utf8')) as Record<string, unknown>;
}

describe('ssh fs gateway', () => {
  const harnesses: Harness[] = [];
  let fake: FakeSshConnector;

  beforeEach(() => {
    fake = new FakeSshConnector();
  });

  afterEach(async () => {
    for (const harness of harnesses.splice(0)) {
      await harness.app.close();
      rmSync(harness.dir, { recursive: true, force: true });
    }
  });

  async function buildHarness(overrides: Partial<ServerConfig> & { sshConnector?: FakeSshConnector } = {}): Promise<Harness> {
    const harnessDir = mkdtempSync(join(tmpdir(), 'dock-ssh-fs-'));
    const { sshConnector, ...configOverrides } = overrides;
    const connector = sshConnector ?? fake;
    const built = await buildApp(testConfig(harnessDir, configOverrides), { sshConnector: connector });
    built.store.getState().snapshot.data.servers.push({ ...serverRec });
    await built.app.ready();
    const harness: Harness = { fake: connector, app: built.app, dir: harnessDir };
    harnesses.push(harness);
    return harness;
  }

  async function openDefaultSession() {
    const harness = await buildHarness();
    const session = await openSession(harness);
    return { harness, ...session };
  }

  async function issue(harness: Harness, serverId = serverRec.id) {
    return harness.app.inject({
      method: 'POST',
      url: '/api/ssh/ticket',
      headers: {
        authorization: 'Bearer api-token-12345678901234567890',
        origin: 'chrome-extension://dock-test',
      },
      payload: { serverId },
    });
  }

  async function openSession(harness: Harness): Promise<{
    socket: WebSocket;
    messages: ReturnType<typeof collector>;
    ready: Record<string, unknown>;
  }> {
    const response = await issue(harness);
    expect(response.statusCode).toBe(200);
    const { ticket } = response.json() as { ticket: string };
    let socket!: WebSocket;
    let messages!: ReturnType<typeof collector>;
    await harness.app.injectWS(`/api/ssh/ws?ticket=${ticket}`, {
      headers: { origin: 'chrome-extension://dock-test' },
    }, { onOpen: ws => { socket = ws; messages = collector(ws); } });
    const ready = await messages.next(2000);
    const readyBody = JSON.parse(ready.data.toString('utf8')) as Record<string, unknown>;
    expect(readyBody.type).toBe('ready');
    return { socket, messages, ready: readyBody };
  }

  async function waitForFs(
    messages: ReturnType<typeof collector>,
    id: number,
    type: string,
    timeoutMs = 2000,
  ): Promise<Record<string, unknown>> {
    const message = await messages.nextMatching(timeoutMs, message => {
      try {
        const body = JSON.parse(message.data.toString('utf8')) as Record<string, unknown>;
        return body.type === type && body.id === id;
      } catch {
        return false;
      }
    });
    return parseWs(message);
  }

  function b64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }

  // ---------- 能力协商 ----------

  it('advertises sftp capability and caps in ready', async () => {
    const { ready } = await openDefaultSession();
    expect(ready.sftp).toBe(true);
    expect(ready.fsMaxEdit).toBe(2 * 1024 * 1024);
    expect(ready.fsMaxTransfer).toBe(200 * 1024 * 1024);
  });

  it('omits sftp capability when file management is disabled', async () => {
    const disabledFake = new FakeSshConnector();
    const harness = await buildHarness({ sshFsEnabled: false, sshConnector: disabledFake });
    harnesses.push(harness);
    const { ready } = await openSession(harness);
    expect(ready.sftp).toBeUndefined();
  });

  it('rejects fs ops with SFTP_DISABLED when file management is disabled', async () => {
    const harness = await buildHarness({ sshFsEnabled: false });
    harnesses.push(harness);
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'fs-list', id: 7, path: '/' }));
    const error = await waitForFs(messages, 7, 'fs-error');
    expect(error).toMatchObject({ code: 'SFTP_DISABLED' });
  });

  // ---------- 目录与元数据 ----------

  it('lists directory entries and reports truncation', async () => {
    fake.fsTree.seed({
      '/work/a.txt': 'a',
      '/work/b.log': 'b',
      '/work/sub': { dir: true },
    });
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-list', id: 1, path: '/work' }));
    const list = await waitForFs(messages, 1, 'fs-list');
    const entries = list.entries as Array<{ name: string; type: string; size: number }>;
    expect(entries.map(entry => entry.name).sort()).toEqual(['a.txt', 'b.log', 'sub']);
    expect(list.truncated).toBe(false);

    socket.send(JSON.stringify({ type: 'fs-list', id: 2, path: '/work', limit: 2 }));
    const limited = await waitForFs(messages, 2, 'fs-list');
    expect((limited.entries as unknown[]).length).toBe(2);
    expect(limited.truncated).toBe(true);
  });

  it('returns SFTP_NOT_FOUND for a missing directory', async () => {
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-list', id: 3, path: '/missing' }));
    const error = await waitForFs(messages, 3, 'fs-error');
    expect(error).toMatchObject({ code: 'SFTP_NOT_FOUND' });
  });

  it('maps injected sftp failures to permission denied', async () => {
    fake.fsTree.seed({ '/a.txt': 'a' });
    const { socket, messages } = await openDefaultSession();
    fake.failSftpWith = { code: 3, message: 'permission denied' };
    socket.send(JSON.stringify({ type: 'fs-list', id: 4, path: '/' }));
    const error = await waitForFs(messages, 4, 'fs-error');
    expect(error).toMatchObject({ code: 'SFTP_PERMISSION_DENIED' });
  });

  it('stats a file', async () => {
    fake.fsTree.seed({ '/a.txt': 'hello' });
    const node = fake.fsTree.resolve('/a.txt');
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-stat', id: 5, path: '/a.txt' }));
    const stat = await waitForFs(messages, 5, 'fs-stat');
    const body = stat.stat as { type: string; size: number; mtime: number };
    expect(body).toMatchObject({ type: 'file', size: 5 });
    expect(body.mtime).toBeGreaterThan(0);
    void node;
  });

  // ---------- 读取 ----------

  it('streams a multi-chunk read for edit intent', async () => {
    const content = Buffer.from(
      Array.from({ length: 40 * 1024 }, (_, index) => (index % 2 === 0 ? 0x00 : 0xff)),
    );
    fake.fsTree.seed({ '/big.bin': content });
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-read', id: 10, path: '/big.bin', intent: 'edit' }));
    const meta = await waitForFs(messages, 10, 'fs-read-meta');
    expect(meta.size).toBe(content.length);

    const chunks: Buffer[] = [];
    let sawEnd = false;
    for (;;) {
      const message = await messages.next(2000);
      const body = JSON.parse(message.data.toString('utf8')) as Record<string, unknown>;
      if (body.type === 'fs-read-chunk' && body.id === 10) {
        expect(body.seq).toBe(chunks.length);
        const data = Buffer.from(body.data as string, 'base64');
        expect((body.data as string).length).toBeLessThanOrEqual(64 * 1024);
        chunks.push(data);
        continue;
      }
      if (body.type === 'fs-read-end' && body.id === 10) {
        sawEnd = true;
        break;
      }
      if (body.type === 'fs-error') throw new Error(`unexpected fs-error: ${body.message}`);
    }
    expect(sawEnd).toBe(true);
    expect(Buffer.concat(chunks).equals(content)).toBe(true);
  });

  it('enforces the edit cap before reading', async () => {
    const strictFake = new FakeSshConnector();
    strictFake.fsTree.seed({ '/a.bin': Buffer.alloc(100, 1) });
    const harness = await buildHarness({ sshFsMaxEdit: 64, sshConnector: strictFake });
    harnesses.push(harness);
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'fs-read', id: 11, path: '/a.bin', intent: 'edit' }));
    const error = await waitForFs(messages, 11, 'fs-error');
    expect(error).toMatchObject({ code: 'SFTP_TOO_LARGE' });
  });

  it('uses the transfer cap for download intent', async () => {
    const strictFake = new FakeSshConnector();
    strictFake.fsTree.seed({ '/a.bin': Buffer.alloc(100, 1) });
    const harness = await buildHarness({
      sshFsMaxEdit: 64,
      sshFsMaxTransfer: 200 * 1024 * 1024,
      sshConnector: strictFake,
    });
    harnesses.push(harness);
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'fs-read', id: 12, path: '/a.bin', intent: 'download' }));
    const message = await messages.nextMatching(2000, message => {
      const body = JSON.parse(message.data.toString('utf8')) as Record<string, unknown>;
      return body.id === 12 && (body.type === 'fs-read-meta' || body.type === 'fs-error');
    });
    expect(JSON.parse(message.data.toString('utf8')).type).toBe('fs-read-meta');
  });

  // ---------- 写入 ----------

  it('writes a multi-chunk file and acknowledges chunks', async () => {
    const { socket, messages } = await openDefaultSession();
    const payload = Buffer.from(Array.from({ length: 100 }, (_, index) => index));
    socket.send(JSON.stringify({ type: 'fs-write-start', id: 20, path: '/new.txt', size: payload.length, intent: 'upload' }));
    socket.send(JSON.stringify({
      type: 'fs-write-chunk', id: 20, seq: 0,
      data: b64(payload.subarray(0, 60)),
    }));
    const firstAck = await waitForFs(messages, 20, 'fs-ack');
    expect((firstAck as { seq: number }).seq).toBe(0);
    await waitTick(20);
    socket.send(JSON.stringify({
      type: 'fs-write-chunk', id: 20, seq: 1,
      data: b64(payload.subarray(60)),
    }));
    const ok = await waitForFs(messages, 20, 'fs-ok');
    expect(ok.id).toBe(20);

    const node = fake.fsTree.resolve('/new.txt', true);
    expect(node?.type).toBe('file');
    expect((node as { content: Buffer }).content.equals(payload)).toBe(true);
  });

  it('creates an empty file when size is zero', async () => {
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-write-start', id: 21, path: '/empty.txt', size: 0, intent: 'upload' }));
    const ok = await waitForFs(messages, 21, 'fs-ok');
    expect(ok.id).toBe(21);
    const node = fake.fsTree.resolve('/empty.txt', true);
    expect(node?.type).toBe('file');
    expect((node as { content: Buffer }).content.length).toBe(0);
  });

  it('aborts the write when content exceeds the declared size', async () => {
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-write-start', id: 22, path: '/bad.txt', size: 10, intent: 'upload' }));
    socket.send(JSON.stringify({
      type: 'fs-write-chunk', id: 22, seq: 0,
      data: b64(Buffer.alloc(20, 9)),
    }));
    const error = await waitForFs(messages, 22, 'fs-error');
    expect(error).toMatchObject({ code: 'SFTP_TOO_LARGE' });
    // 写流尚未打开即被拒绝，远端不应产生文件
    expect(fake.fsTree.resolve('/bad.txt', true)).toBeUndefined();
  });

  it('rejects out-of-order chunks', async () => {
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-write-start', id: 23, path: '/bad2.txt', size: 100, intent: 'upload' }));
    socket.send(JSON.stringify({
      type: 'fs-write-chunk', id: 23, seq: 3,
      data: b64(Buffer.alloc(10, 1)),
    }));
    const error = await waitForFs(messages, 23, 'fs-error');
    expect(error).toMatchObject({ code: 'SFTP_FAILED' });
  });

  it('rejects a second write while another transfer is active', async () => {
    const { socket, messages } = await openDefaultSession();
    const seen: string[] = [];
    socket.on('message', (data: Buffer) => seen.push(data.toString('utf8')));
    socket.send(JSON.stringify({ type: 'fs-write-start', id: 30, path: '/first.txt', size: 50 * 1024, intent: 'upload' }));
    socket.send(JSON.stringify({
      type: 'fs-write-chunk', id: 30, seq: 0, data: b64(Buffer.alloc(48 * 1024, 1)),
    }));
    // 第一笔尚未完成时发起第二笔
    socket.send(JSON.stringify({ type: 'fs-write-start', id: 31, path: '/second.txt', size: 10, intent: 'upload' }));
    await new Promise(resolve => setTimeout(resolve, 400));
    console.log('SEEN2', JSON.stringify(seen.map(text => JSON.parse(text).type + ':' + (JSON.parse(text).id ?? ''))));
    const busy = seen.find(text => {
      const body = JSON.parse(text) as Record<string, unknown>;
      return body.type === 'fs-error' && body.id === 31;
    });
    expect(busy).toBeDefined();
    expect(seen.some(text => {
      const body = JSON.parse(text) as Record<string, unknown>;
      return body.type === 'fs-ack' && body.id === 30 && body.seq === 0;
    })).toBe(true);

    // 完成第一笔后可再次写入（chunk seq1 在服务端 ack seq0 之后到达，顺序仍合法）
    socket.send(JSON.stringify({
      type: 'fs-write-chunk', id: 30, seq: 1, data: b64(Buffer.alloc(2 * 1024, 2)),
    }));
    const ok = await waitForFs(messages, 30, 'fs-ok');
    expect(ok.id).toBe(30);
    socket.send(JSON.stringify({ type: 'fs-write-start', id: 32, path: '/second.txt', size: 10, intent: 'upload' }));
    socket.send(JSON.stringify({
      type: 'fs-write-chunk', id: 32, seq: 0, data: b64(Buffer.alloc(10, 3)),
    }));
    const ok2 = await waitForFs(messages, 32, 'fs-ok');
    expect(ok2.id).toBe(32);
  });

  // ---------- 简单操作 ----------

  it('mkdir / touch / rm work as expected', async () => {
    const { socket, messages } = await openDefaultSession();
    fake.fsTree.seed({ '/work/a.txt': 'keep' });

    socket.send(JSON.stringify({ type: 'fs-mkdir', id: 40, path: '/work/new-dir' }));
    expect((await waitForFs(messages, 40, 'fs-ok')).id).toBe(40);
    expect(fake.fsTree.resolve('/work/new-dir')?.type).toBe('dir');

    socket.send(JSON.stringify({ type: 'fs-touch', id: 41, path: '/work/new-dir/f.txt' }));
    expect((await waitForFs(messages, 41, 'fs-ok')).id).toBe(41);
    const created = fake.fsTree.resolve('/work/new-dir/f.txt', true);
    expect((created as { content: Buffer }).content.length).toBe(0);

    // touch 已存在文件不截断
    socket.send(JSON.stringify({ type: 'fs-touch', id: 42, path: '/work/a.txt' }));
    expect((await waitForFs(messages, 42, 'fs-ok')).id).toBe(42);
    expect((fake.fsTree.resolve('/work/a.txt', true) as { content: Buffer }).content.toString()).toBe('keep');

    socket.send(JSON.stringify({ type: 'fs-rm', id: 43, path: '/work/new-dir', recursive: false }));
    const notEmpty = await waitForFs(messages, 43, 'fs-error');
    expect(notEmpty).toMatchObject({ code: 'SFTP_FAILED' });

    socket.send(JSON.stringify({ type: 'fs-rm', id: 44, path: '/work/new-dir', recursive: true }));
    expect((await waitForFs(messages, 44, 'fs-ok')).id).toBe(44);
    expect(fake.fsTree.resolve('/work/new-dir')).toBeUndefined();
  });

  it('renames files and refuses to overwrite', async () => {
    fake.fsTree.seed({ '/a.txt': 'a', '/b.txt': 'b' });
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-rename', id: 50, from: '/a.txt', to: '/c.txt' }));
    expect((await waitForFs(messages, 50, 'fs-ok')).id).toBe(50);
    expect(fake.fsTree.resolve('/a.txt')).toBeUndefined();
    expect(fake.fsTree.resolve('/c.txt', true)?.type).toBe('file');

    socket.send(JSON.stringify({ type: 'fs-rename', id: 51, from: '/c.txt', to: '/b.txt' }));
    const error = await waitForFs(messages, 51, 'fs-error');
    expect(error).toMatchObject({ code: 'SFTP_FAILED' });
  });

  // ---------- 生命周期 ----------

  it('keeps the session alive while fs ops keep arriving', async () => {
    const harness = await buildHarness({ sshIdleMs: 50 });
    const { socket, messages } = await openSession(harness);
    // 以 25ms 间隔持续发起 fs 请求，跨越 idle 定时器（1s）检查点
    for (let id = 100; id < 160; id += 1) {
      socket.send(JSON.stringify({ type: 'fs-list', id, path: '/' }));
      const list = await waitForFs(messages, id, 'fs-list', 2000);
      expect(list.type).toBe('fs-list');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  });

  it('aborts an in-flight read when the socket closes', async () => {
    const destroyedBefore = fake.readsDestroyed;
    const bigContent = Buffer.alloc(512 * 1024, 3);
    fake.fsTree.seed({ '/big.bin': bigContent });
    fake.readTickMs = 5;
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'fs-read', id: 60, path: '/big.bin', intent: 'download' }));
    const meta = await waitForFs(messages, 60, 'fs-read-meta');
    void meta;
    const firstChunk = await messages.next(2000);
    expect(firstChunk.isBinary).toBe(false);
    // 发送取消：网关应销毁读流（会话关闭时走 abortAll，同样销毁）
    socket.send(JSON.stringify({ type: 'fs-cancel', id: 60 }));
    const error = await waitForFs(messages, 60, 'fs-error');
    expect(error).toMatchObject({ code: 'SFTP_FAILED' });
    expect(fake.readsDestroyed).toBeGreaterThan(destroyedBefore);
  });

  it('still drops oversized non-fs control frames', async () => {
    const { socket, messages } = await openDefaultSession();
    socket.send(JSON.stringify({ type: 'resize', cols: 999, rows: 999, junk: 'x'.repeat(8192) }));
    socket.send(JSON.stringify({ type: 'ping', t: 1 }));
    const pong = await messages.nextMatching(1500, message => {
      try {
        return JSON.parse(message.data.toString('utf8')).type === 'pong';
      } catch {
        return false;
      }
    });
    expect(JSON.parse(pong.data.toString('utf8')).t).toBe(1);
  });
});

function testConfig(dir: string, overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    dbPath: join(dir, 'dock.sqlite'),
    adminSecret: 'admin-secret-12345678901234567890',
    apiToken: 'api-token-12345678901234567890',
    dataKey: 'data-key-12345678901234567890123456789012',
    sessionDays: 30,
    historyLimit: 100,
    cookieSecure: false,
    trustProxy: false,
    webDist: join(dir, 'web'),
    sshEnabled: true,
    sshMaxSessions: 8,
    sshMaxPerServer: 2,
    sshIdleMs: 30 * 60_000,
    sshTicketTtlMs: 30_000,
    sshFsEnabled: true,
    sshFsMaxEdit: 2 * 1024 * 1024,
    sshFsMaxTransfer: 200 * 1024 * 1024,
    ...overrides,
  };
}
