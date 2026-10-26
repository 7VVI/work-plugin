import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { cryptoSession } from '../../../src/shared/crypto/session';
import { cryptoService } from '../../../src/shared/services/cryptoService';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import { VaultLockedError } from '../../../src/shared/sync/snapshotBuilder';
import { pushToCloud, overwriteCloud, restoreFromCloud } from '../../../src/shared/sync/syncService';
import {
  clearCloudConfig,
  normalizeEndpoint,
  readBaseline,
  readCloudConfig,
  readStatus,
  writeCloudConfig,
} from '../../../src/shared/sync/syncStorage';
import { clearDirty, readDirty } from '../../../src/shared/sync/dirtyTracker';
import {
  emptySnapshotData,
  emptyTombstones,
  mergeServerState,
  type ServerState,
  type SyncPushRequest,
  type SystemRec,
} from '../../../shared/protocol/index';

const BASE = 'http://localhost:9999';

function remoteSystem(id: string, updatedAt = Date.now()): SystemRec {
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
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('syncService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    cryptoSession.lock();
    await clearCloudConfig();
    await db.deletions.clear();
    await clearDirty();
    await writeCloudConfig({
      enabled: true,
      endpoint: BASE,
      token: { __encrypted: false, value: 'api-token' },
      clientId: 'client-test',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates cloud endpoints', () => {
    expect(normalizeEndpoint('https://dock.example.com/')).toBe('https://dock.example.com');
    expect(normalizeEndpoint('http://localhost:8099/')).toBe('http://localhost:8099');
    expect(normalizeEndpoint('http://192.168.1.50:8080/')).toBe('http://192.168.1.50:8080');
    expect(normalizeEndpoint('192.168.1.50:8080')).toBe('http://192.168.1.50:8080');
    expect(normalizeEndpoint('http://10.0.0.5:8099/dock/')).toBe('http://10.0.0.5:8099/dock');
    expect(normalizeEndpoint('https://192.168.1.50:8080')).toBe('https://192.168.1.50:8080');
    expect(normalizeEndpoint('http://[fd00::1]:8080')).toBe('http://[fd00::1]:8080');
    expect(() => normalizeEndpoint('http://dock.example.com')).toThrow(/HTTPS/);
    expect(() => normalizeEndpoint('https://dock.example.com/?x=1')).toThrow(/查询参数/);
  });

  it('pushes local data, applies the merged response and clears dirty state', async () => {
    const systemId = await systemRepo.create({
      name: 'Local', url: 'https://local.example.com', environment: 'development',
      favorite: false, sort: 0,
    });
    await clearDirty();

    let pushedBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true });
      if (url.endsWith('/api/sync/push')) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        pushedBody = body;
        const incoming = body as unknown as SyncPushRequest;
        const snapshot = incoming.snapshot;
        snapshot.data.systems.push(remoteSystem('remote-system'));
        const current: ServerState = {
          revision: 0,
          snapshot: { schemaVersion: 1, generatedAt: 0, data: emptySnapshotData() },
          tombstones: emptyTombstones(),
        };
        const merged = mergeServerState(current, incoming, Date.now());
        return jsonResponse({
          revision: 1,
          serverTime: Date.now(),
          reset: false,
          snapshot: merged.state.snapshot,
          tombstones: merged.state.tombstones,
          stats: merged.stats,
        });
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    });

    const result = await pushToCloud();
    expect(result.response.revision).toBe(1);
    expect(pushedBody).not.toBeNull();
    expect(await systemRepo.byId(systemId)).toBeTruthy();
    expect(await systemRepo.byId('remote-system')).toBeTruthy();
    expect((await readBaseline())?.revision).toBe(1);
    expect(await readDirty()).toBeNull();
    expect((await readStatus()).state).toBe('healthy');
  });

  it('restores remote data without deleting local records', async () => {
    await systemRepo.create({
      name: 'LocalOnly', url: 'https://local-only.example.com', environment: 'development',
      favorite: false, sort: 0,
    });
    await db.deletions.put({
      id: 'group:gone',
      entityType: 'group',
      entityId: 'gone',
      deletedAt: Date.now(),
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/sync/state')) {
        return jsonResponse({
          revision: 5,
          serverTime: Date.now(),
          snapshot: {
            schemaVersion: 1,
            generatedAt: Date.now(),
            data: { ...emptySnapshotData(), systems: [remoteSystem('restored')] },
          },
          tombstones: emptyTombstones(),
        });
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    });

    const result = await restoreFromCloud();
    expect(result.revision).toBe(5);
    expect(await systemRepo.byId('restored')).toBeTruthy();
    const all = await systemRepo.all();
    expect(all.map(system => system.name).sort()).toEqual(['LocalOnly', 'restored']);
    expect((await readBaseline())?.revision).toBe(5);
    expect(await db.deletions.count()).toBe(0);
  });

  it('restores remote data while cloud persistence is disabled', async () => {
    await writeCloudConfig({
      enabled: false,
      endpoint: BASE,
      token: { __encrypted: false, value: 'api-token' },
      clientId: 'client-test',
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/sync/state')) {
        return jsonResponse({
          revision: 7,
          serverTime: Date.now(),
          snapshot: {
            schemaVersion: 1,
            generatedAt: Date.now(),
            data: { ...emptySnapshotData(), systems: [remoteSystem('restored-off')] },
          },
          tombstones: emptyTombstones(),
        });
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    });

    const result = await restoreFromCloud();
    expect(result.revision).toBe(7);
    expect(await systemRepo.byId('restored-off')).toBeTruthy();
    expect((await readBaseline())?.revision).toBe(7);
  });

  it('overwrites the cloud with local data, beating stale tombstones and removing cloud-only records', async () => {
    const localId = await systemRepo.create({
      name: 'Local', url: 'https://local.example.com', environment: 'development',
      favorite: false, sort: 0,
    });
    await db.systems.update(localId, { updatedAt: 1000 });
    await clearDirty();

    const remoteState: ServerState = {
      revision: 4,
      snapshot: {
        schemaVersion: 1,
        generatedAt: 0,
        data: { ...emptySnapshotData(), systems: [remoteSystem('cloud-only', 2000)] },
      },
      tombstones: { ...emptyTombstones(), systems: { [localId]: 2000 } },
    };

    let pushed: SyncPushRequest | null = null;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true });
      if (url.endsWith('/api/sync/state')) {
        return jsonResponse({
          revision: remoteState.revision,
          serverTime: Date.now(),
          snapshot: remoteState.snapshot,
          tombstones: remoteState.tombstones,
        });
      }
      if (url.endsWith('/api/sync/push')) {
        const body = JSON.parse(String(init?.body)) as SyncPushRequest;
        pushed = body;
        const merged = mergeServerState(remoteState, body, Date.now());
        return jsonResponse({
          revision: 5,
          serverTime: Date.now(),
          reset: false,
          snapshot: merged.state.snapshot,
          tombstones: merged.state.tombstones,
          stats: merged.stats,
        });
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    });

    const result = await overwriteCloud();
    expect(result.response.revision).toBe(5);
    expect(pushed).not.toBeNull();

    const sent = pushed!.snapshot.data.systems.find(system => system.id === localId);
    expect(sent!.updatedAt).toBeGreaterThan(2000);
    expect(pushed!.tombstones.systems['cloud-only']).toBeGreaterThan(0);

    const remoteIds = result.response.snapshot.data.systems.map(system => system.id);
    expect(remoteIds).toEqual([localId]);
    expect(result.response.tombstones.systems[localId]).toBeUndefined();
    expect(await systemRepo.byId('cloud-only')).toBeUndefined();
    expect((await systemRepo.byId(localId))!.updatedAt).toBeGreaterThan(2000);
    expect((await readBaseline())?.revision).toBe(5);
  });

  it('does not propagate deletions made while cloud persistence was disabled', async () => {
    await systemRepo.create({
      name: 'Local', url: 'https://local.example.com', environment: 'development',
      favorite: false, sort: 0,
    });
    await writeCloudConfig({
      enabled: true,
      endpoint: BASE,
      token: { __encrypted: false, value: 'api-token' },
      clientId: 'client-test',
      suppressDeletions: true,
    });
    await db.deletions.put({
      id: 'group:gone',
      entityType: 'group',
      entityId: 'gone',
      deletedAt: Date.now(),
    });
    await clearDirty();

    let pushedBody: SyncPushRequest | null = null;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true });
      if (url.endsWith('/api/sync/push')) {
        const body = JSON.parse(String(init?.body)) as SyncPushRequest;
        pushedBody = body;
        return jsonResponse({
          revision: 1,
          serverTime: Date.now(),
          reset: false,
          snapshot: body.snapshot,
          tombstones: emptyTombstones(),
          stats: { applied: 1, ignoredOlder: 0, rejectedByTombstone: 0, droppedOrphans: 0 },
        });
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    });

    const result = await pushToCloud();
    expect(result.response.revision).toBe(1);
    expect(pushedBody).not.toBeNull();
    for (const table of Object.values(pushedBody!.tombstones)) {
      expect(Object.keys(table)).toEqual([]);
    }
    expect(await db.deletions.count()).toBe(0);
    expect((await readCloudConfig())?.suppressDeletions).toBe(false);
  });

  it('refuses to push while a master password is enabled and the vault is locked', async () => {
    await cryptoService.setPassword('mysecret');
    cryptoSession.lock();
    await expect(pushToCloud()).rejects.toBeInstanceOf(VaultLockedError);
  });
});
