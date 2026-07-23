import { configRepo } from '../db/repositories/configRepo';
import type { ConfigProject } from '../types/entities';
import { requireString } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';

export const configService = {
  async all() {
    return configRepo.all();
  },

  async byId(id: string) {
    return configRepo.byId(id);
  },

  async createProject(name: string): Promise<string> {
    requireString(name, '项目名称');
    return configRepo.create({ name, configs: [] });
  },

  async renameProject(project: ConfigProject, name: string): Promise<void> {
    requireString(name, '项目名称');
    project.name = name;
    await configRepo.update(project.id, { name, configs: project.configs });
  },

  async deleteProject(id: string): Promise<void> {
    await configRepo.delete(id);
  },

  /** 持久化整个项目（配置 / 字段的增删改均通过此入口写库） */
  async saveProject(project: ConfigProject): Promise<void> {
    await configRepo.update(project.id, { name: project.name, configs: project.configs });
  },

  async copyValue(value: string): Promise<void> {
    await copyToClipboard(value);
  },
};
