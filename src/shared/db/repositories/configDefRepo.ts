import { db } from '../schema';
import type { ConfigDef, ConfigField, Environment } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

function bySortOrder(a: ConfigDef, b: ConfigDef): number {
  return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    || a.createdAt - b.createdAt
    || a.id.localeCompare(b.id);
}

export const configDefRepo = {
  async byProject(projectId: string): Promise<ConfigDef[]> {
    const list = await db.configDefs.where('projectId').equals(projectId).toArray();
    return list.sort(bySortOrder);
  },

  async byId(id: string): Promise<ConfigDef | undefined> {
    return db.configDefs.get(id);
  },

  async create(projectId: string, name: string, environment?: Environment, sortOrder?: number): Promise<string> {
    const now = Date.now();
    const id = generateId();
    const existing = await db.configDefs.where('projectId').equals(projectId).toArray();
    const order = sortOrder ?? existing.reduce((max, c) => Math.max(max, c.sortOrder ?? -1), -1) + 1;
    await db.configDefs.add(toPlain({
      id,
      projectId,
      name,
      environment,
      fields: [],
      sortOrder: order,
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
      const now = Date.now();
      for (let i = 0; i < orderedIds.length; i++) {
        await db.configDefs.update(orderedIds[i], { sortOrder: i, updatedAt: now });
      }
    });
  },

  /**
   * 把配置移动到另一个分组，并重排源分组与目标分组的 sortOrder。
   */
  async moveToProject(id: string, targetProjectId: string, targetIndex: number): Promise<void> {
    await db.transaction('rw', db.configDefs, async () => {
      const moved = await db.configDefs.get(id);
      if (!moved || moved.projectId === targetProjectId) return;

      const now = Date.now();
      const source = (await db.configDefs.where('projectId').equals(moved.projectId).toArray())
        .filter(c => c.id !== id)
        .sort(bySortOrder);

      for (let i = 0; i < source.length; i++) {
        if (source[i].sortOrder !== i) {
          await db.configDefs.update(source[i].id, { sortOrder: i, updatedAt: now });
        }
      }

      const target = (await db.configDefs.where('projectId').equals(targetProjectId).toArray())
        .sort(bySortOrder);
      const insertAt = Math.max(0, Math.min(targetIndex, target.length));
      const next = [...target];
      next.splice(insertAt, 0, moved);

      for (let i = 0; i < next.length; i++) {
        const config = next[i];
        const patch: Partial<ConfigDef> = {};
        if (config.id === id) patch.projectId = targetProjectId;
        if (config.sortOrder !== i) patch.sortOrder = i;
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = now;
          await db.configDefs.update(config.id, patch);
        }
      }
    });
  },
};
