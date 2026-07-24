import { db } from '../schema';
import type { System, SystemInput } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export const systemRepo = {
  async all(): Promise<System[]> {
    return db.systems.orderBy('sort').toArray();
  },

  async byId(id: string): Promise<System | undefined> {
    return db.systems.get(id);
  },

  async byEnvironment(environment: string): Promise<System[]> {
    return db.systems.where('environment').equals(environment).toArray();
  },

  async create(data: SystemInput): Promise<string> {
    const now = Date.now();
    const id = generateId();
    const system = toPlain<System>({ ...data, id, createdAt: now, updatedAt: now });
    await db.systems.add(system);
    return id;
  },

  async update(id: string, patch: Partial<System>): Promise<void> {
    await db.systems.update(id, toPlain({ ...patch, updatedAt: Date.now() }));
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.systems, db.systemTags, db.accounts, async () => {
      await db.systems.delete(id);
      await db.systemTags.where('systemId').equals(id).delete();
      await db.accounts.where('systemId').equals(id).delete();
    });
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.systems, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.systems.update(orderedIds[i], { sort: i, updatedAt: Date.now() });
      }
    });
  },

  async search(query: string): Promise<System[]> {
    const q = query.toLowerCase();
    const all = await db.systems.toArray();
    return all.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.url.toLowerCase().includes(q) ||
      (s.remark ?? '').toLowerCase().includes(q)
    );
  },
};
