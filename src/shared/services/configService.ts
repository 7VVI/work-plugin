import { configRepo } from '../db/repositories/configRepo';
import type { ConfigItem } from '../types/entities';
import { requireString } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';

export const configService = {
  async all() {
    return configRepo.all();
  },

  async byId(id: string) {
    return configRepo.byId(id);
  },

  async create(name: string): Promise<string> {
    requireString(name, '配置组名称');
    return configRepo.create({ name, items: [] });
  },

  async rename(id: string, name: string): Promise<void> {
    requireString(name, '配置组名称');
    await configRepo.update(id, { name });
  },

  async delete(id: string): Promise<void> {
    await configRepo.delete(id);
  },

  async setItems(groupId: string, items: ConfigItem[]): Promise<void> {
    await configRepo.update(groupId, { items });
  },

  async addItem(groupId: string, key: string, value: string): Promise<void> {
    const group = await configRepo.byId(groupId);
    if (!group) return;
    const items = [...group.items, { key, value }];
    await configRepo.update(groupId, { items });
  },

  async updateItem(groupId: string, index: number, key: string, value: string): Promise<void> {
    const group = await configRepo.byId(groupId);
    if (!group) return;
    const items = [...group.items];
    if (index < 0 || index >= items.length) return;
    items[index] = { key, value };
    await configRepo.update(groupId, { items });
  },

  async removeItem(groupId: string, index: number): Promise<void> {
    const group = await configRepo.byId(groupId);
    if (!group) return;
    const items = group.items.filter((_, i) => i !== index);
    await configRepo.update(groupId, { items });
  },

  async copyValue(value: string): Promise<void> {
    await copyToClipboard(value);
  },
};
