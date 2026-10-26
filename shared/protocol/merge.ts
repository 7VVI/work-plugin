import { cloneJson, normalizeData, normalizeTombstones } from './normalize';
import type {
  AccountRec,
  ServerState,
  SnapshotTable,
  SyncPushRequest,
  SyncStats,
  SyncSnapshot,
} from './types';

type RecordBase = { id: string; updatedAt: number };

const MERGE_ORDER: SnapshotTable[] = [
  'groups',
  'tags',
  'configProjects',
  'systems',
  'servers',
  'middlewares',
  'accounts',
  'configDefs',
];

/**
 * 服务端安全合并：记录级 LWW + 墓碑；不做任何远端删除以外的破坏性覆盖。
 * revision 由调用方根据内容 hash 决定是否递增。
 */
export function mergeServerState(
  current: ServerState,
  incoming: Pick<SyncPushRequest, 'snapshot' | 'tombstones'>,
  serverTime: number,
): { state: ServerState; stats: SyncStats } {
  const stats: SyncStats = {
    applied: 0,
    ignoredOlder: 0,
    rejectedByTombstone: 0,
    droppedOrphans: 0,
  };

  const data = normalizeData(cloneJson(current.snapshot.data));
  const tombstones = normalizeTombstones(cloneJson(current.tombstones));
  const incomingTombstones = normalizeTombstones(cloneJson(incoming.tombstones));

  for (const table of MERGE_ORDER) {
    for (const [id, deletedAt] of Object.entries(incomingTombstones[table])) {
      tombstones[table][id] = Math.max(tombstones[table][id] ?? 0, deletedAt);
    }
  }

  const recordLists = data as unknown as Record<SnapshotTable, RecordBase[]>;
  const incomingData = normalizeData(incoming.snapshot.data);
  const incomingLists = incomingData as unknown as Record<SnapshotTable, RecordBase[]>;

  // 先让墓碑作用于已有数据；已有记录更新时间更晚则视为复活
  for (const table of MERGE_ORDER) {
    recordLists[table] = recordLists[table].filter(record => {
      const deletedAt = tombstones[table][record.id];
      if (deletedAt === undefined) return true;
      if (deletedAt >= record.updatedAt) return false;
      delete tombstones[table][record.id];
      return true;
    });
  }

  const maps = {} as Record<SnapshotTable, Map<string, RecordBase>>;
  for (const table of MERGE_ORDER) {
    maps[table] = new Map(recordLists[table].map(record => [record.id, record]));
  }

  for (const table of MERGE_ORDER) {
    for (const record of incomingLists[table]) {
      const deletedAt = tombstones[table][record.id];
      if (deletedAt !== undefined && deletedAt >= record.updatedAt) {
        stats.rejectedByTombstone++;
        continue;
      }

      const existing = maps[table].get(record.id);
      if (!existing || record.updatedAt > existing.updatedAt) {
        maps[table].set(record.id, cloneJson(record));
        stats.applied++;
        if (deletedAt !== undefined && record.updatedAt > deletedAt) {
          delete tombstones[table][record.id];
        }
      } else {
        stats.ignoredOlder++;
      }
    }
  }

  for (const table of MERGE_ORDER) {
    recordLists[table] = [...maps[table].values()];
  }

  // 引用完整性：未知标签/分组/父记录直接清理
  const groupIds = new Set(data.groups.map(group => group.id));
  const tagIds = new Set(data.tags.map(tag => tag.id));
  const projectIds = new Set(data.configProjects.map(project => project.id));
  const systemIds = new Set(data.systems.map(system => system.id));

  for (const system of data.systems) {
    system.tagIds = system.tagIds.filter(tagId => tagIds.has(tagId));
    if (system.groupId && !groupIds.has(system.groupId)) delete system.groupId;
  }
  for (const server of data.servers) {
    server.tagIds = server.tagIds.filter(tagId => tagIds.has(tagId));
    if (server.groupId && !groupIds.has(server.groupId)) delete server.groupId;
  }
  for (const middleware of data.middlewares) {
    middleware.tagIds = middleware.tagIds.filter(tagId => tagIds.has(tagId));
    if (middleware.groupId && !groupIds.has(middleware.groupId)) delete middleware.groupId;
  }

  const accountsBefore = data.accounts.length;
  data.accounts = data.accounts.filter(account => systemIds.has(account.systemId));
  stats.droppedOrphans += accountsBefore - data.accounts.length;

  const defsBefore = data.configDefs.length;
  data.configDefs = data.configDefs.filter(config => projectIds.has(config.projectId));
  stats.droppedOrphans += defsBefore - data.configDefs.length;

  normalizeDefaultAccounts(data.accounts);

  const snapshot: SyncSnapshot = {
    schemaVersion: 1,
    generatedAt: serverTime,
    data: normalizeData(data),
  };

  return {
    state: { revision: current.revision, snapshot, tombstones },
    stats,
  };
}

function normalizeDefaultAccounts(accounts: AccountRec[]): void {
  const bySystem = new Map<string, AccountRec[]>();
  for (const account of accounts) {
    const list = bySystem.get(account.systemId) ?? [];
    list.push(account);
    bySystem.set(account.systemId, list);
  }

  for (const list of bySystem.values()) {
    const defaults = list
      .filter(account => account.isDefault)
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    const chosen = defaults[0]
      ?? [...list].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0];
    for (const account of list) account.isDefault = account.id === chosen.id;
  }
}
