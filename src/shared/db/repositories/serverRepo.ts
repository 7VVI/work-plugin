import { db } from '../schema';
import type { Server } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export const serverRepo = {
  async all(): Promise<Server[]> {
    return db.servers.toArray();
  },

  async byId(id: string): Promise<Server | undefined> {
    return db.servers.get(id);
  },

  async create(data: Omit<Server, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.servers.add(toPlain({ ...data, id, createdAt: now, updatedAt: now }));
    return id;
  },

  async update(id: string, patch: Partial<Server>): Promise<void> {
    await db.servers.update(id, toPlain({ ...patch, updatedAt: Date.now() }));
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.servers, db.serverTags, async () => {
      await db.servers.delete(id);
      await db.serverTags.where('serverId').equals(id).delete();
    });
  },

  async search(query: string): Promise<Server[]> {
    const q = query.toLowerCase();
    const all = await db.servers.toArray();
    return all.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.ip.toLowerCase().includes(q) ||
      (s.purpose ?? '').toLowerCase().includes(q) ||
      (s.remark ?? '').toLowerCase().includes(q)
    );
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.servers, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.servers.update(orderedIds[i], { sortOrder: i, updatedAt: Date.now() });
      }
    });
  },
};
