import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import { accountRepo } from '../../../src/shared/db/repositories/accountRepo';
import { autoFillService } from '../../../src/shared/services/autoFillService';
import type { SystemInput } from '../../../src/shared/types/entities';

const sampleSystem: SystemInput = {
  name: 'Test System',
  url: 'https://test.example.com',
  environment: 'development',
  favorite: false,
  sort: 0,
};

async function addSystem(name: string, url: string, sort: number): Promise<string> {
  return systemRepo.create({ ...sampleSystem, name, url, sort });
}

async function addAccount(systemId: string, username: string, password: string, isDefault = true): Promise<string> {
  return accountRepo.create({
    systemId,
    role: 'admin',
    username,
    password: { __encrypted: false, value: password },
    isDefault,
  });
}

describe('autoFillService', () => {
  beforeEach(async () => {
    await db.systems.clear();
    await db.accounts.clear();
  });

  describe('findSystemByUrl', () => {
    it('同 host 不同端口时，选中端口匹配的那个系统而不是第一个记录', async () => {
      // 故意先记录 8080，再记录 3000
      await addSystem('Backend 8080', 'http://localhost:8080', 0);
      await addSystem('Backend 3000', 'http://localhost:3000', 1);

      const system = await autoFillService.findSystemByUrl('http://localhost:3000/api/login');
      expect(system?.name).toBe('Backend 3000');
    });

    it('同域不同路径时，选中路径更精确的那个系统', async () => {
      await addSystem('Root', 'https://example.com', 0);
      await addSystem('App1', 'https://example.com/app1', 1);

      const system = await autoFillService.findSystemByUrl('https://example.com/app1/dashboard');
      expect(system?.name).toBe('App1');
    });

    it('完整 URL 精确匹配优先于路径前缀匹配', async () => {
      await addSystem('Prefix', 'https://example.com/app', 0);
      await addSystem('Exact', 'https://example.com/app/login', 1);

      const system = await autoFillService.findSystemByUrl('https://example.com/app/login');
      expect(system?.name).toBe('Exact');
    });

    it('同一 IP 的兄弟路径不会互相误配（/app 不匹配 /app2）', async () => {
      await addSystem('App 1', 'http://10.0.0.5:8080/app', 0);
      await addSystem('App 2', 'http://10.0.0.5:8080/app2', 1);

      expect((await autoFillService.findSystemByUrl('http://10.0.0.5:8080/app2/login'))?.name).toBe('App 2');
      expect((await autoFillService.findSystemByUrl('http://10.0.0.5:8080/app/login'))?.name).toBe('App 1');
      expect(await autoFillService.findSystemByUrl('http://10.0.0.5:8080/application/login')).toBeUndefined();
    });

    it('更深的路径优先', async () => {
      await addSystem('App', 'https://example.com/app', 0);
      await addSystem('App Admin', 'https://example.com/app/admin', 1);

      const system = await autoFillService.findSystemByUrl('https://example.com/app/admin/users');
      expect(system?.name).toBe('App Admin');
    });

    it('同域 hash 路由的 SPA 项目可正确区分', async () => {
      await addSystem('Project A', 'https://example.com/#/project-a', 0);
      await addSystem('Project B', 'https://example.com/#/project-b', 1);

      const system = await autoFillService.findSystemByUrl('https://example.com/#/project-b/login');
      expect(system?.name).toBe('Project B');
    });

    it('查询参数可用于区分同路径系统', async () => {
      await addSystem('Project A', 'https://example.com/login?project=a', 0);
      await addSystem('Project B', 'https://example.com/login?project=b', 1);

      const system = await autoFillService.findSystemByUrl('https://example.com/login?project=b');
      expect(system?.name).toBe('Project B');
    });

    it('同 host 同路径时按协议区分 http/https 记录', async () => {
      await addSystem('HTTP 服务', 'http://example.com', 0);
      await addSystem('HTTPS 服务', 'https://example.com', 1);

      expect((await autoFillService.findSystemByUrl('http://example.com/login'))?.name).toBe('HTTP 服务');
      expect((await autoFillService.findSystemByUrl('https://example.com/login'))?.name).toBe('HTTPS 服务');
    });

    it('没有匹配的系统时返回 undefined', async () => {
      await addSystem('Root', 'https://example.com', 0);
      expect(await autoFillService.findSystemByUrl('https://other.com/login')).toBeUndefined();
    });

    it('多个系统同样精确时返回 undefined，不再默认取第一条', async () => {
      await addSystem('Project A', 'https://example.com', 0);
      await addSystem('Project B', 'https://example.com', 1);

      expect(await autoFillService.findSystemByUrl('https://example.com/login')).toBeUndefined();
    });
  });

  describe('findDefaultAccountForUrl', () => {
    it('唯一匹配时返回该系统的默认账号', async () => {
      const systemId = await addSystem('App', 'https://example.com/app', 0);
      await addAccount(systemId, 'other', 'other-password', false);
      await addAccount(systemId, 'admin', 'app-password', true);

      const match = await autoFillService.findDefaultAccountForUrl('https://example.com/app/login');
      expect(match?.systemName).toBe('App');
      expect(match?.account.username).toBe('admin');
      expect(match?.account.plainPassword).toBe('app-password');
    });

    it('同域多服务时只返回当前路径对应系统的密码', async () => {
      const app1 = await addSystem('App 1', 'http://10.0.0.5:8080/app1', 0);
      const app2 = await addSystem('App 2', 'http://10.0.0.5:8080/app2', 1);
      await addAccount(app1, 'user1', 'password-1');
      await addAccount(app2, 'user2', 'password-2');

      const match = await autoFillService.findDefaultAccountForUrl('http://10.0.0.5:8080/app2/login');
      expect(match?.systemName).toBe('App 2');
      expect(match?.account.plainPassword).toBe('password-2');
    });

    it('多个系统同样精确时返回 null，宁可不填也不填错', async () => {
      const a = await addSystem('Project A', 'https://example.com', 0);
      const b = await addSystem('Project B', 'https://example.com', 1);
      await addAccount(a, 'usera', 'password-a');
      await addAccount(b, 'userb', 'password-b');

      expect(await autoFillService.findDefaultAccountForUrl('https://example.com/login')).toBeNull();
    });
  });

  describe('resolveForUrl', () => {
    it('唯一系统有多个账号时直接返回默认账号，不展示账号选择列表', async () => {
      const systemId = await addSystem('App', 'https://example.com/app', 0);
      await addAccount(systemId, 'other', 'other-password', false);
      await addAccount(systemId, 'admin', 'app-password', true);

      const resolution = await autoFillService.resolveForUrl('https://example.com/app/login');
      expect(resolution.autoFill?.account.username).toBe('admin');
      expect(resolution.picker).toEqual([]);
    });

    it('唯一系统有多个账号但没有默认账号时交给用户选择', async () => {
      const systemId = await addSystem('App', 'https://example.com/app', 0);
      await addAccount(systemId, 'user1', 'password-1', false);
      await addAccount(systemId, 'user2', 'password-2', false);

      const resolution = await autoFillService.resolveForUrl('https://example.com/app/login');
      expect(resolution.autoFill).toBeNull();
      expect(resolution.picker.map(m => m.account.username).sort()).toEqual(['user1', 'user2']);
    });

    it('多个系统并列匹配时交给用户选择，不自动填默认账号', async () => {
      const a = await addSystem('Project A', 'https://example.com', 0);
      const b = await addSystem('Project B', 'https://example.com', 1);
      await addAccount(a, 'usera', 'password-a');
      await addAccount(b, 'userb', 'password-b');

      const resolution = await autoFillService.resolveForUrl('https://example.com/login');
      expect(resolution.autoFill).toBeNull();
      expect(resolution.picker.map(m => m.account.username)).toEqual(['usera', 'userb']);
    });

    it('存在多个默认账号时取创建时间最早的一个', async () => {
      const systemId = await addSystem('App', 'https://example.com/app', 0);
      await db.accounts.add({
        id: 'acc-early',
        systemId,
        role: 'admin',
        username: 'early',
        password: { __encrypted: false, value: 'early-password' },
        isDefault: true,
        createdAt: 1000,
        updatedAt: 1000,
      });
      await db.accounts.add({
        id: 'acc-late',
        systemId,
        role: 'admin',
        username: 'late',
        password: { __encrypted: false, value: 'late-password' },
        isDefault: true,
        createdAt: 2000,
        updatedAt: 2000,
      });

      const resolution = await autoFillService.resolveForUrl('https://example.com/app/login');
      expect(resolution.autoFill?.account.username).toBe('early');
    });
  });

  describe('findAccountsForUrl', () => {
    it('多个系统同样精确时返回所有候选账号，供手动选择', async () => {
      const a = await addSystem('Project A', 'https://example.com', 0);
      const b = await addSystem('Project B', 'https://example.com', 1);
      await addAccount(a, 'usera', 'password-a');
      await addAccount(b, 'userb', 'password-b');

      const matches = await autoFillService.findAccountsForUrl('https://example.com/login');
      expect(matches).toHaveLength(2);
      expect(matches.map(m => m.systemName)).toEqual(['Project A', 'Project B']);
      expect(matches.map(m => m.account.plainPassword)).toEqual(['password-a', 'password-b']);
    });
  });
});
