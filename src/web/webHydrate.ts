import { db } from '@shared/db/schema';
import { applyRemoteSnapshot, type ApplySummary } from '@shared/sync/snapshotApply';
import { clearDirty, withDirtyTrackingSuspended } from '@shared/sync/dirtyTracker';
import { clearCloudConfig, writeBaseline, writeStatus } from '@shared/sync/syncStorage';
import { indexFromSnapshot } from '@protocol/index';
import { webApi } from './webApi';

async function clearAllLocalTables(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.groups,
      db.tags,
      db.systems,
      db.accounts,
      db.servers,
      db.middlewares,
      db.systemTags,
      db.serverTags,
      db.middlewareTags,
      db.recents,
      db.meta,
      db.configs,
      db.configProjects,
      db.configDefs,
      db.deletions,
      db.noteBooks,
      db.notes,
      db.noteAssets,
    ],
    async () => {
      await db.groups.clear();
      await db.tags.clear();
      await db.systems.clear();
      await db.accounts.clear();
      await db.servers.clear();
      await db.middlewares.clear();
      await db.systemTags.clear();
      await db.serverTags.clear();
      await db.middlewareTags.clear();
      await db.recents.clear();
      await db.meta.clear();
      await db.configs.clear();
      await db.configProjects.clear();
      await db.configDefs.clear();
      await db.deletions.clear();
      await db.notes.clear();
      await db.noteBooks.clear();
      await db.noteAssets.clear();
    },
  );
}

export async function hydrateFromServer(): Promise<{ revision: number; summary: ApplySummary }> {
  const state = await webApi.getState();
  return withDirtyTrackingSuspended(async () => {
    await clearAllLocalTables();
    const summary = await applyRemoteSnapshot(state.snapshot, state.tombstones);
    await writeBaseline({
      revision: state.revision,
      syncedAt: Date.now(),
      index: indexFromSnapshot(state.snapshot),
    });
    await writeStatus({
      state: 'healthy',
      checkedAt: Date.now(),
      lastSyncAt: Date.now(),
      revision: state.revision,
      error: undefined,
    });
    await clearDirty();
    return { revision: state.revision, summary };
  });
}

export async function clearLocalWebData(): Promise<void> {
  await withDirtyTrackingSuspended(async () => {
    await clearAllLocalTables();
    await clearDirty();
    await clearCloudConfig();
  });
}
