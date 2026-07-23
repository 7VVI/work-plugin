import { db } from '../schema';
import type { Middleware } from '../../types/entities';
import { generateId } from '../../utils/id';

export const middlewareRepo = {
  async all(): Promise<Middleware[]> {
    return db.middlewares.toArray();
  },

  async byId(id: string): Promise<Middleware | undefined> {
    return db.middlewares.get(id);
  },

  async byType(type: string): Promise<Middleware[]> {
    return db.middlewares.where('type').equals(type).toArray();
  },

  async create(data: Omit<Middleware, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.middlewares.add({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, patch: Partial<Middleware>): Promise<void> {
    await db.middlewares.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.middlewares, db.middlewareTags, async () => {
      await db.middlewares.delete(id);
      await db.middlewareTags.where('middlewareId').equals(id).delete();
    });
  },

  async search(query: string): Promise<Middleware[]> {
    const q = query.toLowerCase();
    const all = await db.middlewares.toArray();
    return all.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.host.toLowerCase().includes(q) ||
      (m.database ?? '').toLowerCase().includes(q) ||
      (m.remark ?? '').toLowerCase().includes(q)
    );
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.middlewares, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.middlewares.update(orderedIds[i], { sortOrder: i, updatedAt: Date.now() });
      }
    });
  },
};
