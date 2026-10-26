import { db } from '../schema';

export const middlewareTagRepo = {
  async attach(middlewareId: string, tagId: string): Promise<void> {
    await db.transaction('rw', db.middlewareTags, db.middlewares, async () => {
      const exists = await db.middlewareTags.where('[middlewareId+tagId]').equals([middlewareId, tagId]).first();
      if (!exists) {
        await db.middlewareTags.add({ middlewareId, tagId });
        await db.middlewares.update(middlewareId, { updatedAt: Date.now() });
      }
    });
  },

  async detach(middlewareId: string, tagId: string): Promise<void> {
    await db.transaction('rw', db.middlewareTags, db.middlewares, async () => {
      const deleted = await db.middlewareTags.where('[middlewareId+tagId]').equals([middlewareId, tagId]).delete();
      if (deleted > 0) await db.middlewares.update(middlewareId, { updatedAt: Date.now() });
    });
  },

  async tagsFor(middlewareId: string): Promise<string[]> {
    const rows = await db.middlewareTags.where('middlewareId').equals(middlewareId).toArray();
    return rows.map(r => r.tagId);
  },

  async replaceAll(middlewareId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.middlewareTags, db.middlewares, async () => {
      const current = (await db.middlewareTags.where('middlewareId').equals(middlewareId).toArray())
        .map(r => r.tagId)
        .sort();
      const next = [...new Set(tagIds)].sort();
      if (current.length === next.length && current.every((id, i) => id === next[i])) return;

      await db.middlewareTags.where('middlewareId').equals(middlewareId).delete();
      for (const tagId of next) await db.middlewareTags.add({ middlewareId, tagId });
      await db.middlewares.update(middlewareId, { updatedAt: Date.now() });
    });
  },
};
