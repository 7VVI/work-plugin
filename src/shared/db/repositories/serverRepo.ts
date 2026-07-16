import { db } from '../schema';
import type { Server } from '../../types/entities';
import { generateId } from '../../utils/id';

export const serverRepo = {
  async all(): Promise<Server[]> {
    return db.servers.toArray();
  },

  async byId(id: string): Promise<Server | undefined> {
    return db.servers.get(id);
  },

  async favorites(): Promise<Server[]> {
    // Dexie 4 + IndexedDB cannot index boolean values (not valid keys per spec).
    // Use filter() instead of where().equals() so favorites query works correctly.
    return db.servers.filter(s => s.favorite === true).toArray();
  },

  async create(data: Omit<Server, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.servers.add({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, patch: Partial<Server>): Promise<void> {
    await db.servers.update(id, { ...patch, updatedAt: Date.now() });
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
};
