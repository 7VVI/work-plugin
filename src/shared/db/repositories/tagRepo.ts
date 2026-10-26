import { db } from '../schema';
import type { Tag } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export const tagRepo = {
  async all(): Promise<Tag[]> {
    return db.tags.toArray();
  },

  async byId(id: string): Promise<Tag | undefined> {
    return db.tags.get(id);
  },

  async byName(name: string): Promise<Tag | undefined> {
    return db.tags.where('name').equals(name).first();
  },

  async create(data: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = Date.now();
    await db.tags.add(toPlain({ ...data, id, createdAt: now, updatedAt: now }));
    return id;
  },

  async update(id: string, patch: Partial<Tag>): Promise<void> {
    await db.tags.update(id, toPlain({ ...patch, updatedAt: Date.now() }));
  },

  async delete(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.tags, db.systemTags, db.serverTags, db.middlewareTags, db.systems, db.servers, db.middlewares, db.deletions],
      async () => {
        const now = Date.now();
        const systemIds = (await db.systemTags.where('tagId').equals(id).toArray()).map(r => r.systemId);
        const serverIds = (await db.serverTags.where('tagId').equals(id).toArray()).map(r => r.serverId);
        const middlewareIds = (await db.middlewareTags.where('tagId').equals(id).toArray()).map(r => r.middlewareId);

        await db.tags.delete(id);
        await db.systemTags.where('tagId').equals(id).delete();
        await db.serverTags.where('tagId').equals(id).delete();
        await db.middlewareTags.where('tagId').equals(id).delete();

        // 标签移除会改变资产的标签集合，更新时间戳让云端合并能识别这次变更
        for (const systemId of systemIds) await db.systems.update(systemId, { updatedAt: now });
        for (const serverId of serverIds) await db.servers.update(serverId, { updatedAt: now });
        for (const middlewareId of middlewareIds) {
          await db.middlewares.update(middlewareId, { updatedAt: now });
        }
        await db.deletions.put({
          id: `tag:${id}`,
          entityType: 'tag',
          entityId: id,
          deletedAt: now,
        });
      },
    );
  },
};
