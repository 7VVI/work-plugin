import {
  SNAPSHOT_TABLES,
  emptySnapshotIndex,
  emptyTombstones,
  type SnapshotData,
  type SnapshotIndex,
  type SnapshotTable,
  type SyncSnapshot,
  type TombstoneMap,
} from './types';

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueSorted(values: string[] | undefined): string[] {
  return [...new Set(values ?? [])].sort();
}

function sortById<T extends { id: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.id.localeCompare(b.id));
}

function indexOf<T extends { id: string; updatedAt: number }>(list: T[]): Record<string, number> {
  const index: Record<string, number> = {};
  for (const record of list) index[record.id] = record.updatedAt;
  return index;
}

export function normalizeData(data: SnapshotData): SnapshotData {
  return {
    groups: sortById(data.groups ?? []),
    tags: sortById(data.tags ?? []),
    systems: sortById(data.systems ?? []).map(system => ({
      ...system,
      tagIds: uniqueSorted(system.tagIds),
    })),
    accounts: sortById(data.accounts ?? []),
    servers: sortById(data.servers ?? []).map(server => ({
      ...server,
      tagIds: uniqueSorted(server.tagIds),
    })),
    middlewares: sortById(data.middlewares ?? []).map(middleware => ({
      ...middleware,
      tagIds: uniqueSorted(middleware.tagIds),
    })),
    configProjects: sortById(data.configProjects ?? []),
    configDefs: sortById(data.configDefs ?? []).map(config => ({
      ...config,
      fields: config.fields ?? [],
    })),
  };
}

export function normalizeSnapshot(snapshot: SyncSnapshot): SyncSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: snapshot.generatedAt,
    data: normalizeData(snapshot.data),
  };
}

export function normalizeTombstones(tombstones?: Partial<TombstoneMap> | null): TombstoneMap {
  const result = emptyTombstones();
  if (!tombstones) return result;
  for (const table of SNAPSHOT_TABLES) {
    const source = tombstones[table];
    if (!source) continue;
    for (const [id, deletedAt] of Object.entries(source)) {
      if (Number.isFinite(deletedAt)) result[table][id] = deletedAt;
    }
  }
  return result;
}

export function indexFromData(data: SnapshotData): SnapshotIndex {
  const index = emptySnapshotIndex();
  index.groups = indexOf(data.groups);
  index.tags = indexOf(data.tags);
  index.systems = indexOf(data.systems);
  index.accounts = indexOf(data.accounts);
  index.servers = indexOf(data.servers);
  index.middlewares = indexOf(data.middlewares);
  index.configProjects = indexOf(data.configProjects);
  index.configDefs = indexOf(data.configDefs);
  return index;
}

export function indexFromSnapshot(snapshot: SyncSnapshot): SnapshotIndex {
  return indexFromData(normalizeData(snapshot.data));
}

export function tableKeyForDeletionType(entityType: string): SnapshotTable | undefined {
  switch (entityType) {
    case 'system': return 'systems';
    case 'account': return 'accounts';
    case 'server': return 'servers';
    case 'middleware': return 'middlewares';
    case 'tag': return 'tags';
    case 'group': return 'groups';
    case 'configProject': return 'configProjects';
    case 'configDef': return 'configDefs';
    default: return undefined;
  }
}

export function deletionTypeForTable(table: SnapshotTable): string {
  switch (table) {
    case 'systems': return 'system';
    case 'accounts': return 'account';
    case 'servers': return 'server';
    case 'middlewares': return 'middleware';
    case 'tags': return 'tag';
    case 'groups': return 'group';
    case 'configProjects': return 'configProject';
    case 'configDefs': return 'configDef';
  }
}
