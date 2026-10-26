import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCloudSyncStore } from '../../../src/shared/stores/cloudSyncStore';
import { clearCloudConfig, readCloudConfig } from '../../../src/shared/sync/syncStorage';
import { db } from '../../../src/shared/db/schema';
import { clearDirty } from '../../../src/shared/sync/dirtyTracker';

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('cloudSyncStore persistence', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.delete();
    await db.open();
    await clearCloudConfig();
    await clearDirty();
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true });
      if (url.endsWith('/api/sync/ping')) return jsonResponse({ ok: true, revision: 0, serverTime: Date.now() });
      return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 });
    });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearCloudConfig();
  });

  it('persists the enabled switch and restores it after reload', async () => {
    const store = useCloudSyncStore();
    await store.load();

    await store.save({
      enabled: true,
      endpoint: '192.168.1.50:8080',
      token: 'api-token',
    });

    expect(store.config?.enabled).toBe(true);
    expect(store.config?.endpoint).toBe('http://192.168.1.50:8080');
    expect(store.hasToken).toBe(true);
    expect(store.config?.suppressDeletions).toBe(true);

    await store.save({ enabled: false, endpoint: '192.168.1.50:8080' });
    await store.save({ enabled: true, endpoint: '192.168.1.50:8080' });
    expect(store.config?.suppressDeletions).toBe(true);

    const raw = await readCloudConfig();
    expect(raw?.enabled).toBe(true);
    expect(raw?.endpoint).toBe('http://192.168.1.50:8080');

    setActivePinia(createPinia());
    const reloaded = useCloudSyncStore();
    await reloaded.load();
    expect(reloaded.config?.enabled).toBe(true);
    expect(reloaded.config?.endpoint).toBe('http://192.168.1.50:8080');
    expect(reloaded.hasToken).toBe(true);
  });
});
