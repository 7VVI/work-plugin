import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import { autoFillService } from '../../../src/shared/services/autoFillService';
import type { SystemInput } from '../../../src/shared/types/entities';

const sampleSystem: SystemInput = {
  name: 'Test System',
  url: 'https://test.example.com',
  environment: 'development',
  favorite: false,
  sort: 0,
};

describe('autoFillService.findSystemByUrl', () => {
  beforeEach(async () => {
    await db.systems.clear();
  });

  it('同 host 不同端口时，选中端口匹配的那个系统而不是第一个记录', async () => {
    // 故意先记录 8080，再记录 3000
    await systemRepo.create({ ...sampleSystem, name: 'Backend 8080', url: 'http://localhost:8080', sort: 0 });
    await systemRepo.create({ ...sampleSystem, name: 'Backend 3000', url: 'http://localhost:3000', sort: 1 });

    const system = await autoFillService.findSystemByUrl('http://localhost:3000/api/login');
    expect(system?.name).toBe('Backend 3000');
  });

  it('同域不同路径时，选中路径更精确的那个系统', async () => {
    await systemRepo.create({ ...sampleSystem, name: 'Root', url: 'https://example.com', sort: 0 });
    await systemRepo.create({ ...sampleSystem, name: 'App1', url: 'https://example.com/app1', sort: 1 });

    const system = await autoFillService.findSystemByUrl('https://example.com/app1/dashboard');
    expect(system?.name).toBe('App1');
  });

  it('完整 URL 精确匹配优先于路径前缀匹配', async () => {
    await systemRepo.create({ ...sampleSystem, name: 'Prefix', url: 'https://example.com/app', sort: 0 });
    await systemRepo.create({ ...sampleSystem, name: 'Exact', url: 'https://example.com/app/login', sort: 1 });

    const system = await autoFillService.findSystemByUrl('https://example.com/app/login');
    expect(system?.name).toBe('Exact');
  });

  it('没有匹配的系统时返回 undefined', async () => {
    await systemRepo.create({ ...sampleSystem, url: 'https://example.com' });
    expect(await autoFillService.findSystemByUrl('https://other.com/login')).toBeUndefined();
  });
});
