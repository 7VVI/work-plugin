import { groupRepo } from '../db/repositories/groupRepo';
import type { EntityType } from '../types/entities';
import { requireString } from '../utils/validation';

export const groupService = {
  async allByType(entityType: EntityType) {
    return groupRepo.allByType(entityType);
  },

  async create(entityType: EntityType, name: string, color: string): Promise<string> {
    requireString(name, '分组名称');
    const count = (await groupRepo.allByType(entityType)).length;
    return groupRepo.create({ entityType, name: name.trim(), color, sortOrder: count });
  },

  async rename(id: string, name: string): Promise<void> {
    requireString(name, '分组名称');
    await groupRepo.update(id, { name: name.trim() });
  },

  async setColor(id: string, color: string): Promise<void> {
    await groupRepo.update(id, { color });
  },

  async remove(id: string, entityType: EntityType): Promise<void> {
    await groupRepo.remove(id, entityType);
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await groupRepo.reorder(orderedIds);
  },
};
