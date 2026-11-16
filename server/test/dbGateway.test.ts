import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { MiddlewareRec } from '@protocol/index';
import { buildApp } from '../src/app';
import type { ServerConfig } from '../src/config';
import { FakeDbDriver } from './dbFake';
import { collector, type WsMessage } from './wsTest';

const middlewareRec: MiddlewareRec = {
  id: 'mw_1',
  type: 'postgresql',
  name: 'test-db',
  host: '10.0.0.9',
  port: 5432,
  database: 'app',
  username: 'app',
  password: 'super-secret',
  extra: { environment: 'development' },
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  tagIds: [],
};

interface Harness {
  fake: FakeDbDriver;
  app: FastifyInstance;
  dir: string;
}

function parseWs(message: WsMessage): Record<string, unknown> {
  return JSON.parse(message.data.toString('utf8')) as Record<string, unknown>;
}

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
    dbEnabled: true,
    dbMaxSessions: 8,
    dbMaxPerMiddleware: 2,
    dbIdleMs: 30 * 60_000,
    dbTicketTtlMs: 30_000,
    dbConnectTimeoutMs: 8_000,
    dbQueryTimeoutMs: 30_000,
    dbMaxRows: 500,
    dbMaxResultBytes: 2 * 1024 * 1024,
    dbMaxTextCellBytes: 64 * 1024,
    dbSqliteRoots: [join(dir, 'sqlite')],
    dbReadOnly: false,
    ...overrides,
  };
}

describe('db workbench gateway', () => {
  const harnesses: Harness[] = [];

  afterEach(async () => {
    for (const harness of harnesses.splice(0)) {
      await harness.app.close();
      rmSync(harness.dir, { recursive: true, force: true });
    }
  });

  async function buildHarness(
    overrides: Partial<ServerConfig> = {},
    fake = new FakeDbDriver(),
  ): Promise<Harness> {
    const dir = mkdtempSync(join(tmpdir(), 'dock-db-'));
    const built = await buildApp(testConfig(dir, overrides), { dbDriverFactory: () => fake });
    built.store.getState().snapshot.data.middlewares.push({ ...middlewareRec });
    built.store.getState().snapshot.data.middlewares.push({
      ...middlewareRec,
      id: 'mw_redis',
      type: 'redis',
      name: 'test-redis',
      port: 6379,
    });
    await built.app.ready();
    const harness: Harness = { fake, app: built.app, dir };
    harnesses.push(harness);
    return harness;
  }

  async function issue(harness: Harness, middlewareId = middlewareRec.id) {
    return harness.app.inject({
      method: 'POST',
      url: '/api/db/ticket',
      headers: {
        authorization: 'Bearer api-token-12345678901234567890',
        origin: 'chrome-extension://dock-test',
      },
      payload: { middlewareId },
    });
  }

  async function openSession(harness: Harness) {
    const response = await issue(harness);
    expect(response.statusCode).toBe(200);
    const { ticket } = response.json() as { ticket: string };
    let socket!: WebSocket;
    let messages!: ReturnType<typeof collector>;
    await harness.app.injectWS(`/api/db/ws?ticket=${ticket}`, {
      headers: { origin: 'chrome-extension://dock-test' },
    }, { onOpen: ws => { socket = ws; messages = collector(ws); } });
    const ready = await messages.next(2000);
    const body = parseWs(ready);
    expect(body.type).toBe('db-ready');
    return { socket, messages, ready: body };
  }

  async function waitFor(
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

  it('issues a ticket only for known middleware', async () => {
    const harness = await buildHarness();
    const ok = await issue(harness);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ protocol: 1 });

    const missing = await issue(harness, 'mw_missing');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: 'DB_NOT_FOUND' });
  });

  it('rejects a ticket for unsupported middleware types', async () => {
    const harness = await buildHarness();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/db/ticket',
      headers: { authorization: 'Bearer api-token-12345678901234567890' },
      payload: { middlewareId: 'mw_redis' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'DB_TYPE_UNSUPPORTED' });
  });

  it('takes connection parameters from the snapshot only', async () => {
    const harness = await buildHarness();
    const { messages } = await openSession(harness);
    expect(harness.fake.behavior.lastTarget).toMatchObject({
      dialect: 'postgres',
      host: '10.0.0.9',
      port: 5432,
      database: 'app',
      username: 'app',
    });
    void messages;
  });

  it('returns query results as meta, chunk and end', async () => {
    const harness = await buildHarness();
    harness.fake.behavior.rowCount = 3;
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'db-query', id: 7, sql: 'SELECT * FROM users' }));

    const meta = await waitFor(messages, 7, 'db-result-meta');
    expect(meta).toMatchObject({ totalRows: 3, elapsedMs: 1 });
    const chunk = await waitFor(messages, 7, 'db-result-chunk');
    expect((chunk.rows as unknown[]).length).toBe(3);
    const end = await waitFor(messages, 7, 'db-result-end');
    expect(end).toMatchObject({ rowCount: 3, truncated: false });
  });

  it('passes the requested database to the session', async () => {
    const harness = await buildHarness();
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'db-query', id: 8, sql: 'SELECT * FROM users', database: 'cors_3.0.0' }));

    await waitFor(messages, 8, 'db-result-end');
    expect(harness.fake.behavior.lastOptions?.database).toBe('cors_3.0.0');
  });

  it('applies a cell update and reports affected rows', async () => {
    const harness = await buildHarness();
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({
      type: 'db-update',
      id: 41,
      update: {
        schema: 'public',
        table: 'users',
        column: 'name',
        value: '张三',
        keys: [{ column: 'id', value: '3' }],
      },
    }));

    const result = await waitFor(messages, 41, 'db-update-result');
    expect(result).toMatchObject({ affectedRows: 1 });
    expect(harness.fake.behavior.updated).toBe(true);
  });

  it('rejects a cell update without keys', async () => {
    const harness = await buildHarness();
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({
      type: 'db-update',
      id: 42,
      update: { table: 'users', column: 'name', value: 'x', keys: [] },
    }));

    const failure = await waitFor(messages, 42, 'db-fail');
    expect(failure).toMatchObject({ code: 'DB_FAILED' });
    expect(harness.fake.behavior.updated).toBeUndefined();
  });

  it('returns the definition of a stored procedure', async () => {
    const harness = await buildHarness();
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({
      type: 'db-routine',
      id: 51,
      kind: 'procedures',
      schema: 'cors_3.0.0',
      name: 'demo_proc',
    }));

    const result = await waitFor(messages, 51, 'db-routine-result');
    expect(result).toMatchObject({ kind: 'procedures', name: 'demo_proc' });
    expect(String(result.definition)).toContain('CREATE PROCEDURE');
    expect(harness.fake.behavior.lastRoutine).toMatchObject({ kind: 'procedures', schema: 'cors_3.0.0', name: 'demo_proc' });
  });

  it('rejects a routine request with an invalid kind', async () => {
    const harness = await buildHarness();
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'db-routine', id: 52, kind: 'tables', name: 'users' }));

    const failure = await waitFor(messages, 52, 'db-fail');
    expect(failure).toMatchObject({ code: 'DB_FAILED' });
  });

  it('rejects multi statement SQL', async () => {    const harness = await buildHarness();
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'db-query', id: 9, sql: 'SELECT 1; DROP TABLE users' }));
    const failure = await waitFor(messages, 9, 'db-fail');
    expect(failure).toMatchObject({ code: 'DB_MULTI_STATEMENT' });
  });

  it('never leaks the password in error payloads', async () => {
    const harness = await buildHarness();
    harness.fake.behavior.queryError = new Error('connect failed password=super-secret');
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'db-query', id: 11, sql: 'SELECT 1' }));
    const failure = await waitFor(messages, 11, 'db-fail');
    const text = JSON.stringify(failure);
    expect(text).not.toContain('super-secret');
  });

  it('lists objects and table metadata', async () => {
    const harness = await buildHarness();
    harness.fake.behavior.objects = { tables: [{ schema: 'public', name: 'users' }] };
    const { socket, messages } = await openSession(harness);

    socket.send(JSON.stringify({ type: 'db-list', id: 21, kind: 'tables' }));
    const list = await waitFor(messages, 21, 'db-list');
    expect(list.items).toEqual([{ schema: 'public', name: 'users' }]);

    socket.send(JSON.stringify({ type: 'db-describe', id: 22, schema: 'public', table: 'users' }));
    const describe = await waitFor(messages, 22, 'db-describe');
    expect(describe.columns).toEqual([{ name: 'id', dataType: 'int', ordinal: 1, primary: true }]);
  });

  it('rejects a ticket issued for another scope', async () => {
    const harness = await buildHarness();
    const response = await issue(harness);
    const { ticket } = response.json() as { ticket: string };
    await expect(harness.app.injectWS(`/api/ssh/ws?ticket=${ticket}`, {
      headers: { origin: 'chrome-extension://dock-test' },
    })).rejects.toThrow();
  });

  it('reports nextOffset when the result is truncated', async () => {
    const harness = await buildHarness({ dbMaxRows: 10 });
    harness.fake.behavior.totalRows = 1000;
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'db-query', id: 31, sql: 'SELECT * FROM users' }));

    await waitFor(messages, 31, 'db-result-meta');
    await waitFor(messages, 31, 'db-result-chunk');
    const end = await waitFor(messages, 31, 'db-result-end');
    expect(end).toMatchObject({ rowCount: 10, truncated: true, nextOffset: 10 });
  });

  it('honours the requested offset', async () => {
    const harness = await buildHarness({ dbMaxRows: 10 });
    harness.fake.behavior.totalRows = 1000;
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'db-query', id: 32, sql: 'SELECT * FROM users', offset: 20 }));

    await waitFor(messages, 32, 'db-result-meta');
    const chunk = await waitFor(messages, 32, 'db-result-chunk');
    expect((chunk.rows as unknown[][])[0][0]).toBe(20);
  });

  it('aborts the session when a query is cancelled', async () => {
    const harness = await buildHarness();
    const { socket, messages } = await openSession(harness);
    socket.send(JSON.stringify({ type: 'db-cancel', id: 41 }));

    const error = await messages.nextMatching(2000, message => {
      const body = JSON.parse(message.data.toString('utf8')) as Record<string, unknown>;
      return body.type === 'db-error';
    });
    expect(JSON.parse(error.data.toString('utf8'))).toMatchObject({ code: 'DB_CANCELED' });
    expect(harness.fake.behavior.aborted).toBe(true);
  });

  it('buffers requests that arrive before the connection is ready', async () => {
    const fake = new FakeDbDriver();
    fake.behavior.connectDelayMs = 400;
    const harness = await buildHarness({}, fake);
    const response = await issue(harness);
    const { ticket } = response.json() as { ticket: string };

    let socket!: WebSocket;
    let messages!: ReturnType<typeof collector>;
    await harness.app.injectWS(`/api/db/ws?ticket=${ticket}`, {
      headers: { origin: 'chrome-extension://dock-test' },
    }, { onOpen: ws => { socket = ws; messages = collector(ws); } });

    // 连接还没建好就发请求
    socket.send(JSON.stringify({ type: 'db-query', id: 51, sql: 'SELECT 1' }));

    const end = await messages.nextMatching(4000, message => {
      const body = JSON.parse(message.data.toString('utf8')) as Record<string, unknown>;
      return body.type === 'db-result-end' && body.id === 51;
    });
    expect(JSON.parse(end.data.toString('utf8'))).toMatchObject({ id: 51, rowCount: 2 });
  });
});
