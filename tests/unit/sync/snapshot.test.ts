import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { cryptoSession } from '../../../src/shared/crypto/session';
import { cryptoService } from '../../../src/shared/services/cryptoService';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import { serverRepo } from '../../../src/shared/db/repositories/serverRepo';
import { accountRepo } from '../../../src/shared/db/repositories/accountRepo';
import { tagRepo } from '../../../src/shared/db/repositories/tagRepo';
import { groupRepo } from '../../../src/shared/db/repositories/groupRepo';
import { systemTagRepo } from '../../../src/shared/db/repositories/systemTagRepo';
import { buildLocalSnapshot, VaultLockedError } from '../../../src/shared/sync/snapshotBuilder';
import { applyRemoteSnapshot } from '../../../src/shared/sync/snapshotApply';
import { buildTombstones } from '../../../src/shared/sync/tombstones';
import { recordDeletion } from '../../../src/shared/db/deletionLog';
import {
  emptySnapshotData,
  emptyTombstones,
  indexFromData,
  type SnapshotData,
  type SyncSnapshot,
  type SystemRec,
} from '../../../shared/protocol/index';

function remoteSnapshot(data: Partial<SnapshotData>): SyncSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: Date.now(),
    data: { ...emptySnapshotData(), ...data },
  };
}

function remoteSystem(id: string, updatedAt: number, patch: Partial<SystemRec> = {}): SystemRec {
  return {
    id,
    name: id,
    url: `https://${id}.example.com`,
    environment: 'development',
    favorite: false,
    sort: 0,
    createdAt: 1,
    updatedAt,
    tagIds: [],
    ...patch,
  };
}

describe('snapshot build / apply', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    cryptoSession.lock();
  });

  it('builds a plaintext snapshot with tag membership', async () => {
    const groupId = await groupRepo.create({ entityType: 'system', name: 'CORS', color: '#10B981', sortOrder: 0 });
    const tagId = await tagRepo.create({ name: 'prod' });
    const systemId = await systemRepo.create({
      name: 'Jenkins', url: 'https://jenkins.example.com', environment: 'production',
      favorite: true, sort: 0, groupId,
    });
    await systemTagRepo.replaceAll(systemId, [tagId]);
    await accountRepo.create({
      systemId, role: 'root', username: 'root',
      password: { __encrypted: false, value: 'acc-secret' },
      isDefault: true,
    });

    const snapshot = await buildLocalSnapshot();
    const system = snapshot.data.systems.find(item => item.id === systemId);
    expect(system?.tagIds).toEqual([tagId]);
    expect(system?.groupId).toBe(groupId);
    expect(snapshot.data.tags[0]).toMatchObject({ id: tagId, name: 'prod' });
    expect(snapshot.data.accounts[0].password).toBe('acc-secret');
  });

  it('refuses to build a snapshot while the vault is locked', async () => {
    await cryptoService.setPassword('mysecret');
    cryptoSession.lock();
    await expect(buildLocalSnapshot()).rejects.toBeInstanceOf(VaultLockedError);
  });

  it('applies remote changes without deleting local-only records', async () => {
    const localSystemId = await systemRepo.create({
      name: 'Old name', url: 'https://a.example.com', environment: 'development',
      favorite: false, sort: 0,
    });
    const localSystem = (await systemRepo.byId(localSystemId))!;
    const localOnlyServerId = await serverRepo.create({
      name: 'local-only', ip: '10.0.0.1', sshPort: 22, username: 'root',
      password: { __encrypted: false, value: 'x' }, environment: 'development', favorite: false,
    });

    const remoteUpdatedAt = localSystem.updatedAt + 1000;
    const remote = remoteSnapshot({
      groups: [{ id: 'g1', entityType: 'system', name: 'CORS', color: '#10B981', createdAt: 1, updatedAt: 10 }],
      tags: [{ id: 't1', name: 'prod', createdAt: 1, updatedAt: 10 }],
      systems: [remoteSystem(localSystemId, remoteUpdatedAt, {
        name: 'New name', groupId: 'g1', tagIds: ['t1'],
      }), remoteSystem('new-system', remoteUpdatedAt)],
      accounts: [{
        id: 'new-account', systemId: localSystemId, role: 'root', username: 'root',
        password: 'remote-pass', isDefault: true, createdAt: 1, updatedAt: remoteUpdatedAt,
      }],
    });

    const summary = await applyRemoteSnapshot(remote);

    expect((await systemRepo.byId(localSystemId))?.name).toBe('New name');
    expect((await systemRepo.byId(localSystemId))?.updatedAt).toBe(remoteUpdatedAt);
    expect(await systemRepo.byId('new-system')).toBeTruthy();
    expect(await serverRepo.byId(localOnlyServerId)).toBeTruthy();
    expect(await systemTagRepo.tagsFor(localSystemId)).toEqual(['t1']);
    const account = (await accountRepo.bySystemId(localSystemId))[0];
    expect(account.password.__encrypted).toBe(false);
    if (!account.password.__encrypted) expect(account.password.value).toBe('remote-pass');
    expect(summary.added + summary.updated).toBeGreaterThanOrEqual(5);
  });

  it('keeps a newer local record and does not resurrect cloud-deleted records', async () => {
    const localId = await systemRepo.create({
      name: 'Local', url: 'https://local.example.com', environment: 'development',
      favorite: false, sort: 0,
    });
    const local = (await systemRepo.byId(localId))!;

    const olderRemote = remoteSnapshot({
      systems: [remoteSystem(localId, local.updatedAt - 1000, { name: 'Cloud older' })],
    });
    const skipped = await applyRemoteSnapshot(olderRemote);
    expect((await systemRepo.byId(localId))?.name).toBe('Local');
    expect(skipped.skippedLocalNewer).toBe(1);

    const tombstones = emptyTombstones();
    tombstones.systems[localId] = local.updatedAt + 1000;
    const deleted = await applyRemoteSnapshot(remoteSnapshot({}), tombstones);
    expect(await systemRepo.byId(localId)).toBeTruthy();
    expect(deleted.skippedCloudDeleted).toBe(1);

    const deletedRemote = remoteSnapshot({
      systems: [remoteSystem('ghost', local.updatedAt)],
    });
    const ghostTombstones = emptyTombstones();
    ghostTombstones.systems.ghost = local.updatedAt;
    await applyRemoteSnapshot(deletedRemote, ghostTombstones);
    expect(await systemRepo.byId('ghost')).toBeUndefined();
  });

  it('re-encrypts sensitive fields when the vault is enabled', async () => {
    await cryptoService.setPassword('mysecret');
    const remote = remoteSnapshot({
      systems: [remoteSystem('s1', 300)],
      accounts: [{
        id: 'a1', systemId: 's1', role: 'root', username: 'root',
        password: 'plain-remote-secret', isDefault: true, createdAt: 1, updatedAt: 300,
      }],
    });

    await applyRemoteSnapshot(remote);
    const account = (await accountRepo.bySystemId('s1'))[0];
    expect(account.password.__encrypted).toBe(true);
    expect(await cryptoService.decryptField(account.password)).toBe('plain-remote-secret');
  });
});

describe('tombstone construction', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('uses explicit deletions and infers missing ids from the previous index', async () => {
    await recordDeletion('system', 'explicit', 2000);
    const current = indexFromData(emptySnapshotData());
    const previous = indexFromData({
      ...emptySnapshotData(),
      systems: [remoteSystem('missing', 100), remoteSystem('explicit', 100)],
    });

    const tombstones = await buildTombstones(current, previous, 1000);
    expect(tombstones.systems.explicit).toBe(2000);
    expect(tombstones.systems.missing).toBe(1000);
  });

  it('does not infer deletions without a previous baseline', async () => {
    const current = indexFromData(emptySnapshotData());
    const tombstones = await buildTombstones(current, null, 1000);
    expect(tombstones.systems).toEqual({});
  });
});
