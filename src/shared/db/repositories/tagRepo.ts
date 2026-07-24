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

  async create(data: Omit<Tag, 'id' | 'createdAt'>): Promise<string> {
    const id = generateId();
    await db.tags.add(toPlain({ ...data, id, createdAt: Date.now() }));
    return id;
  },

  async update(id: string, patch: Partial<Tag>): Promise<void> {
    await db.tags.update(id, toPlain(patch));
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.tags, db.systemTags, db.serverTags, db.middlewareTags, async () => {
      await db.tags.delete(id);
      await db.systemTags.where('tagId').equals(id).delete();
      await db.serverTags.where('tagId').equals(id).delete();
      await db.middlewareTags.where('tagId').equals(id).delete();
    });
  },
};
