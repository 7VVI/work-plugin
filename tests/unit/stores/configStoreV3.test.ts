import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { db } from '../../../src/shared/db/schema';
import { configProjectRepo } from '../../../src/shared/db/repositories/configProjectRepo';
import { configDefRepo } from '../../../src/shared/db/repositories/configDefRepo';
import { useConfigStoreV3 } from '../../../src/shared/stores/configStoreV3';

describe('configStoreV3', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.configProjects.clear();
    await db.configDefs.clear();
  });

  it('moves a selected config to another project and keeps it selected', async () => {
    const p1 = await configProjectRepo.create('P1');
    const p2 = await configProjectRepo.create('P2');
    const a = await configDefRepo.create(p1, 'a');
    await configDefRepo.create(p1, 'b');
    await configDefRepo.create(p2, 'x');

    const store = useConfigStoreV3();
    await store.loadProjects();
    expect(store.selectedProjectId).toBe(p1);
    expect(store.selectedConfigId).toBe(a);

    await store.moveConfig(a, p2, 1);

    expect(store.selectedProjectId).toBe(p2);
    expect(store.selectedConfigId).toBe(a);
    expect(store.selectedConfig?.name).toBe('a');
    expect(store.projectConfigs[p1].map(c => c.name)).toEqual(['b']);
    expect(store.projectConfigs[p2].map(c => c.name)).toEqual(['x', 'a']);
    expect(store.configCounts[p1]).toBe(1);
    expect(store.configCounts[p2]).toBe(2);
  });

  it('reordering a non-selected project keeps the right-panel configs', async () => {
    const p1 = await configProjectRepo.create('P1');
    const p2 = await configProjectRepo.create('P2');
    await configDefRepo.create(p1, 'a');
    const x = await configDefRepo.create(p2, 'x');
    const y = await configDefRepo.create(p2, 'y');

    const store = useConfigStoreV3();
    await store.loadProjects();
    expect(store.selectedProjectId).toBe(p1);
    expect(store.configs.map(c => c.name)).toEqual(['a']);

    await store.reorderConfigs(p2, [y, x]);

    expect(store.selectedProjectId).toBe(p1);
    expect(store.configs.map(c => c.name)).toEqual(['a']);
    expect(store.projectConfigs[p2].map(c => c.name)).toEqual(['y', 'x']);
  });
});
