import { db } from '../db/schema';
import { cryptoService } from '../services/cryptoService';
import { base64ToBuffer } from '../db/repositories/noteAssetRepo';
import { VaultLockedError } from './snapshotBuilder';
import type {
  Account,
  ConfigDef,
  ConfigProject,
  Group,
  Middleware,
  Note,
  NoteAsset,
  NoteBook,
  Server,
  System,
  Tag,
} from '../types/entities';
import type {
  SnapshotData,
  SnapshotTable,
  SyncSnapshot,
  TombstoneMap,
} from '@protocol/types';
import {
  SNAPSHOT_TABLES,
  deletionTypeForTable,
  emptyTombstones,
  normalizeSnapshot,
  normalizeTombstones,
} from '@protocol/index';

export interface ApplySummary {
  added: number;
  updated: number;
  skippedLocalNewer: number;
  skippedCloudDeleted: number;
}

interface LocalMaps {
  groups: Map<string, Group>;
  tags: Map<string, Tag>;
  systems: Map<string, System>;
  accounts: Map<string, Account>;
  servers: Map<string, Server>;
  middlewares: Map<string, Middleware>;
  configProjects: Map<string, ConfigProject>;
  configDefs: Map<string, ConfigDef>;
  noteBooks: Map<string, NoteBook>;
  notes: Map<string, Note>;
  noteAssets: Map<string, NoteAsset>;
}

function remoteWins(local: { updatedAt: number } | undefined, remote: { updatedAt: number }): boolean {
  return !local || remote.updatedAt >= local.updatedAt;
}

function countApply<T extends { id: string; updatedAt: number }>(
  summary: ApplySummary,
  local: Map<string, { updatedAt: number }>,
  remote: T,
): void {
  if (remoteWins(local.get(remote.id), remote)) {
    if (local.has(remote.id)) summary.updated++;
    else summary.added++;
  } else {
    summary.skippedLocalNewer++;
  }
}

/**
 * 安全应用远端快照：只新增/更新，不删除本地记录。
 * 依赖顺序：分组/标签/项目 → 资产 → 账号/配置。
 */
export async function applyRemoteSnapshot(
  remote: SyncSnapshot,
  tombstones: TombstoneMap = emptyTombstones(),
): Promise<ApplySummary> {
  if (await cryptoService.isEnabled() && !cryptoService.isUnlocked()) {
    throw new VaultLockedError();
  }

  const data: SnapshotData = normalizeSnapshot(remote).data;
  const safeTombstones = normalizeTombstones(tombstones);

  const [
    localGroups,
    localTags,
    localSystems,
    localAccounts,
    localServers,
    localMiddlewares,
    localProjects,
    localDefs,
    localNoteBooks,
    localNotes,
    localNoteAssets,
  ] = await Promise.all([
    db.groups.toArray(),
    db.tags.toArray(),
    db.systems.toArray(),
    db.accounts.toArray(),
    db.servers.toArray(),
    db.middlewares.toArray(),
    db.configProjects.toArray(),
    db.configDefs.toArray(),
    db.noteBooks.toArray(),
    db.notes.toArray(),
    db.noteAssets.toArray(),
  ]);

  const local: LocalMaps = {
    groups: new Map(localGroups.map(group => [group.id, group])),
    tags: new Map(localTags.map(tag => [tag.id, tag])),
    systems: new Map(localSystems.map(system => [system.id, system])),
    accounts: new Map(localAccounts.map(account => [account.id, account])),
    servers: new Map(localServers.map(server => [server.id, server])),
    middlewares: new Map(localMiddlewares.map(middleware => [middleware.id, middleware])),
    configProjects: new Map(localProjects.map(project => [project.id, project])),
    configDefs: new Map(localDefs.map(config => [config.id, config])),
    noteBooks: new Map(localNoteBooks.map(book => [book.id, book])),
    notes: new Map(localNotes.map(note => [note.id, note])),
    noteAssets: new Map(localNoteAssets.map(asset => [asset.id, asset])),
  };

  const summary: ApplySummary = {
    added: 0,
    updated: 0,
    skippedLocalNewer: 0,
    skippedCloudDeleted: 0,
  };

  const remoteMaps: Record<SnapshotTable, Map<string, { updatedAt: number }>> = {
    groups: new Map(data.groups.map(record => [record.id, record])),
    tags: new Map(data.tags.map(record => [record.id, record])),
    systems: new Map(data.systems.map(record => [record.id, record])),
    accounts: new Map(data.accounts.map(record => [record.id, record])),
    servers: new Map(data.servers.map(record => [record.id, record])),
    middlewares: new Map(data.middlewares.map(record => [record.id, record])),
    configProjects: new Map(data.configProjects.map(record => [record.id, record])),
    configDefs: new Map(data.configDefs.map(record => [record.id, record])),
    noteBooks: new Map(data.noteBooks.map(record => [record.id, record])),
    notes: new Map(data.notes.map(record => [record.id, record])),
    noteAssets: new Map(data.noteAssets.map(record => [record.id, record])),
  };

  // 云端墓碑：不删除本地，但也不再把这些记录从云端重新加回本地
  const cloudDeleted = new Set<string>();
  for (const table of SNAPSHOT_TABLES) {
    for (const [id, deletedAt] of Object.entries(safeTombstones[table])) {
      const remote = remoteMaps[table].get(id);
      if (!remote || remote.updatedAt <= deletedAt) cloudDeleted.add(`${table}:${id}`);
    }
  }
  summary.skippedCloudDeleted = cloudDeleted.size;

  const isCloudDeleted = (table: SnapshotTable, id: string) => cloudDeleted.has(`${table}:${id}`);

  const appliedGroups = data.groups.filter(record => {
    if (isCloudDeleted('groups', record.id)) return false;
    countApply(summary, local.groups, record);
    return remoteWins(local.groups.get(record.id), record);
  });
  const appliedTags = data.tags.filter(record => {
    if (isCloudDeleted('tags', record.id)) return false;
    countApply(summary, local.tags, record);
    return remoteWins(local.tags.get(record.id), record);
  });
  const appliedProjects = data.configProjects.filter(record => {
    if (isCloudDeleted('configProjects', record.id)) return false;
    countApply(summary, local.configProjects, record);
    return remoteWins(local.configProjects.get(record.id), record);
  });
  const appliedNoteBooks = data.noteBooks.filter(record => {
    if (isCloudDeleted('noteBooks', record.id)) return false;
    countApply(summary, local.noteBooks, record);
    return remoteWins(local.noteBooks.get(record.id), record);
  });
  const appliedNotes = data.notes.filter(record => {
    if (isCloudDeleted('notes', record.id)) return false;
    countApply(summary, local.notes, record);
    return remoteWins(local.notes.get(record.id), record);
  });
  const appliedNoteAssets = data.noteAssets.filter(record => {
    if (isCloudDeleted('noteAssets', record.id)) return false;
    countApply(summary, local.noteAssets, record);
    return remoteWins(local.noteAssets.get(record.id), record);
  });

  const groupIds = new Set([...local.groups.keys(), ...appliedGroups.map(group => group.id)]);
  const tagIds = new Set([...local.tags.keys(), ...appliedTags.map(tag => tag.id)]);

  const appliedSystems: System[] = [];
  const systemTagMap = new Map<string, string[]>();
  for (const record of data.systems) {
    if (isCloudDeleted('systems', record.id)) continue;
    const wins = remoteWins(local.systems.get(record.id), record);
    countApply(summary, local.systems, record);
    if (!wins) continue;

    const { tagIds: recordTagIds, ...rest } = record;
    const filteredTags = recordTagIds.filter(tagId => tagIds.has(tagId));
    systemTagMap.set(record.id, filteredTags);
    const system: System = { ...rest };
    if (system.groupId && !groupIds.has(system.groupId)) delete system.groupId;
    appliedSystems.push(system);
  }

  const appliedServers: Server[] = [];
  const serverTagMap = new Map<string, string[]>();
  for (const record of data.servers) {
    if (isCloudDeleted('servers', record.id)) continue;
    const wins = remoteWins(local.servers.get(record.id), record);
    countApply(summary, local.servers, record);
    if (!wins) continue;

    const { tagIds: recordTagIds, password, sshKey, ...rest } = record;
    const filteredTags = recordTagIds.filter(tagId => tagIds.has(tagId));
    serverTagMap.set(record.id, filteredTags);
    const server: Server = {
      ...rest,
      password: await cryptoService.encryptField(password),
      sshKey: sshKey === undefined ? undefined : await cryptoService.encryptField(sshKey),
    };
    if (server.groupId && !groupIds.has(server.groupId)) delete server.groupId;
    appliedServers.push(server);
  }

  const appliedMiddlewares: Middleware[] = [];
  const middlewareTagMap = new Map<string, string[]>();
  for (const record of data.middlewares) {
    if (isCloudDeleted('middlewares', record.id)) continue;
    const wins = remoteWins(local.middlewares.get(record.id), record);
    countApply(summary, local.middlewares, record);
    if (!wins) continue;

    const { tagIds: recordTagIds, password, ...rest } = record;
    const filteredTags = recordTagIds.filter(tagId => tagIds.has(tagId));
    middlewareTagMap.set(record.id, filteredTags);
    const middleware: Middleware = {
      ...rest,
      password: password === undefined ? undefined : await cryptoService.encryptField(password),
    };
    if (middleware.groupId && !groupIds.has(middleware.groupId)) delete middleware.groupId;
    appliedMiddlewares.push(middleware);
  }

  const systemIds = new Set([...local.systems.keys(), ...appliedSystems.map(system => system.id)]);
  const projectIds = new Set([...local.configProjects.keys(), ...appliedProjects.map(project => project.id)]);

  const appliedAccounts: Account[] = [];
  for (const record of data.accounts) {
    if (isCloudDeleted('accounts', record.id)) continue;
    if (!systemIds.has(record.systemId)) continue;
    const wins = remoteWins(local.accounts.get(record.id), record);
    countApply(summary, local.accounts, record);
    if (!wins) continue;
    appliedAccounts.push({
      ...record,
      password: await cryptoService.encryptField(record.password),
    });
  }

  const appliedDefs: ConfigDef[] = [];
  for (const record of data.configDefs) {
    if (isCloudDeleted('configDefs', record.id)) continue;
    if (!projectIds.has(record.projectId)) continue;
    const wins = remoteWins(local.configDefs.get(record.id), record);
    countApply(summary, local.configDefs, record);
    if (!wins) continue;
    appliedDefs.push({ ...record, fields: record.fields.map(field => ({ ...field })) });
  }

  const appliedRecords: Array<{ table: SnapshotTable; id: string; updatedAt: number }> = [
    ...appliedGroups.map(record => ({ table: 'groups' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedTags.map(record => ({ table: 'tags' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedSystems.map(record => ({ table: 'systems' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedAccounts.map(record => ({ table: 'accounts' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedServers.map(record => ({ table: 'servers' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedMiddlewares.map(record => ({ table: 'middlewares' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedProjects.map(record => ({ table: 'configProjects' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedDefs.map(record => ({ table: 'configDefs' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedNoteBooks.map(record => ({ table: 'noteBooks' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedNotes.map(record => ({ table: 'notes' as const, id: record.id, updatedAt: record.updatedAt })),
    ...appliedNoteAssets.map(record => ({ table: 'noteAssets' as const, id: record.id, updatedAt: record.updatedAt })),
  ];

  await db.transaction(
    'rw',
    [
      db.groups, db.tags, db.systems, db.accounts, db.servers, db.middlewares,
      db.configProjects, db.configDefs, db.systemTags, db.serverTags, db.middlewareTags, db.deletions,
      db.noteBooks, db.notes, db.noteAssets,
    ],
    async () => {
      if (appliedGroups.length) await db.groups.bulkPut(appliedGroups);
      if (appliedTags.length) await db.tags.bulkPut(appliedTags);
      if (appliedProjects.length) await db.configProjects.bulkPut(appliedProjects);
      if (appliedSystems.length) await db.systems.bulkPut(appliedSystems);
      if (appliedAccounts.length) await db.accounts.bulkPut(appliedAccounts);
      if (appliedServers.length) await db.servers.bulkPut(appliedServers);
      if (appliedMiddlewares.length) await db.middlewares.bulkPut(appliedMiddlewares);
      if (appliedDefs.length) await db.configDefs.bulkPut(appliedDefs);
      if (appliedNoteBooks.length) await db.noteBooks.bulkPut(appliedNoteBooks);
      if (appliedNotes.length) await db.notes.bulkPut(appliedNotes);
      if (appliedNoteAssets.length) {
        await db.noteAssets.bulkPut(appliedNoteAssets.map(record => ({
          id: record.id,
          mime: record.mime,
          size: record.size,
          hash: record.hash,
          data: base64ToBuffer(record.data),
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })));
      }

      for (const system of appliedSystems) {
        await db.systemTags.where('systemId').equals(system.id).delete();
        const tagRows = (systemTagMap.get(system.id) ?? []).map(tagId => ({ systemId: system.id, tagId }));
        if (tagRows.length) await db.systemTags.bulkAdd(tagRows);
      }
      for (const server of appliedServers) {
        await db.serverTags.where('serverId').equals(server.id).delete();
        const tagRows = (serverTagMap.get(server.id) ?? []).map(tagId => ({ serverId: server.id, tagId }));
        if (tagRows.length) await db.serverTags.bulkAdd(tagRows);
      }
      for (const middleware of appliedMiddlewares) {
        await db.middlewareTags.where('middlewareId').equals(middleware.id).delete();
        const tagRows = (middlewareTagMap.get(middleware.id) ?? []).map(tagId => ({ middlewareId: middleware.id, tagId }));
        if (tagRows.length) await db.middlewareTags.bulkAdd(tagRows);
      }

      for (const record of appliedRecords) {
        const key = `${deletionTypeForTable(record.table)}:${record.id}`;
        const deletion = await db.deletions.get(key);
        if (deletion && record.updatedAt > deletion.deletedAt) {
          await db.deletions.delete(key);
        }
      }
    },
  );

  return summary;
}
