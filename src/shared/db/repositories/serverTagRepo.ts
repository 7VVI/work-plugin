import { db } from '../schema';

export const serverTagRepo = {
  async attach(serverId: string, tagId: string): Promise<void> {
    await db.transaction('rw', db.serverTags, db.servers, async () => {
      const exists = await db.serverTags.where('[serverId+tagId]').equals([serverId, tagId]).first();
      if (!exists) {
        await db.serverTags.add({ serverId, tagId });
        await db.servers.update(serverId, { updatedAt: Date.now() });
      }
    });
  },

  async detach(serverId: string, tagId: string): Promise<void> {
    await db.transaction('rw', db.serverTags, db.servers, async () => {
      const deleted = await db.serverTags.where('[serverId+tagId]').equals([serverId, tagId]).delete();
      if (deleted > 0) await db.servers.update(serverId, { updatedAt: Date.now() });
    });
  },

  async tagsFor(serverId: string): Promise<string[]> {
    const rows = await db.serverTags.where('serverId').equals(serverId).toArray();
    return rows.map(r => r.tagId);
  },

  async replaceAll(serverId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.serverTags, db.servers, async () => {
      const current = (await db.serverTags.where('serverId').equals(serverId).toArray())
        .map(r => r.tagId)
        .sort();
      const next = [...new Set(tagIds)].sort();
      if (current.length === next.length && current.every((id, i) => id === next[i])) return;

      await db.serverTags.where('serverId').equals(serverId).delete();
      for (const tagId of next) await db.serverTags.add({ serverId, tagId });
      await db.servers.update(serverId, { updatedAt: Date.now() });
    });
  },
};
