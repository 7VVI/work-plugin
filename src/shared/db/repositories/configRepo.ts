import { db } from '../schema';
import type { ConfigProject, ConfigProjectInput } from '../../types/entities';
import { generateId } from '../../utils/id';

export const configRepo = {
  async all(): Promise<ConfigProject[]> {
    return db.configs.orderBy('createdAt').toArray();
  },

  async byId(id: string): Promise<ConfigProject | undefined> {
    return db.configs.get(id);
  },

  async create(data: ConfigProjectInput): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.configs.add({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, patch: Partial<ConfigProject>): Promise<void> {
    await db.configs.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.configs.delete(id);
  },
};
