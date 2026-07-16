import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import { serverRepo } from '../../../src/shared/db/repositories/serverRepo';
import { searchService } from '../../../src/shared/services/searchService';

describe('searchService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await systemRepo.create({ name: 'Redis Admin', url: 'https://redis.example.com', environment: 'production', favorite: false, sort: 0, remark: 'Cache layer' });
    await systemRepo.create({ name: 'MySQL', url: 'https://mysql.example.com', environment: 'production', favorite: true, sort: 1 });
    await serverRepo.create({ name: 'Redis Server', ip: '10.0.0.5', sshPort: 22, username: 'root', password: { __encrypted: false, value: '' }, environment: 'production', favorite: false });
  });

  it('matches systems by name', async () => {
    const results = await searchService.search('redis');
    expect(results.length).toBeGreaterThanOrEqual(2);
    const types = results.map(r => r.type);
    expect(types).toContain('system');
    expect(types).toContain('server');
  });

  it('matches systems by url', async () => {
    const results = await searchService.search('mysql.example');
    expect(results.some(r => r.type === 'system')).toBe(true);
  });

  it('matches servers by ip', async () => {
    const results = await searchService.search('10.0.0');
    expect(results.some(r => r.type === 'server')).toBe(true);
  });

  it('returns empty for no matches', async () => {
    const results = await searchService.search('zzznomatch');
    expect(results).toHaveLength(0);
  });
});
