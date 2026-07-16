import { tagRepo } from '../db/repositories/tagRepo';
import type { Tag } from '../types/entities';
import { requireString } from '../utils/validation';

export const tagService = {
  async all(): Promise<Tag[]> {
    return tagRepo.all();
  },

  async create(name: string, color?: string): Promise<string> {
    requireString(name, '标签名称');
    const existing = await tagRepo.byName(name);
    if (existing) return existing.id;
    return tagRepo.create({ name, color });
  },

  async update(id: string, patch: Partial<Tag>): Promise<void> {
    await tagRepo.update(id, patch);
  },

  async delete(id: string): Promise<void> {
    await tagRepo.delete(id);
  },

  async findOrCreate(names: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const id = await this.create(name);
      ids.push(id);
    }
    return ids;
  },
};
