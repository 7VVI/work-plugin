import { db } from '../schema';

export const systemTagRepo = {
  async attach(systemId: string, tagId: string): Promise<void> {
    await db.transaction('rw', db.systemTags, db.systems, async () => {
      const exists = await db.systemTags.where('[systemId+tagId]').equals([systemId, tagId]).first();
      if (!exists) {
        await db.systemTags.add({ systemId, tagId });
        await db.systems.update(systemId, { updatedAt: Date.now() });
      }
    });
  },

  async detach(systemId: string, tagId: string): Promise<void> {
    await db.transaction('rw', db.systemTags, db.systems, async () => {
      const deleted = await db.systemTags.where('[systemId+tagId]').equals([systemId, tagId]).delete();
      if (deleted > 0) await db.systems.update(systemId, { updatedAt: Date.now() });
    });
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
    await db.transaction('rw', db.systemTags, db.systems, async () => {
      const current = (await db.systemTags.where('systemId').equals(systemId).toArray())
        .map(r => r.tagId)
        .sort();
      const next = [...new Set(tagIds)].sort();
      if (current.length === next.length && current.every((id, i) => id === next[i])) return;

      await db.systemTags.where('systemId').equals(systemId).delete();
      for (const tagId of next) await db.systemTags.add({ systemId, tagId });
      await db.systems.update(systemId, { updatedAt: Date.now() });
    });
  },
};
