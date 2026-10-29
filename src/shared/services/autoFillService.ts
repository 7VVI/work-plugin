import { systemRepo } from '../db/repositories/systemRepo';
import { accountRepo } from '../db/repositories/accountRepo';
import { cryptoService } from './cryptoService';
import { hostMatchesSystem, matchUrl } from '../utils/url';
import type { System } from '../types/entities';
import type { AccountMatch } from '../types/messages';

interface SystemMatch {
  system: System;
  score: number;
  protocolMatch: boolean;
  queryMatch: boolean;
}

/**
 * 返回与 URL 匹配度最高的系统。
 * 同分时先按查询参数、再按协议区分；仍然并列则返回多个，表示无法确定是哪个项目。
 * 路径完全不匹配时退回同 host 匹配（登录页/SPA 路由常与保存地址不同）。
 */
async function findBestSystems(url: string): Promise<System[]> {
  const systems = await systemRepo.all();
  const matches: SystemMatch[] = [];

  for (const system of systems) {
    const detail = matchUrl(url, system.url);
    if (detail) matches.push({ system, ...detail });
  }
  if (matches.length === 0) {
    // 登录页可能是 /user/login，而系统保存的是 /system/user；
    // 同一 host 视为同一站点，唯一系统时自动填充，多个系统时交给选择器。
    return systems.filter(system => hostMatchesSystem(url, system.url));
  }

  const bestScore = Math.max(...matches.map(m => m.score));
  let candidates = matches.filter(m => m.score === bestScore);

  const queryMatched = candidates.filter(m => m.queryMatch);
  if (queryMatched.length > 0) candidates = queryMatched;

  const protocolMatched = candidates.filter(m => m.protocolMatch);
  if (protocolMatched.length > 0) candidates = protocolMatched;

  return candidates.map(m => m.system);
}

async function decryptedAccounts(system: System): Promise<AccountMatch[]> {
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
    } catch (error) {
      // skip accounts that can't be decrypted
      console.warn('[Dock] 账号密码解密失败（主密码未解锁时无法自动填充）', account.id, error);
    }
  }

  // 默认账号排在最前面；多重默认时按创建时间取最早的一个，保证结果稳定
  matches.sort((a, b) => {
    if (a.account.isDefault !== b.account.isDefault) return a.account.isDefault ? -1 : 1;
    return a.account.createdAt - b.account.createdAt || a.account.id.localeCompare(b.account.id);
  });

  return matches;
}

export interface FillResolution {
  /** 可以直接填充的账号（系统唯一时的默认账号） */
  autoFill: AccountMatch | null;
  /** 需要用户选择时的候选账号（无默认账号或多个系统并列匹配） */
  picker: AccountMatch[];
}

async function resolveForUrl(url: string): Promise<FillResolution> {
  const systems = await findBestSystems(url);
  if (systems.length === 0) return { autoFill: null, picker: [] };

  const accounts: AccountMatch[] = [];
  for (const system of systems) {
    accounts.push(...await decryptedAccounts(system));
  }

  // 多个系统同样精确：不能替用户猜项目，交给选择器
  if (systems.length > 1) {
    return { autoFill: null, picker: accounts };
  }

  const defaultAccount = accounts.find(m => m.account.isDefault);
  if (defaultAccount) return { autoFill: defaultAccount, picker: [] };
  if (accounts.length === 1) return { autoFill: accounts[0], picker: [] };
  return { autoFill: null, picker: accounts };
}

export const autoFillService = {
  /**
   * 仅在唯一系统匹配时返回；多个系统同样精确时返回 undefined，
   * 避免把其他项目的账号密码当成本系统的默认账号。
   */
  async findSystemByUrl(url: string): Promise<System | undefined> {
    const systems = await findBestSystems(url);
    return systems.length === 1 ? systems[0] : undefined;
  },

  /**
   * 返回匹配系统的所有账号。存在多个同样精确的系统时一并返回，
   * 供手动填充选择器让用户明确选择要填哪个项目。
   */
  async findAccountsForUrl(url: string): Promise<AccountMatch[]> {
    const systems = await findBestSystems(url);
    const matches: AccountMatch[] = [];
    for (const system of systems) {
      matches.push(...await decryptedAccounts(system));
    }
    return matches;
  },

  /**
   * 自动填充只接受唯一匹配的系统，并优先使用默认账号；
   * 无法确定时静默放弃，宁可不填也不填错。
   */
  async findDefaultAccountForUrl(url: string): Promise<AccountMatch | null> {
    return (await resolveForUrl(url)).autoFill;
  },

  /**
   * 手动填充入口：有默认账号时直接填默认账号，只有无默认账号
   * 或多个系统并列匹配时才返回候选列表交给用户选择。
   */
  async resolveForUrl(url: string): Promise<FillResolution> {
    return resolveForUrl(url);
  },
};
