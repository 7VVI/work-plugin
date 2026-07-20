import { db } from '../schema';
import type { ConfigGroup, ConfigGroupInput } from '../../types/entities';
import { generateId } from '../../utils/id';

export const configRepo = {
  async all(): Promise<ConfigGroup[]> {
    return db.configs.orderBy('createdAt').toArray();
  },

  async byId(id: string): Promise<ConfigGroup | undefined> {
    return db.configs.get(id);
  },

  async create(data: ConfigGroupInput): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.configs.add({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, patch: Partial<ConfigGroup>): Promise<void> {
    await db.configs.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.configs.delete(id);
  },
};
