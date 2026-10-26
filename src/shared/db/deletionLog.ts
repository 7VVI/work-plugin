import { db } from './schema';
import type { DeletionEntry, DeletionEntityType } from '../types/entities';

export function deletionId(entityType: DeletionEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export async function recordDeletion(
  entityType: DeletionEntityType,
  entityId: string,
  deletedAt = Date.now(),
): Promise<void> {
  await db.deletions.put({
    id: deletionId(entityType, entityId),
    entityType,
    entityId,
    deletedAt,
  });
}

export async function allDeletions(): Promise<DeletionEntry[]> {
  return db.deletions.toArray();
}

export async function clearDeletions(): Promise<void> {
  await db.deletions.clear();
}

export async function pruneDeletions(before: number): Promise<void> {
  await db.deletions.where('deletedAt').belowOrEqual(before).delete();
}
