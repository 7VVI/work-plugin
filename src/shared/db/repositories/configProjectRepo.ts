import { db } from '../schema';
import type { ConfigProject } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export const configProjectRepo = {
  async all(): Promise<ConfigProject[]> {
    // 注意：不能用 orderBy('sortOrder') —— Dexie 基于索引的 orderBy 会
    // 排除 sortOrder 为 undefined 的记录（新建项目未设置 sortOrder），
    // 导致"新增项目不显示"。改为取出全部后在内存排序。
    const list = await db.configProjects.toArray();
    return list.sort(
      (a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        || a.createdAt - b.createdAt,
    );
  },

  async byId(id: string): Promise<ConfigProject | undefined> {
    return db.configProjects.get(id);
  },

  async create(name: string): Promise<string> {
    const now = Date.now();
    const id = generateId();
    const count = await db.configProjects.count();
    await db.configProjects.add(toPlain({
      id,
      name,
      sortOrder: count,
      createdAt: now,
      updatedAt: now,
    }));
    return id;
  },

  async rename(id: string, name: string): Promise<void> {
    await db.configProjects.update(id, toPlain({ name, updatedAt: Date.now() }));
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.configProjects, db.configDefs, async () => {
      await db.configProjects.delete(id);
      await db.configDefs.where('projectId').equals(id).delete();
    });
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.configProjects, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.configProjects.update(orderedIds[i], { sortOrder: i, updatedAt: Date.now() });
      }
    });
  },
};
