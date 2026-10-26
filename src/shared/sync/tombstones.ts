import { allDeletions, pruneDeletions } from '../db/deletionLog';
import {
  SNAPSHOT_TABLES,
  emptyTombstones,
  tableKeyForDeletionType,
  type SnapshotIndex,
  type TombstoneMap,
} from '@protocol/index';

/**
 * 合并显式删除日志与“上次同步索引中已消失”的推断删除。
 * 推断删除使用上次成功同步时间，避免误删云端在同步之后的新编辑。
 */
export async function buildTombstones(
  currentIndex: SnapshotIndex,
  previousIndex: SnapshotIndex | null,
  lastSyncedAt: number | null,
): Promise<TombstoneMap> {
  const tombstones = emptyTombstones();

  for (const entry of await allDeletions()) {
    const table = tableKeyForDeletionType(entry.entityType);
    if (!table) continue;
    tombstones[table][entry.entityId] = Math.max(
      tombstones[table][entry.entityId] ?? 0,
      entry.deletedAt,
    );
  }

  if (previousIndex) {
    for (const table of SNAPSHOT_TABLES) {
      for (const id of Object.keys(previousIndex[table])) {
        if (currentIndex[table][id] === undefined && tombstones[table][id] === undefined) {
          tombstones[table][id] = lastSyncedAt ?? Date.now();
        }
      }
    }
  }

  return tombstones;
}

export async function pruneSyncedDeletions(sentAt: number): Promise<void> {
  await pruneDeletions(sentAt);
}
