import { systemRepo } from '../db/repositories/systemRepo';
import { recentRepo } from '../db/repositories/recentRepo';
import { systemTagRepo } from '../db/repositories/systemTagRepo';
import type { System, SystemInput } from '../types/entities';
import { requireString } from '../utils/validation';
import { isValidUrl } from '../utils/url';
import { ValidationError } from '../types/errors';

export const systemService = {
  async all(): Promise<System[]> {
    return systemRepo.all();
  },

  async byId(id: string): Promise<System | undefined> {
    return systemRepo.byId(id);
  },

  async create(input: SystemInput): Promise<string> {
    requireString(input.name, '系统名称');
    if (!isValidUrl(input.url)) throw new ValidationError('INVALID_URL', '系统地址格式不正确');
    const sort = input.sort || (await systemRepo.all()).length;
    return systemRepo.create({ ...input, sort });
  },

  async update(id: string, patch: Partial<SystemInput>): Promise<void> {
    if (patch.url !== undefined && !isValidUrl(patch.url)) {
      throw new ValidationError('INVALID_URL', '系统地址格式不正确');
    }
    await systemRepo.update(id, patch);
  },

  async delete(id: string): Promise<void> {
    await systemRepo.delete(id);
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await systemRepo.reorder(orderedIds);
  },

  async setTags(systemId: string, tagIds: string[]): Promise<void> {
    await systemTagRepo.replaceAll(systemId, tagIds);
  },

  async getTags(systemId: string): Promise<string[]> {
    return systemTagRepo.tagsFor(systemId);
  },

  async recordAccess(id: string, role?: string): Promise<void> {
    await recentRepo.touch('system', id, role);
  },
};
