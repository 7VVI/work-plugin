import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  computeStateHash,
  emptySnapshotData,
  emptyTombstones,
  mergeServerState,
  type AccountRec,
  type ConfigDefRec,
  type ServerState,
  type SnapshotData,
  type SystemRec,
  type TagRec,
} from '../../../shared/protocol/index';

function tag(id: string, updatedAt = 100): TagRec {
  return { id, name: id, createdAt: 1, updatedAt };
}

function system(id: string, updatedAt = 100, patch: Partial<SystemRec> = {}): SystemRec {
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

function account(id: string, systemId: string, updatedAt = 100, patch: Partial<AccountRec> = {}): AccountRec {
  return {
    id,
    systemId,
    role: 'admin',
    username: id,
    password: 'secret',
    isDefault: false,
    createdAt: 1,
    updatedAt,
    ...patch,
  };
}

function project(id: string, updatedAt = 100) {
  return { id, name: id, createdAt: 1, updatedAt };
}

function config(id: string, projectId: string, updatedAt = 100): ConfigDefRec {
  return { id, projectId, name: id, fields: [], createdAt: 1, updatedAt };
}

function state(data: Partial<SnapshotData> = {}, revision = 1): ServerState {
  return {
    revision,
    snapshot: {
      schemaVersion: 1,
      generatedAt: 1,
      data: { ...emptySnapshotData(), ...data },
    },
    tombstones: emptyTombstones(),
  };
}

function incoming(data: Partial<SnapshotData>, tombstones = emptyTombstones()) {
  return {
    snapshot: { schemaVersion: 1 as const, generatedAt: 2, data: { ...emptySnapshotData(), ...data } },
    tombstones,
  };
}

describe('cloud protocol', () => {
  it('canonicalizes object keys and normalizes collection order', async () => {
    expect(canonicalize({ b: 1, a: { d: 4, c: 3 } }))
      .toBe(canonicalize({ a: { c: 3, d: 4 }, b: 1 }));

    const first = await computeStateHash(
      { ...emptySnapshotData(), systems: [system('b'), system('a')] },
      emptyTombstones(),
    );
    const second = await computeStateHash(
      { ...emptySnapshotData(), systems: [system('a'), system('b')] },
      emptyTombstones(),
    );
    expect(first).toBe(second);

    const changed = await computeStateHash(
      { ...emptySnapshotData(), systems: [system('a', 200), system('b')] },
      emptyTombstones(),
    );
    expect(changed).not.toBe(first);
  });

  it('adds newer records and ignores older ones', () => {
    const current = state({ systems: [system('a', 200)] });
    const { state: merged, stats } = mergeServerState(
      current,
      incoming({ systems: [system('a', 100), system('b', 300)] }),
      500,
    );
    expect(merged.snapshot.data.systems.map(item => item.id)).toEqual(['a', 'b']);
    expect(merged.snapshot.data.systems.find(item => item.id === 'a')?.updatedAt).toBe(200);
    expect(stats.ignoredOlder).toBe(1);
    expect(stats.applied).toBe(1);
  });

  it('rejects records older than a tombstone and allows newer resurrection', () => {
    const tombstones = emptyTombstones();
    tombstones.systems.a = 100;

    const rejected = mergeServerState(state(), incoming({ systems: [system('a', 100)] }, tombstones), 500);
    expect(rejected.state.snapshot.data.systems).toHaveLength(0);
    expect(rejected.stats.rejectedByTombstone).toBe(1);
    expect(rejected.state.tombstones.systems.a).toBe(100);

    const resurrected = mergeServerState(state(), incoming({ systems: [system('a', 200)] }, tombstones), 500);
    expect(resurrected.state.snapshot.data.systems.map(item => item.id)).toEqual(['a']);
    expect(resurrected.state.tombstones.systems.a).toBeUndefined();
  });

  it('drops orphans and unknown tag/group references', () => {
    const { state: merged, stats } = mergeServerState(
      state(),
      incoming({
        systems: [system('s1', 100, { tagIds: ['missing'], groupId: 'missing-group' })],
        accounts: [account('a1', 'missing-system')],
        configProjects: [project('p1')],
        configDefs: [config('c1', 'missing-project')],
      }),
      500,
    );

    const mergedSystem = merged.snapshot.data.systems[0];
    expect(mergedSystem.tagIds).toEqual([]);
    expect(mergedSystem.groupId).toBeUndefined();
    expect(merged.snapshot.data.accounts).toHaveLength(0);
    expect(merged.snapshot.data.configDefs).toHaveLength(0);
    expect(stats.droppedOrphans).toBe(2);
  });

  it('keeps exactly one default account per system', () => {
    const { state: merged } = mergeServerState(
      state(),
      incoming({
        systems: [system('s1')],
        accounts: [
          account('a1', 's1', 100, { isDefault: true }),
          account('a2', 's1', 200, { isDefault: true }),
          account('a3', 's1', 50, { isDefault: false }),
        ],
      }),
      500,
    );

    const accounts = merged.snapshot.data.accounts;
    expect(accounts.find(item => item.isDefault)?.id).toBe('a2');
    expect(accounts.filter(item => item.isDefault)).toHaveLength(1);
  });

  it('keeps tags unique and sorted on systems', () => {
    const { state: merged } = mergeServerState(
      state(),
      incoming({
        tags: [tag('t1'), tag('t2')],
        systems: [system('s1', 100, { tagIds: ['t2', 't1', 't2'] })],
      }),
      500,
    );
    expect(merged.snapshot.data.systems[0].tagIds).toEqual(['t1', 't2']);
  });
});
