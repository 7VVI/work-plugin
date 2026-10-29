import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp, type DockApp } from '../src/app';
import type { ServerConfig } from '../src/config';
import {
  emptySnapshotData,
  emptyTombstones,
  MAX_NOTE_CONTENT,
  type NoteAssetRec,
  type NoteBookRec,
  type NoteRec,
  type SnapshotData,
  type SyncPushRequest,
  type SystemRec,
} from '@protocol/index';

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

function system(id: string, updatedAt = Date.now(), patch: Partial<SystemRec> = {}): SystemRec {
  return {
    id,
    name: id,
    url: `https://${id}.example.com`,
    environment: 'development',
    favorite: false,
    sort: 0,
    createdAt: updatedAt,
    updatedAt,
    tagIds: [],
    ...patch,
  };
}

function noteBook(id: string, updatedAt = Date.now(), patch: Partial<NoteBookRec> = {}): NoteBookRec {
  return {
    id,
    name: id,
    sortOrder: 0,
    createdAt: updatedAt,
    updatedAt,
    ...patch,
  };
}

function note(id: string, notebookId: string, updatedAt = Date.now(), patch: Partial<NoteRec> = {}): NoteRec {
  return {
    id,
    notebookId,
    title: id,
    content: `# ${id}`,
    sortOrder: 0,
    createdAt: updatedAt,
    updatedAt,
    ...patch,
  };
}

function noteAsset(id: string, updatedAt = Date.now(), patch: Partial<NoteAssetRec> = {}): NoteAssetRec {
  return {
    id,
    mime: 'image/png',
    size: 3,
    hash: 'a'.repeat(64),
    data: 'AAAA',
    createdAt: updatedAt,
    updatedAt,
    ...patch,
  };
}

function pushBody(data: Partial<SnapshotData>, tombstones = emptyTombstones(), baseRevision = 0): SyncPushRequest {  return {
    protocol: 1,
    clientId: 'client-1',
    baseRevision,
    clientTime: Date.now(),
    snapshot: {
      schemaVersion: 1,
      generatedAt: Date.now(),
      data: { ...emptySnapshotData(), ...data },
    },
    tombstones,
  };
}

describe('dock cloud server', () => {
  let dir: string;
  let config: ServerConfig;
  let dock: DockApp;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'dock-cloud-'));
    config = testConfig(dir);
    dock = await buildApp(config);
  });

  afterEach(async () => {
    await dock.app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function login(): Promise<string> {
    const response = await dock.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { secret: config.adminSecret },
    });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies[0];
    return `${cookie.name}=${cookie.value}`;
  }

  async function push(payload: SyncPushRequest) {
    return dock.app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: { authorization: `Bearer ${config.apiToken}` },
      payload,
    });
  }

  it('exposes a public health endpoint', async () => {
    const response = await dock.app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().ok).toBe(true);
  });

  it('logs in, validates the cookie session and enforces CSRF for mutations', async () => {
    const cookie = await login();
    const session = await dock.app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json().authenticated).toBe(true);
    expect(session.json().sessionDays).toBe(30);

    const missingCsrf = await dock.app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie },
      payload: { sessionDays: 10 },
    });
    expect(missingCsrf.statusCode).toBe(403);

    const updated = await dock.app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie, 'x-dock-csrf': '1' },
      payload: { sessionDays: 10 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().sessionDays).toBe(10);
  });

  it('rejects wrong secrets and rate limits repeated failures', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await dock.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { secret: 'wrong-secret' },
      });
      expect(response.statusCode).toBe(401);
    }
    const blocked = await dock.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { secret: config.adminSecret },
    });
    expect(blocked.statusCode).toBe(429);
  });

  it('merges pushes idempotently, bumps revision and applies tombstones', async () => {
    const now = Date.now();
    const first = await push(pushBody({ systems: [system('s1', now)] }));
    expect(first.statusCode).toBe(200);
    expect(first.json().revision).toBe(1);
    expect(first.json().snapshot.data.systems).toHaveLength(1);

    const unchanged = await push(pushBody({ systems: [system('s1', now)] }, emptyTombstones(), 1));
    expect(unchanged.json().revision).toBe(1);

    const updatedAt = now + 1000;
    const updated = await push(pushBody({
      systems: [system('s1', updatedAt, { name: 'updated' })],
    }, emptyTombstones(), 1));
    expect(updated.json().revision).toBe(2);
    expect(updated.json().snapshot.data.systems[0].name).toBe('updated');

    const tombstones = emptyTombstones();
    tombstones.systems.s1 = updatedAt + 10;
    const deleted = await push(pushBody({}, tombstones, 2));
    expect(deleted.json().revision).toBe(3);
    expect(deleted.json().snapshot.data.systems).toHaveLength(0);
    expect(deleted.json().tombstones.systems.s1).toBe(updatedAt + 10);
  });

  it('syncs notes and remains compatible with old clients that omit note tables', async () => {
    const now = Date.now();
    const first = await push(pushBody({
      noteBooks: [noteBook('b1', now)],
      notes: [note('n1', 'b1', now, { title: '标题', content: '# 正文' })],
    }));
    expect(first.statusCode).toBe(200);
    expect(first.json().snapshot.data.noteBooks).toHaveLength(1);
    expect(first.json().snapshot.data.notes).toHaveLength(1);
    expect(first.json().snapshot.data.notes[0].content).toBe('# 正文');

    const history = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(history.json().versions[0].counts).toMatchObject({ noteBooks: 1, notes: 1 });
    const detail = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history/1',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(detail.json().snapshot.data.notes[0].content).toBe('# 正文');

    const oldPayload = pushBody({ systems: [system('s1', now)] }, emptyTombstones(), 1) as any;
    delete oldPayload.snapshot.data.noteBooks;
    delete oldPayload.snapshot.data.notes;
    delete oldPayload.tombstones.noteBooks;
    delete oldPayload.tombstones.notes;
    const oldResponse = await push(oldPayload);
    expect(oldResponse.statusCode).toBe(200);
    expect(oldResponse.json().snapshot.data.noteBooks).toHaveLength(1);
    expect(oldResponse.json().snapshot.data.notes).toHaveLength(1);
  });

  it('syncs note image assets and rejects malformed ones', async () => {
    const now = Date.now();
    const ok = await push(pushBody({ noteAssets: [noteAsset('a1', now)] }));
    expect(ok.statusCode).toBe(200);
    expect(ok.json().snapshot.data.noteAssets).toHaveLength(1);
    expect(ok.json().snapshot.data.noteAssets[0].data).toBe('AAAA');

    const badHash = await push(pushBody({ noteAssets: [noteAsset('a2', now, { hash: 'not-a-hash' })] }));
    expect(badHash.statusCode).toBe(400);

    const badSize = await push(pushBody({ noteAssets: [noteAsset('a3', now, { size: 64 * 1024 * 1024 })] }));
    expect(badSize.statusCode).toBe(400);
  });

  it('rejects note content beyond the per-note or total limit', async () => {    const now = Date.now();
    const oversized = await push(pushBody({
      noteBooks: [noteBook('b1', now)],
      notes: [note('n1', 'b1', now, { content: 'x'.repeat(MAX_NOTE_CONTENT + 1) })],
    }));
    expect(oversized.statusCode).toBe(400);

    const notes = Array.from({ length: 25 }, (_, i) => note(`n${i}`, 'b1', now, {
      content: 'x'.repeat(MAX_NOTE_CONTENT),
    }));
    const tooLarge = await push(pushBody({
      noteBooks: [noteBook('b1', now)],
      notes,
    }));
    expect(tooLarge.statusCode).toBe(400);
  }, 20_000);

  it('records a version for every change and serves history details', async () => {
    const now = Date.now();
    const first = pushBody({ systems: [system('s1', now)] });
    first.note = '初始同步';
    await push(first);

    await push(pushBody({ systems: [system('s1', now)] }, emptyTombstones(), 1));

    const update = pushBody({
      systems: [system('s1', now + 1000, { name: 'updated' })],
    }, emptyTombstones(), 1);
    update.note = '调整系统';
    await push(update);

    const tombstones = emptyTombstones();
    tombstones.systems.s1 = now + 1010;
    const remove = pushBody({}, tombstones, 2);
    remove.note = '删除系统';
    await push(remove);

    const history = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(history.statusCode).toBe(200);
    const versions = history.json().versions as Array<{
      revision: number;
      note?: string;
      changes: { added: number; updated: number; deleted: number };
      counts: { systems: number };
    }>;
    expect(versions.map(version => version.revision)).toEqual([3, 2, 1]);
    expect(versions[0]).toMatchObject({ note: '删除系统', changes: { deleted: 1 }, counts: { systems: 0 } });
    expect(versions[1]).toMatchObject({ note: '调整系统', changes: { updated: 1 }, counts: { systems: 1 } });
    expect(versions[2]).toMatchObject({ note: '初始同步', changes: { added: 1 }, counts: { systems: 1 } });

    const firstPage = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history?limit=2',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(firstPage.json().versions.map((version: { revision: number }) => version.revision)).toEqual([3, 2]);

    const olderPage = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history?limit=2&before=2',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(olderPage.json().versions.map((version: { revision: number }) => version.revision)).toEqual([1]);

    const detail = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history/2',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().note).toBe('调整系统');
    expect(detail.json().snapshot.data.systems[0].name).toBe('updated');
    expect(detail.json().tombstones.systems.s1).toBeUndefined();

    const missing = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history/99',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(missing.statusCode).toBe(404);

    const unauthorizedHistory = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history',
    });
    expect(unauthorizedHistory.statusCode).toBe(401);
  });

  it('prunes old versions to the configured history limit', async () => {
    await dock.app.close();
    dock = await buildApp(testConfig(dir, { historyLimit: 2 }));

    const now = Date.now();
    await push(pushBody({ systems: [system('s1', now)] }));
    await push(pushBody({ systems: [system('s1', now + 1000, { name: 'v2' })] }, emptyTombstones(), 1));
    await push(pushBody({ systems: [system('s1', now + 2000, { name: 'v3' })] }, emptyTombstones(), 2));

    const history = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().versions.map((version: { revision: number }) => version.revision)).toEqual([3, 2]);
  });

  it('backfills a baseline version when upgrading a database without history', async () => {
    const now = Date.now();
    await push(pushBody({ systems: [system('s1', now)] }));
    dock.db.prepare('DELETE FROM versions').run();
    await dock.app.close();

    dock = await buildApp(config);
    const history = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(history.statusCode).toBe(200);
    const versions = history.json().versions as Array<{ revision: number; note?: string; counts: { systems: number } }>;
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ revision: 1, note: '历史起点', counts: { systems: 1 } });

    const detail = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history/1',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().snapshot.data.systems).toHaveLength(1);
  });

  it('validates bearer auth and rejects encrypted payloads', async () => {
    const unauthorizedResponse = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/state',
      headers: { authorization: 'Bearer wrong' },
    });
    expect(unauthorizedResponse.statusCode).toBe(401);

    const payload = pushBody({
      accounts: [{
        id: 'a1',
        systemId: 's1',
        role: 'root',
        username: 'root',
        password: { __encrypted: true } as unknown as string,
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
    });
    const response = await push(payload);
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('INVALID_PAYLOAD');
  });

  it('does not store plaintext secrets in SQLite', async () => {
    const now = Date.now();
    await push(pushBody({
      systems: [system('s1', now, { name: 'PLAINTEXT-NAME-MARKER' })],
      accounts: [{
        id: 'a1',
        systemId: 's1',
        role: 'root',
        username: 'root',
        password: 'PLAINTEXT-PASSWORD-MARKER',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      }],
    }));

    const row = dock.db.prepare('SELECT payload FROM state WHERE id = 1').get() as { payload: Buffer };
    const encrypted = row.payload.toString('utf8');
    expect(encrypted).not.toContain('PLAINTEXT-NAME-MARKER');
    expect(encrypted).not.toContain('PLAINTEXT-PASSWORD-MARKER');
  });

  it('persists data across restarts', async () => {
    const now = Date.now();
    await push(pushBody({ systems: [system('s1', now, { name: 'persisted' })] }));
    await dock.app.close();

    dock = await buildApp(config);
    const response = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/state',
      headers: { authorization: `Bearer ${config.apiToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().snapshot.data.systems[0].name).toBe('persisted');
  });

  it('supports data key rotation and revokes sessions when the admin secret changes', async () => {
    const now = Date.now();
    await push(pushBody({
      systems: [system('s1', now)],
      noteBooks: [noteBook('b1', now)],
      notes: [note('n1', 'b1', now, { content: '# 保留' })],
    }));
    const cookie = await login();
    await dock.app.close();

    const rotated = testConfig(dir, {
      dataKey: 'new-data-key-123456789012345678901234567',
      dataKeyOld: config.dataKey,
    });
    dock = await buildApp(rotated);
    const state = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/state',
      headers: { authorization: `Bearer ${rotated.apiToken}` },
    });
    expect(state.statusCode).toBe(200);
    expect(state.json().snapshot.data.systems).toHaveLength(1);
    expect(state.json().snapshot.data.notes[0].content).toBe('# 保留');
    const history = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history/1',
      headers: { authorization: `Bearer ${rotated.apiToken}` },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().snapshot.data.systems).toHaveLength(1);
    expect(history.json().snapshot.data.notes[0].content).toBe('# 保留');
    await dock.app.close();

    const changedSecret = testConfig(dir, {
      dataKey: 'new-data-key-123456789012345678901234567',
      adminSecret: 'changed-admin-secret-123456789012345',
    });
    dock = await buildApp(changedSecret);
    const session = await dock.app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    });
    expect(session.statusCode).toBe(401);
    const historyAfterRotation = await dock.app.inject({
      method: 'GET',
      url: '/api/sync/history/1',
      headers: { authorization: `Bearer ${changedSecret.apiToken}` },
    });
    expect(historyAfterRotation.statusCode).toBe(200);
    expect(historyAfterRotation.json().snapshot.data.systems).toHaveLength(1);
  });
});
