import { db } from '../schema';
import type { ConfigDef, ConfigField, Environment } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export const configDefRepo = {
  async byProject(projectId: string): Promise<ConfigDef[]> {
    return db.configDefs.where('projectId').equals(projectId).sortBy('sortOrder');
  },

  async byId(id: string): Promise<ConfigDef | undefined> {
    return db.configDefs.get(id);
  },

  async create(projectId: string, name: string, environment?: Environment): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.configDefs.add(toPlain({
      id,
      projectId,
      name,
      environment,
      fields: [],
      createdAt: now,
      updatedAt: now,
    }));
    return id;
  },

  async rename(id: string, name: string): Promise<void> {
    await db.configDefs.update(id, { name, updatedAt: Date.now() });
  },

  async setEnvironment(id: string, environment?: Environment): Promise<void> {
    await db.configDefs.update(id, toPlain({ environment, updatedAt: Date.now() }));
  },

  async delete(id: string): Promise<void> {
    await db.configDefs.delete(id);
  },

  async setFields(id: string, fields: ConfigField[]): Promise<void> {
    await db.configDefs.update(id, { fields: toPlain(fields), updatedAt: Date.now() });
  },

  async reorder(_projectId: string, orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.configDefs, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.configDefs.update(orderedIds[i], { sortOrder: i, updatedAt: Date.now() });
      }
    });
  },
};
