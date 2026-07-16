import { db } from '../schema';

export const systemTagRepo = {
  async attach(systemId: string, tagId: string): Promise<void> {
    const exists = await db.systemTags.where('[systemId+tagId]').equals([systemId, tagId]).first();
    if (!exists) await db.systemTags.add({ systemId, tagId });
  },

  async detach(systemId: string, tagId: string): Promise<void> {
    await db.systemTags.where('[systemId+tagId]').equals([systemId, tagId]).delete();
  },

  async tagsFor(systemId: string): Promise<string[]> {
    const rows = await db.systemTags.where('systemId').equals(systemId).toArray();
    return rows.map(r => r.tagId);
  },

  async systemsFor(tagId: string): Promise<string[]> {
    const rows = await db.systemTags.where('tagId').equals(tagId).toArray();
    return rows.map(r => r.systemId);
  },

  async replaceAll(systemId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.systemTags, async () => {
      await db.systemTags.where('systemId').equals(systemId).delete();
      for (const tagId of tagIds) {
        await db.systemTags.add({ systemId, tagId });
      }
    });
  },
};
