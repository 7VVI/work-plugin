import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import type { SystemInput } from '../../../src/shared/types/entities';

const sampleSystem: SystemInput = {
  name: 'Test System',
  url: 'https://test.example.com',
  environment: 'development',
  favorite: false,
  sort: 0,
};

describe('systemRepo', () => {
  beforeEach(async () => {
    await db.systems.clear();
    await db.systemTags.clear();
  });

  it('creates a system and returns its id', async () => {
    const id = await systemRepo.create(sampleSystem);
    expect(id).toMatch(/^[0-9a-f-]+$/);
    const stored = await db.systems.get(id);
    expect(stored?.name).toBe('Test System');
    expect(stored?.createdAt).toBeGreaterThan(0);
  });

  it('lists all systems sorted by sort field', async () => {
    await systemRepo.create({ ...sampleSystem, name: 'B', sort: 2 });
    await systemRepo.create({ ...sampleSystem, name: 'A', sort: 1 });
    const all = await systemRepo.all();
    expect(all[0].name).toBe('A');
    expect(all[1].name).toBe('B');
  });

  it('gets system by id', async () => {
    const id = await systemRepo.create(sampleSystem);
    const system = await systemRepo.byId(id);
    expect(system?.name).toBe('Test System');
  });

  it('updates a system', async () => {
    const id = await systemRepo.create(sampleSystem);
    await systemRepo.update(id, { name: 'Updated' });
    const updated = await systemRepo.byId(id);
    expect(updated?.name).toBe('Updated');
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(updated!.createdAt);
  });

  it('deletes a system and its tag associations', async () => {
    const id = await systemRepo.create(sampleSystem);
    await db.systemTags.add({ systemId: id, tagId: 'tag1' });
    await systemRepo.delete(id);
    expect(await systemRepo.byId(id)).toBeUndefined();
    const tags = await db.systemTags.where('systemId').equals(id).toArray();
    expect(tags).toHaveLength(0);
  });

  it('returns favorites only', async () => {
    await systemRepo.create({ ...sampleSystem, favorite: false });
    await systemRepo.create({ ...sampleSystem, name: 'Fav', favorite: true });
    const favs = await systemRepo.favorites();
    expect(favs).toHaveLength(1);
    expect(favs[0].name).toBe('Fav');
  });

  it('searches by name, url, and remark (case-insensitive substring)', async () => {
    await systemRepo.create({ ...sampleSystem, name: 'Redis Admin', url: 'https://redis.example.com', remark: 'Cache layer' });
    await systemRepo.create({ ...sampleSystem, name: 'MySQL', url: 'https://mysql.example.com', remark: 'Primary DB' });
    const results = await systemRepo.search('redis');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Redis Admin');
  });
});
