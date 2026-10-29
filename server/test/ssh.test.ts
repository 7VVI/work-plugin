import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ServerRec } from '@protocol/index';
import { buildApp } from '../src/app';
import type { ServerConfig } from '../src/config';
import { SshTicketStore } from '../src/ssh/ticketStore';
import { FakeSshConnector } from './sshFake';

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
    ...overrides,
  };
}

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

interface Message {
  data: Buffer;
  isBinary: boolean;
}

function collector(socket: WebSocket) {
  const messages: Message[] = [];
  const waiters: Array<(message: Message) => void> = [];
  socket.on('message', (data: Buffer, isBinary: boolean) => {
    const message = { data, isBinary };
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else messages.push(message);
  });
  return {
    next(timeoutMs = 1500): Promise<Message> {
      const queued = messages.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out waiting for websocket message')), timeoutMs);
        waiters.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
    text(message: Message): string {
      return message.data.toString('utf8');
    },
  };
}

async function waitTick(ms = 30): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

describe('ssh ticket endpoint', () => {
  let dir: string;
  let app: FastifyInstance;
  let fake: FakeSshConnector;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'dock-ssh-'));
    fake = new FakeSshConnector();
    const built = await buildApp(testConfig(dir), { sshConnector: fake });
    app = built.app;
    built.store.getState().snapshot.data.servers.push({ ...serverRec });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function issue(headers: Record<string, string> = {}, serverId = serverRec.id) {
    return app.inject({
      method: 'POST',
      url: '/api/ssh/ticket',
      headers: {
        authorization: 'Bearer api-token-12345678901234567890',
        origin: 'chrome-extension://dock-test',
        ...headers,
      },
      payload: { serverId },
    });
  }

  it('issues a short-lived ticket for a bearer client', async () => {
    const response = await issue();
    expect(response.statusCode).toBe(200);
    const body = response.json() as { ticket: string; expiresAt: number; protocol: number };
    expect(body.ticket).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    expect(body.protocol).toBe(1);
  });

  it('rejects unauthenticated ticket requests', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/ssh/ticket',
      payload: { serverId: serverRec.id },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns SERVER_NOT_FOUND for an unknown server', async () => {
    const response = await issue({}, 'srv_missing');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'SERVER_NOT_FOUND' });
  });

  it('rejects ticket requests when SSH is disabled', async () => {
    const disabled = await buildApp(testConfig(dir, { sshEnabled: false }), { sshConnector: fake });
    disabled.store.getState().snapshot.data.servers.push({ ...serverRec });
    await disabled.app.ready();
    try {
      const response = await disabled.app.inject({
        method: 'POST',
        url: '/api/ssh/ticket',
        headers: { authorization: 'Bearer api-token-12345678901234567890' },
        payload: { serverId: serverRec.id },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: 'SSH_DISABLED' });
    } finally {
      await disabled.app.close();
    }
  });

  it('requires CSRF for cookie-authenticated tickets', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { secret: 'admin-secret-12345678901234567890' },
    });
    const setCookie = login.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookie).toContain('dock_sid=');
    const cookieHeader = cookie!.split(';')[0]!;

    const withoutCsrf = await app.inject({
      method: 'POST',
      url: '/api/ssh/ticket',
      headers: { cookie: cookieHeader },
      payload: { serverId: serverRec.id },
    });
    expect(withoutCsrf.statusCode).toBe(403);

    const withCsrf = await app.inject({
      method: 'POST',
      url: '/api/ssh/ticket',
      headers: { cookie: cookieHeader, 'x-dock-csrf': '1' },
      payload: { serverId: serverRec.id },
    });
    expect(withCsrf.statusCode).toBe(200);
  });

  it('opens a websocket and bridges input/output/resize/exit', async () => {
    const ticket = (await issue()).json().ticket as string;
    let messages!: ReturnType<typeof collector>;
    const socket = await app.injectWS(
      `/api/ssh/ws?ticket=${ticket}`,
      { headers: { origin: 'chrome-extension://dock-test' } },
      { onOpen: ws => { messages = collector(ws); } },
    );

    const ready = await messages.next();
    expect(ready.isBinary).toBe(false);
    const readyMessage = JSON.parse(messages.text(ready)) as {
      type: string;
      sessionId: string;
      fingerprint: string;
    };
    expect(readyMessage.type).toBe('ready');
    expect(readyMessage.fingerprint).toBe('SHA256:fake-fingerprint');
    expect(fake.targets[0]).toMatchObject({ host: '127.0.0.1', port: 22, username: 'root' });

    socket.send(Buffer.from('echo 中文\n'), { binary: true });
    await waitTick();
    expect(fake.writes[0]?.toString('utf8')).toBe('echo 中文\n');

    socket.send(JSON.stringify({ type: 'resize', cols: 132, rows: 43 }));
    await waitTick();
    expect(fake.resizes.at(-1)).toEqual({ cols: 132, rows: 43 });
    socket.send(JSON.stringify({ type: 'resize', cols: 1, rows: 9999 }));
    await waitTick();
    expect(fake.resizes.at(-1)).toEqual({ cols: 20, rows: 200 });

    fake.emitOutput('hello 终端');
    const output = await messages.next();
    expect(output.isBinary).toBe(true);
    expect(output.data.toString('utf8')).toBe('hello 终端');

    fake.emitExit(0, null);
    const exit = await messages.next();
    expect(JSON.parse(messages.text(exit))).toMatchObject({ type: 'exit', code: 0 });
    await waitTick();
    expect(fake.closed).toBeGreaterThan(0);
    socket.close();
  });

  it('consumes a ticket only once', async () => {
    const ticket = (await issue()).json().ticket as string;
    const socket = await app.injectWS(`/api/ssh/ws?ticket=${ticket}`, {
      headers: { origin: 'chrome-extension://dock-test' },
    });
    socket.close();
    await waitTick();
    await expect(app.injectWS(`/api/ssh/ws?ticket=${ticket}`, {
      headers: { origin: 'chrome-extension://dock-test' },
    })).rejects.toThrow(/401/);
  });

  it('rejects a websocket upgrade from a different origin', async () => {
    const ticket = (await issue({ origin: 'chrome-extension://origin-a' })).json().ticket as string;
    await expect(app.injectWS(`/api/ssh/ws?ticket=${ticket}`, {
      headers: { origin: 'chrome-extension://origin-b' },
    })).rejects.toThrow(/403/);
  });

  it('closes idle websocket sessions', async () => {
    const idleDir = mkdtempSync(join(tmpdir(), 'dock-ssh-idle-'));
    const idleFake = new FakeSshConnector();
    const idle = await buildApp(testConfig(idleDir, { sshIdleMs: 50 }), { sshConnector: idleFake });
    idle.store.getState().snapshot.data.servers.push({ ...serverRec });
    await idle.app.ready();
    try {
      const ticket = await idle.app.inject({
        method: 'POST',
        url: '/api/ssh/ticket',
        headers: { authorization: 'Bearer api-token-12345678901234567890', origin: 'chrome-extension://dock-test' },
        payload: { serverId: serverRec.id },
      });
      let messages!: ReturnType<typeof collector>;
      const socket = await idle.app.injectWS(
        `/api/ssh/ws?ticket=${ticket.json().ticket}`,
        { headers: { origin: 'chrome-extension://dock-test' } },
        { onOpen: ws => { messages = collector(ws); } },
      );
      await messages.next();
      const idleMessage = await messages.next(2500);
      expect(JSON.parse(messages.text(idleMessage))).toMatchObject({ type: 'error', code: 'SSH_IDLE_TIMEOUT' });
      socket.close();
    } finally {
      await idle.app.close();
      rmSync(idleDir, { recursive: true, force: true });
    }
  });

  it('enforces the global session limit', async () => {    const limitedDir = mkdtempSync(join(tmpdir(), 'dock-ssh-limit-'));
    const limitedFake = new FakeSshConnector();
    const limited = await buildApp(testConfig(limitedDir, { sshMaxSessions: 1 }), { sshConnector: limitedFake });
    limited.store.getState().snapshot.data.servers.push({ ...serverRec });
    await limited.app.ready();
    try {
      const first = await limited.app.inject({
        method: 'POST',
        url: '/api/ssh/ticket',
        headers: { authorization: 'Bearer api-token-12345678901234567890', origin: 'chrome-extension://dock-test' },
        payload: { serverId: serverRec.id },
      });
      const firstSocket = await limited.app.injectWS(
        `/api/ssh/ws?ticket=${first.json().ticket}`,
        { headers: { origin: 'chrome-extension://dock-test' } },
      );
      const firstMessages = collector(firstSocket);
      await firstMessages.next();

      const second = await limited.app.inject({
        method: 'POST',
        url: '/api/ssh/ticket',
        headers: { authorization: 'Bearer api-token-12345678901234567890', origin: 'chrome-extension://dock-test' },
        payload: { serverId: serverRec.id },
      });
      let secondMessages!: ReturnType<typeof collector>;
      const secondSocket = await limited.app.injectWS(
        `/api/ssh/ws?ticket=${second.json().ticket}`,
        { headers: { origin: 'chrome-extension://dock-test' } },
        { onOpen: ws => { secondMessages = collector(ws); } },
      );
      const message = await secondMessages.next();
      expect(JSON.parse(secondMessages.text(message))).toMatchObject({ type: 'error', code: 'SSH_SESSION_LIMIT' });
      firstSocket.close();
      secondSocket.close();
    } finally {
      await limited.app.close();
      rmSync(limitedDir, { recursive: true, force: true });
    }
  });
});

describe('SshTicketStore', () => {
  it('expires, is single-use and binds origin', () => {
    let now = 1_000;
    const store = new SshTicketStore({ ttlMs: 100, maxTickets: 10, maxPerMinute: 10, now: () => now });
    try {
      const first = store.issue('srv_1', 'bearer', 'chrome-extension://a', '10.0.0.1');
      expect(store.consume(first.ticket, 'chrome-extension://a')).toEqual({
        ok: true,
        serverId: 'srv_1',
        authKind: 'bearer',
      });
      expect(store.consume(first.ticket, 'chrome-extension://a')).toEqual({ ok: false, reason: 'invalid' });

      const second = store.issue('srv_1', 'bearer', 'chrome-extension://a', '10.0.0.1');
      expect(store.consume(second.ticket, 'chrome-extension://b')).toEqual({ ok: false, reason: 'origin' });

      const third = store.issue('srv_1', 'bearer', 'chrome-extension://a', '10.0.0.2');
      now += 500;
      expect(store.consume(third.ticket, 'chrome-extension://a')).toEqual({ ok: false, reason: 'expired' });
    } finally {
      store.close();
    }
  });

  it('rate limits ticket issuance per ip', () => {
    const store = new SshTicketStore({ ttlMs: 10_000, maxTickets: 100, maxPerMinute: 2, now: () => 1_000 });
    try {
      store.issue('srv_1', 'bearer', undefined, '10.0.0.1');
      store.issue('srv_1', 'bearer', undefined, '10.0.0.1');
      expect(() => store.issue('srv_1', 'bearer', undefined, '10.0.0.1')).toThrow(/Too many/);
      expect(() => store.issue('srv_1', 'bearer', undefined, '10.0.0.2')).not.toThrow();
    } finally {
      store.close();
    }
  });

  it('caps the number of pending tickets', () => {
    const store = new SshTicketStore({ ttlMs: 10_000, maxTickets: 1, now: () => 1_000 });
    try {
      store.issue('srv_1', 'bearer', 'chrome-extension://a', '10.0.0.1');
      expect(() => store.issue('srv_1', 'bearer', 'chrome-extension://a', '10.0.0.2')).toThrow();
    } finally {
      store.close();
    }
  });
});
