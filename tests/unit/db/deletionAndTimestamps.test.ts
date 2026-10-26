import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import { serverRepo } from '../../../src/shared/db/repositories/serverRepo';
import { tagRepo } from '../../../src/shared/db/repositories/tagRepo';
import { systemTagRepo } from '../../../src/shared/db/repositories/systemTagRepo';
import { groupRepo } from '../../../src/shared/db/repositories/groupRepo';
import { deletionId } from '../../../src/shared/db/deletionLog';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('deletion ledger and parent timestamps', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('tag create sets updatedAt', async () => {
    const id = await tagRepo.create({ name: 'prod', color: '#2E6BF0' });
    const tag = await tagRepo.byId(id);
    expect(tag?.updatedAt).toBeTypeOf('number');
    expect(tag?.updatedAt).toBe(tag?.createdAt);
  });

  it('deleting a tag records deletion and bumps affected assets', async () => {
    const systemId = await systemRepo.create({
      name: 'S', url: 'https://s.example.com', environment: 'development', favorite: false, sort: 0,
    });
    const tagId = await tagRepo.create({ name: 'prod' });
    await systemTagRepo.replaceAll(systemId, [tagId]);
    const before = (await systemRepo.byId(systemId))!.updatedAt;

    await sleep(5);
    await tagRepo.delete(tagId);

    expect(await tagRepo.byId(tagId)).toBeUndefined();
    expect(await systemTagRepo.tagsFor(systemId)).toEqual([]);
    expect((await systemRepo.byId(systemId))!.updatedAt).toBeGreaterThan(before);
    expect(await db.deletions.get(deletionId('tag', tagId))).toMatchObject({
      entityType: 'tag',
      entityId: tagId,
    });
  });

  it('replacing tags only bumps the parent when membership changes', async () => {
    const systemId = await systemRepo.create({
      name: 'S', url: 'https://s.example.com', environment: 'development', favorite: false, sort: 0,
    });
    const tagId = await tagRepo.create({ name: 'prod' });

    await systemTagRepo.replaceAll(systemId, [tagId]);
    const afterFirst = (await systemRepo.byId(systemId))!.updatedAt;
    await sleep(5);
    await systemTagRepo.replaceAll(systemId, [tagId]);
    expect((await systemRepo.byId(systemId))!.updatedAt).toBe(afterFirst);

    await sleep(5);
    await systemTagRepo.replaceAll(systemId, []);
    expect((await systemRepo.byId(systemId))!.updatedAt).toBeGreaterThan(afterFirst);
  });

  it('removing a group clears groupId, bumps asset timestamp and records deletion', async () => {
    const groupId = await groupRepo.create({
      entityType: 'system', name: 'CORS', color: '#10B981', sortOrder: 0,
    });
    const systemId = await systemRepo.create({
      name: 'S', url: 'https://s.example.com', environment: 'development',
      favorite: false, sort: 0, groupId,
    });
    const before = (await systemRepo.byId(systemId))!.updatedAt;

    await sleep(5);
    await groupRepo.remove(groupId, 'system');

    const system = await systemRepo.byId(systemId);
    expect(system?.groupId).toBeUndefined();
    expect(system!.updatedAt).toBeGreaterThan(before);
    expect(await db.deletions.get(deletionId('group', groupId))).toMatchObject({
      entityType: 'group',
      entityId: groupId,
    });
  });

  it('clearing groups records a deletion for each group', async () => {
    const first = await groupRepo.create({ entityType: 'system', name: 'A', color: '#2E6BF0', sortOrder: 0 });
    const second = await groupRepo.create({ entityType: 'server', name: 'B', color: '#10B981', sortOrder: 1 });

    await groupRepo.clear();

    expect(await db.groups.count()).toBe(0);
    expect(await db.deletions.get(deletionId('group', first))).toMatchObject({
      entityType: 'group',
      entityId: first,
    });
    expect(await db.deletions.get(deletionId('group', second))).toMatchObject({
      entityType: 'group',
      entityId: second,
    });
  });

  it('deleting an asset records a deletion entry', async () => {
    const serverId = await serverRepo.create({
      name: 'S', ip: '10.0.0.1', sshPort: 22, username: 'root',
      password: { __encrypted: false, value: 'x' },
      environment: 'development', favorite: false,
    });

    await serverRepo.delete(serverId);

    expect(await serverRepo.byId(serverId)).toBeUndefined();
    expect(await db.deletions.get(deletionId('server', serverId))).toMatchObject({
      entityType: 'server',
      entityId: serverId,
    });
  });
});
