import { db } from '../schema';
import type { Middleware } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export const middlewareRepo = {
  async all(): Promise<Middleware[]> {
    // 不能用 orderBy('sortOrder')：IndexedDB 基于索引的 orderBy 会排除
    // sortOrder 为 undefined 的记录（如导入时未设置 sortOrder 的中间件），
    // 导致“导入的中间件不显示”。改为取全部后在内存排序。
    const list = await db.middlewares.toArray();
    return list.sort(
      (a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        || a.createdAt - b.createdAt,
    );
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
    await db.middlewares.add(toPlain({ ...data, id, createdAt: now, updatedAt: now }));
    return id;
  },

  async update(id: string, patch: Partial<Middleware>): Promise<void> {
    await db.middlewares.update(id, toPlain({ ...patch, updatedAt: Date.now() }));
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.middlewares, db.middlewareTags, db.deletions, async () => {
      const now = Date.now();
      await db.middlewares.delete(id);
      await db.middlewareTags.where('middlewareId').equals(id).delete();
      await db.deletions.put({ id: `middleware:${id}`, entityType: 'middleware', entityId: id, deletedAt: now });
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
