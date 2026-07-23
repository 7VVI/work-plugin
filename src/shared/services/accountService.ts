import { accountRepo } from '../db/repositories/accountRepo';
import { cryptoService } from './cryptoService';
import type { Account, AccountInput } from '../types/entities';
import { requireString } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';

export const accountService = {
  async bySystemId(systemId: string): Promise<Account[]> {
    return accountRepo.bySystemId(systemId);
  },

  async countBySystem(systemId: string): Promise<number> {
    return accountRepo.countBySystem(systemId);
  },

  async create(input: AccountInput): Promise<string> {
    requireString(input.role, '角色');
    requireString(input.username, '用户名');
    requireString(input.password, '密码');
    const encryptedPassword = await cryptoService.encryptField(input.password);
    const id = await accountRepo.create({
      systemId: input.systemId,
      role: input.role,
      username: input.username,
      password: encryptedPassword,
      isDefault: input.isDefault,
      remark: input.remark,
    });
    if (input.isDefault) {
      await accountRepo.setDefault(input.systemId, id);
    }
    return id;
  },

  async update(id: string, patch: Partial<AccountInput>): Promise<void> {
    const { password, ...rest } = patch;
    const updatePatch: Partial<Account> = { ...rest };
    if (password !== undefined) {
      updatePatch.password = await cryptoService.encryptField(password);
    }
    await accountRepo.update(id, updatePatch);
    if (patch.isDefault && patch.systemId) {
      await accountRepo.setDefault(patch.systemId, id);
    }
  },

  async delete(id: string): Promise<void> {
    await accountRepo.delete(id);
  },

  async setDefault(systemId: string, accountId: string): Promise<void> {
    await accountRepo.setDefault(systemId, accountId);
  },

  async getDecrypted(id: string): Promise<Account & { plainPassword: string }> {
    const account = await accountRepo.byId(id);
    if (!account) throw new Error('Account not found');
    const plainPassword = await cryptoService.decryptField(account.password);
    return { ...account, plainPassword };
  },

  async copyUsername(id: string): Promise<void> {
    const account = await accountRepo.byId(id);
    if (!account) return;
    await copyToClipboard(account.username);
  },

  async copyPassword(id: string): Promise<void> {
    const { plainPassword } = await this.getDecrypted(id);
    await copyToClipboard(plainPassword);
  },

  async copyAll(id: string): Promise<void> {
    const { username, plainPassword } = await this.getDecrypted(id);
    await copyToClipboard(`${username}\n${plainPassword}`);
  },
};
