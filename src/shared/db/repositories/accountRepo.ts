import { db } from '../schema';
import type { Account } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export const accountRepo = {
  async bySystemId(systemId: string): Promise<Account[]> {
    const accounts = await db.accounts.where('systemId').equals(systemId).toArray();
    // 固定按创建时间排序，保证“默认账号”的选择不受 IndexedDB 索引顺序影响
    return accounts.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  },

  async countBySystem(systemId: string): Promise<number> {
    return db.accounts.where('systemId').equals(systemId).count();
  },

  async byId(id: string): Promise<Account | undefined> {
    return db.accounts.get(id);
  },

  async create(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.accounts.add(toPlain({ ...data, id, createdAt: now, updatedAt: now }));
    return id;
  },

  async update(id: string, patch: Partial<Account>): Promise<void> {
    await db.accounts.update(id, toPlain({ ...patch, updatedAt: Date.now() }));
  },

  async delete(id: string): Promise<void> {
    const account = await db.accounts.get(id);
    await db.accounts.delete(id);
    // 删除默认账号后自动补选，避免系统陷入“没有默认账号”的状态
    if (account) await this.normalizeDefault(account.systemId);
  },

  /**
   * 保证一个系统最多一个默认账号，并确保非空系统始终有一个默认账号。
   * 多个默认时保留创建时间最早的那个（通常是用户最先设置的）。
   */
  async normalizeDefault(systemId: string): Promise<void> {
    await db.transaction('rw', db.accounts, async () => {
      const accounts = await db.accounts.where('systemId').equals(systemId).toArray();
      if (accounts.length === 0) return;

      accounts.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      const preferred = accounts.find(a => a.isDefault) ?? accounts[0];
      for (const account of accounts) {
        const isDefault = account.id === preferred.id;
        if (account.isDefault !== isDefault) {
          await db.accounts.update(account.id, { isDefault, updatedAt: Date.now() });
        }
      }
    });
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
    const accounts = await this.bySystemId(systemId);
    return accounts.find(a => a.isDefault) ?? accounts[0];
  },
};
