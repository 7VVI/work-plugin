import { db } from '../schema';
import type { Group, EntityType } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export const groupRepo = {
  async allByType(entityType: EntityType): Promise<Group[]> {
    const list = await db.groups.where('entityType').equals(entityType).toArray();
    return list.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt - b.createdAt,
    );
  },

  async byId(id: string): Promise<Group | undefined> {
    return db.groups.get(id);
  },

  async all(): Promise<Group[]> {
    const list = await db.groups.toArray();
    return list.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt - b.createdAt,
    );
  },

  /** 按主键插入或覆盖（用于导入） */
  async put(group: Group): Promise<void> {
    await db.groups.put(toPlain(group));
  },

  async clear(): Promise<void> {
    await db.groups.clear();
  },

  async create(data: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.groups.add(toPlain({ ...data, id, createdAt: now, updatedAt: now }));
    return id;
  },

  async update(id: string, patch: Partial<Group>): Promise<void> {
    await db.groups.update(id, toPlain({ ...patch, updatedAt: Date.now() }));
  },

  /** 删除分组，并把该分组下的资产 groupId 置空（资产本身不删除） */
  async remove(id: string, entityType: EntityType): Promise<void> {
    const table = (
      entityType === 'system' ? db.systems
        : entityType === 'server' ? db.servers
          : db.middlewares
    ) as unknown as { where: (k: string) => { equals: (v: string) => { primaryKeys: () => Promise<string[]> } }; update: (k: string, p: Record<string, unknown>) => Promise<number> };
    await db.transaction('rw', db.groups, db.systems, db.servers, db.middlewares, async () => {
      await db.groups.delete(id);
      const keys = await table.where('groupId').equals(id).primaryKeys();
      for (const pk of keys) {
        await table.update(pk, { groupId: undefined });
      }
    });
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.groups, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.groups.update(orderedIds[i], { sortOrder: i, updatedAt: Date.now() });
      }
    });
  },
};
