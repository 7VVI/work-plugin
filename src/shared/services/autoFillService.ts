import { systemRepo } from '../db/repositories/systemRepo';
import { accountRepo } from '../db/repositories/accountRepo';
import { cryptoService } from './cryptoService';
import { urlMatchesSystem } from '../utils/url';
import type { System } from '../types/entities';
import type { AccountMatch } from '../types/messages';

export const autoFillService = {
  async findSystemByUrl(url: string): Promise<System | undefined> {
    const systems = await systemRepo.all();
    return systems.find(s => urlMatchesSystem(url, s.url));
  },

  async findAccountsForUrl(url: string): Promise<AccountMatch[]> {
    const system = await this.findSystemByUrl(url);
    if (!system) return [];

    const accounts = await accountRepo.bySystemId(system.id);
    const matches: AccountMatch[] = [];

    for (const account of accounts) {
      try {
        const plainPassword = await cryptoService.decryptField(account.password);
        matches.push({
          systemId: system.id,
          systemName: system.name,
          account: { ...account, plainPassword },
        });
      } catch {
        // skip accounts that can't be decrypted
      }
    }

    // 默认账号排在第一位
    matches.sort((a, b) => {
      if (a.account.isDefault && !b.account.isDefault) return -1;
      if (!a.account.isDefault && b.account.isDefault) return 1;
      return 0;
    });

    return matches;
  },

  async findDefaultAccountForUrl(url: string): Promise<AccountMatch | null> {
    const matches = await this.findAccountsForUrl(url);
    if (matches.length === 0) return null;
    return matches[0];
  },
};
