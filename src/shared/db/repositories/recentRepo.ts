import { db } from '../schema';
import type { EntityType } from '../../types/entities';

export const recentRepo = {
  async touch(entityType: EntityType, entityId: string, role?: string): Promise<void> {
    const id = `${entityType}:${entityId}`;
    await db.recents.put({ id, entityType, entityId, lastAccessedAt: Date.now(), role });
  },

  async top(limit: number = 10): Promise<Array<{ entityType: EntityType; entityId: string; lastAccessedAt: number; role?: string }>> {
    return db.recents.orderBy('lastAccessedAt').reverse().limit(limit).toArray();
  },

  async clear(): Promise<void> {
    await db.recents.clear();
  },
};
