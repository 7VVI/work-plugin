import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { MiddlewareRec } from '@protocol/index';
import { buildApp } from '../src/app';
import type { ServerConfig } from '../src/config';
import { collector, type WsMessage } from './wsTest';

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

/** 用真实 SQLite 跑通「服务端 → 驱动 → 数据库」整条链路 */
describe('db workbench with a real sqlite file', () => {
  const harnesses: Array<{ app: FastifyInstance; dir: string }> = [];

  afterEach(async () => {
    for (const harness of harnesses.splice(0)) {
      await harness.app.close();
      rmSync(harness.dir, { recursive: true, force: true });
    }
  });

  it('lists tables, reads rows and runs write statements', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dock-db-sqlite-'));
    const sqliteDir = join(dir, 'sqlite');
    mkdirSync(sqliteDir, { recursive: true });
    const dbFile = join(sqliteDir, 'app.db');
    const seed = new Database(dbFile);
    seed.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
    seed.prepare('INSERT INTO users (name) VALUES (?)').run('alice');
    seed.prepare('INSERT INTO users (name) VALUES (?)').run('bob');
    seed.close();

    const built = await buildApp(testConfig(dir));
    const middleware: MiddlewareRec = {
      id: 'mw_sqlite',
      type: 'sqlite',
      name: 'app.db',
      host: '',
      port: 0,
      extra: { filePath: dbFile, environment: 'development' },
      favorite: false,
      createdAt: 1,
      updatedAt: 1,
      tagIds: [],
    };
    built.store.getState().snapshot.data.middlewares.push(middleware);
    await built.app.ready();
    harnesses.push({ app: built.app, dir });

    const ticketResponse = await built.app.inject({
      method: 'POST',
      url: '/api/db/ticket',
      headers: {
        authorization: 'Bearer api-token-12345678901234567890',
        origin: 'chrome-extension://dock-test',
      },
      payload: { middlewareId: 'mw_sqlite' },
    });
    expect(ticketResponse.statusCode).toBe(200);
    const { ticket } = ticketResponse.json() as { ticket: string };

    let socket!: WebSocket;
    let messages!: ReturnType<typeof collector>;
    await built.app.injectWS(`/api/db/ws?ticket=${ticket}`, {
      headers: { origin: 'chrome-extension://dock-test' },
    }, { onOpen: ws => { socket = ws; messages = collector(ws); } });

    const ready = parseWs(await messages.next(3000));
    expect(ready.type).toBe('db-ready');
    expect(ready.dialect).toBe('sqlite');

    socket.send(JSON.stringify({ type: 'db-list', id: 1, kind: 'tables' }));
    const list = await messages.nextMatching(3000, message => {
      const body = parseWs(message);
      return body.type === 'db-list' && body.id === 1;
    });
    const listBody = parseWs(list);
    expect((listBody.items as Array<{ name: string }>).map(item => item.name)).toContain('users');

    socket.send(JSON.stringify({ type: 'db-query', id: 2, sql: 'SELECT id, name FROM users ORDER BY id' }));
    await messages.nextMatching(3000, message => {
      const body = parseWs(message);
      return body.type === 'db-result-meta' && body.id === 2;
    });
    const chunk = parseWs(await messages.nextMatching(3000, message => {
      const body = parseWs(message);
      return body.type === 'db-result-chunk' && body.id === 2;
    }));
    expect(chunk.rows).toEqual([[1, 'alice'], [2, 'bob']]);

    socket.send(JSON.stringify({ type: 'db-query', id: 3, sql: "INSERT INTO users (name) VALUES ('carol')" }));
    await messages.nextMatching(3000, message => {
      const body = parseWs(message);
      return body.type === 'db-result-end' && body.id === 3;
    });

    socket.send(JSON.stringify({ type: 'db-query', id: 4, sql: 'SELECT COUNT(*) AS total FROM users' }));
    await messages.nextMatching(3000, message => {
      const body = parseWs(message);
      return body.type === 'db-result-meta' && body.id === 4;
    });
    const countChunk = parseWs(await messages.nextMatching(3000, message => {
      const body = parseWs(message);
      return body.type === 'db-result-chunk' && body.id === 4;
    }));
    expect(countChunk.rows).toEqual([[3]]);
  });
});
