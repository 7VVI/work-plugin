import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { configDefRepo } from '../../../src/shared/db/repositories/configDefRepo';

describe('configDefRepo', () => {
  beforeEach(async () => {
    await db.configDefs.clear();
  });

  it('assigns increasing sortOrder when creating configs', async () => {
    const a = await configDefRepo.create('p1', 'a');
    const b = await configDefRepo.create('p1', 'b');
    const c = await configDefRepo.create('p2', 'c');

    const p1 = await configDefRepo.byProject('p1');
    expect(p1.map(x => x.name)).toEqual(['a', 'b']);
    expect(p1.map(x => x.sortOrder)).toEqual([0, 1]);
    expect((await configDefRepo.byId(c))?.sortOrder).toBe(0);
    expect((await configDefRepo.byId(a))?.sortOrder).toBe(0);
    expect((await configDefRepo.byId(b))?.sortOrder).toBe(1);
  });

  it('lists configs by sortOrder', async () => {
    await configDefRepo.create('p1', 'third', undefined, 2);
    await configDefRepo.create('p1', 'first', undefined, 0);
    await configDefRepo.create('p1', 'second', undefined, 1);

    const configs = await configDefRepo.byProject('p1');
    expect(configs.map(c => c.name)).toEqual(['first', 'second', 'third']);
  });

  it('moves a config to another project and reindexes both projects', async () => {
    const a = await configDefRepo.create('p1', 'a');
    const b = await configDefRepo.create('p1', 'b');
    const c = await configDefRepo.create('p1', 'c');
    const x = await configDefRepo.create('p2', 'x');
    const y = await configDefRepo.create('p2', 'y');

    await configDefRepo.moveToProject(c, 'p2', 1);

    const p1 = await configDefRepo.byProject('p1');
    const p2 = await configDefRepo.byProject('p2');
    expect(p1.map(v => v.name)).toEqual(['a', 'b']);
    expect(p1.map(v => v.sortOrder)).toEqual([0, 1]);
    expect(p2.map(v => v.name)).toEqual(['x', 'c', 'y']);
    expect(p2.map(v => v.sortOrder)).toEqual([0, 1, 2]);
    expect((await configDefRepo.byId(c))?.projectId).toBe('p2');
    expect((await configDefRepo.byId(a))?.projectId).toBe('p1');
    expect((await configDefRepo.byId(b))?.projectId).toBe('p1');
    expect((await configDefRepo.byId(x))?.projectId).toBe('p2');
    expect((await configDefRepo.byId(y))?.projectId).toBe('p2');
  });

  it('appends when the target index exceeds the target list length', async () => {
    const a = await configDefRepo.create('p1', 'a');
    await configDefRepo.create('p2', 'x');

    await configDefRepo.moveToProject(a, 'p2', 99);

    const p2 = await configDefRepo.byProject('p2');
    expect(p2.map(v => v.name)).toEqual(['x', 'a']);
  });

  it('reorders configs within a project', async () => {
    const a = await configDefRepo.create('p1', 'a');
    const b = await configDefRepo.create('p1', 'b');
    const c = await configDefRepo.create('p1', 'c');

    await configDefRepo.reorder('p1', [c, a, b]);

    const configs = await configDefRepo.byProject('p1');
    expect(configs.map(v => v.name)).toEqual(['c', 'a', 'b']);
    expect(configs.map(v => v.sortOrder)).toEqual([0, 1, 2]);
  });
});
