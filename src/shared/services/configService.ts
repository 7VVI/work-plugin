import { configRepo } from '../db/repositories/configRepo';
import { configProjectRepo } from '../db/repositories/configProjectRepo';
import { configDefRepo } from '../db/repositories/configDefRepo';
import type { ConfigItem, ConfigField } from '../types/entities';
import { requireString } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';

export const configService = {
  // === 旧的两级结构 API（保持兼容） ===
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

  // === v3 三级结构 API（项目 → 配置 → 字段） ===

  // 项目
  async allProjects() {
    return configProjectRepo.all();
  },

  async createProject(name: string): Promise<string> {
    requireString(name, '项目名称');
    return configProjectRepo.create(name);
  },

  async renameProject(id: string, name: string): Promise<void> {
    requireString(name, '项目名称');
    await configProjectRepo.rename(id, name);
  },

  async deleteProject(id: string): Promise<void> {
    await configProjectRepo.delete(id);
  },

  async reorderProjects(orderedIds: string[]): Promise<void> {
    await configProjectRepo.reorder(orderedIds);
  },

  // 配置
  async configsByProject(projectId: string) {
    return configDefRepo.byProject(projectId);
  },

  async createConfig(projectId: string, name: string): Promise<string> {
    requireString(name, '配置名称');
    return configDefRepo.create(projectId, name);
  },

  async renameConfig(id: string, name: string): Promise<void> {
    requireString(name, '配置名称');
    await configDefRepo.rename(id, name);
  },

  async deleteConfig(id: string): Promise<void> {
    await configDefRepo.delete(id);
  },

  async setConfigFields(id: string, fields: ConfigField[]): Promise<void> {
    await configDefRepo.setFields(id, fields);
  },

  async reorderConfigs(projectId: string, orderedIds: string[]): Promise<void> {
    await configDefRepo.reorder(projectId, orderedIds);
  },
};
