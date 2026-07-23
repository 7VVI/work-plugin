import { db } from '../schema';
import type { ConfigProject } from '../../types/entities';
import { generateId } from '../../utils/id';

export const configProjectRepo = {
  async all(): Promise<ConfigProject[]> {
    return db.configProjects.orderBy('sortOrder').toArray();
  },

  async byId(id: string): Promise<ConfigProject | undefined> {
    return db.configProjects.get(id);
  },

  async create(name: string): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.configProjects.add({
      id,
      name,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async rename(id: string, name: string): Promise<void> {
    await db.configProjects.update(id, { name, updatedAt: Date.now() });
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
