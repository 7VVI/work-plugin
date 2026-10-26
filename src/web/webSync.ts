import { platform } from '@shared/platform';
import { generateId } from '@shared/utils/id';
import { buildLocalSnapshot } from '@shared/sync/snapshotBuilder';
import { applyRemoteSnapshot } from '@shared/sync/snapshotApply';
import { buildTombstones, pruneSyncedDeletions } from '@shared/sync/tombstones';
import { clearDirty, flushDirtyNow, readDirty, withDirtyTrackingSuspended } from '@shared/sync/dirtyTracker';
import { readBaseline, writeBaseline, writeStatus } from '@shared/sync/syncStorage';
import { indexFromSnapshot, type SyncPushRequest } from '@protocol/index';
import { webApi, UnauthorizedError } from './webApi';

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let syncing = false;
let pending = false;

async function getClientId(): Promise<string> {
  const result = await platform.storage.local.get('web.clientId');
  const existing = result['web.clientId'];
  if (typeof existing === 'string' && existing) return existing;
  const id = generateId();
  await platform.storage.local.set({ 'web.clientId': id });
  return id;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function pushWeb(keepalive = false): Promise<void> {
  if (syncing) {
    pending = true;
    return;
  }

  await flushDirtyNow();
  const dirtyBefore = await readDirty();
  syncing = true;
  pending = false;

  try {
    await writeStatus({ state: 'syncing', checkedAt: Date.now(), error: undefined });
    const snapshot = await buildLocalSnapshot();
    const baseline = await readBaseline();
    const tombstones = await buildTombstones(
      indexFromSnapshot(snapshot),
      baseline?.index ?? null,
      baseline?.syncedAt ?? null,
    );
    const request: SyncPushRequest = {
      protocol: 1,
      clientId: await getClientId(),
      baseRevision: baseline?.revision ?? 0,
      clientTime: Date.now(),
      snapshot,
      tombstones,
    };

    const response = await webApi.push(request, keepalive);
    await withDirtyTrackingSuspended(
      () => applyRemoteSnapshot(response.snapshot, response.tombstones),
    );
    await writeBaseline({
      revision: response.revision,
      syncedAt: Date.now(),
      index: indexFromSnapshot(response.snapshot),
    });
    await pruneSyncedDeletions(request.clientTime);
    await flushDirtyNow();
    await clearDirty(dirtyBefore?.seq ?? 0);
    await writeStatus({
      state: 'healthy',
      checkedAt: Date.now(),
      lastSyncAt: Date.now(),
      revision: response.revision,
      error: undefined,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      stopWebSync();
      await writeStatus({ state: 'auth-error', checkedAt: Date.now(), error: error.message });
      return;
    }
    await writeStatus({ state: 'unhealthy', checkedAt: Date.now(), error: errorMessage(error) });
    throw error;
  } finally {
    syncing = false;
    if (pending) {
      pending = false;
      schedulePush(800);
    }
  }
}

function schedulePush(delay = 2000): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void pushWeb().catch(() => {});
  }, delay);
}

function onPageHide(): void {
  void pushWeb(true).catch(() => {});
}

export function startWebSync(): void {
  if (started) return;
  started = true;

  unsubscribe = platform.storage.onChanged((key) => {
    if (key === 'cloud.dirty') schedulePush();
  });
  window.addEventListener('pagehide', onPageHide);
}

export function stopWebSync(): void {
  if (!started) return;
  started = false;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  unsubscribe?.();
  unsubscribe = null;
  window.removeEventListener('pagehide', onPageHide);
}
