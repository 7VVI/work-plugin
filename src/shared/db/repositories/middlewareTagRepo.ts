import { db } from '../schema';

export const middlewareTagRepo = {
  async attach(middlewareId: string, tagId: string): Promise<void> {
    const exists = await db.middlewareTags.where('[middlewareId+tagId]').equals([middlewareId, tagId]).first();
    if (!exists) await db.middlewareTags.add({ middlewareId, tagId });
  },

  async detach(middlewareId: string, tagId: string): Promise<void> {
    await db.middlewareTags.where('[middlewareId+tagId]').equals([middlewareId, tagId]).delete();
  },

  async tagsFor(middlewareId: string): Promise<string[]> {
    const rows = await db.middlewareTags.where('middlewareId').equals(middlewareId).toArray();
    return rows.map(r => r.tagId);
  },

  async replaceAll(middlewareId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.middlewareTags, async () => {
      await db.middlewareTags.where('middlewareId').equals(middlewareId).delete();
      for (const tagId of tagIds) await db.middlewareTags.add({ middlewareId, tagId });
    });
  },
};
