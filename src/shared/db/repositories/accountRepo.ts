import { db } from '../schema';
import type { Account } from '../../types/entities';
import { generateId } from '../../utils/id';

export const accountRepo = {
  async bySystemId(systemId: string): Promise<Account[]> {
    return db.accounts.where('systemId').equals(systemId).toArray();
  },

  async byId(id: string): Promise<Account | undefined> {
    return db.accounts.get(id);
  },

  async create(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.accounts.add({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, patch: Partial<Account>): Promise<void> {
    await db.accounts.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.accounts.delete(id);
  },

  async setDefault(systemId: string, accountId: string): Promise<void> {
    await db.transaction('rw', db.accounts, async () => {
      const accounts = await db.accounts.where('systemId').equals(systemId).toArray();
      for (const acc of accounts) {
        await db.accounts.update(acc.id, { isDefault: acc.id === accountId, updatedAt: Date.now() });
      }
    });
  },

  async getDefault(systemId: string): Promise<Account | undefined> {
    const accounts = await db.accounts.where('systemId').equals(systemId).toArray();
    return accounts.find(a => a.isDefault) ?? accounts[0];
  },
};
