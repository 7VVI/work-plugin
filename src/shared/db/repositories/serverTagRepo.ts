import { db } from '../schema';

export const serverTagRepo = {
  async attach(serverId: string, tagId: string): Promise<void> {
    const exists = await db.serverTags.where('[serverId+tagId]').equals([serverId, tagId]).first();
    if (!exists) await db.serverTags.add({ serverId, tagId });
  },

  async detach(serverId: string, tagId: string): Promise<void> {
    await db.serverTags.where('[serverId+tagId]').equals([serverId, tagId]).delete();
  },

  async tagsFor(serverId: string): Promise<string[]> {
    const rows = await db.serverTags.where('serverId').equals(serverId).toArray();
    return rows.map(r => r.tagId);
  },

  async replaceAll(serverId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.serverTags, async () => {
      await db.serverTags.where('serverId').equals(serverId).delete();
      for (const tagId of tagIds) await db.serverTags.add({ serverId, tagId });
    });
  },
};
