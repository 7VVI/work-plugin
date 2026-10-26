export type Environment = 'production' | 'development' | 'test' | 'staging';

export type MiddlewareType =
  | 'mysql' | 'redis' | 'rabbitmq' | 'kafka' | 'nacos'
  | 'apollo' | 'minio' | 'elasticsearch' | 'clickhouse' | 'mongodb' | 'rocketmq';

export type GroupEntityType = 'system' | 'server' | 'middleware';

export const SNAPSHOT_TABLES = [
  'groups',
  'tags',
  'systems',
  'accounts',
  'servers',
  'middlewares',
  'configProjects',
  'configDefs',
] as const;

export type SnapshotTable = typeof SNAPSHOT_TABLES[number];

export type TombstoneMap = Record<SnapshotTable, Record<string, number>>;
export type SnapshotIndex = Record<SnapshotTable, Record<string, number>>;

export interface GroupRec {
  id: string;
  entityType: GroupEntityType;
  name: string;
  color: string;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TagRec {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SystemRec {
  id: string;
  name: string;
  url: string;
  icon?: string;
  iconColor?: string;
  environment: Environment;
  color?: string;
  favorite: boolean;
  sort: number;
  sortOrder?: number;
  groupId?: string;
  remark?: string;
  createdAt: number;
  updatedAt: number;
  tagIds: string[];
}

export interface AccountRec {
  id: string;
  systemId: string;
  role: string;
  username: string;
  /** 明文密码；恢复时由客户端重新加密 */
  password: string;
  isDefault: boolean;
  remark?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ServerRec {
  id: string;
  name: string;
  ip: string;
  sshPort: number;
  username: string;
  password: string;
  sshKey?: string;
  environment: Environment;
  status?: 'online' | 'warn' | 'offline';
  purpose?: string;
  remark?: string;
  favorite: boolean;
  sortOrder?: number;
  groupId?: string;
  createdAt: number;
  updatedAt: number;
  tagIds: string[];
}

export interface MiddlewareRec {
  id: string;
  type: MiddlewareType;
  name: string;
  version?: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  extra?: Record<string, unknown>;
  remark?: string;
  favorite: boolean;
  sortOrder?: number;
  groupId?: string;
  createdAt: number;
  updatedAt: number;
  tagIds: string[];
}

export interface ConfigProjectRec {
  id: string;
  name: string;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ConfigDefRec {
  id: string;
  projectId: string;
  name: string;
  environment?: Environment;
  fields: Array<{ key: string; label: string; value: string }>;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotData {
  groups: GroupRec[];
  tags: TagRec[];
  systems: SystemRec[];
  accounts: AccountRec[];
  servers: ServerRec[];
  middlewares: MiddlewareRec[];
  configProjects: ConfigProjectRec[];
  configDefs: ConfigDefRec[];
}

export interface SyncSnapshot {
  schemaVersion: 1;
  generatedAt: number;
  data: SnapshotData;
}

export interface SyncPushRequest {
  protocol: 1;
  clientId: string;
  baseRevision: number;
  clientTime: number;
  snapshot: SyncSnapshot;
  tombstones: TombstoneMap;
}

export interface SyncStats {
  applied: number;
  ignoredOlder: number;
  rejectedByTombstone: number;
  droppedOrphans: number;
}

export interface SyncPushResponse {
  revision: number;
  serverTime: number;
  reset: boolean;
  snapshot: SyncSnapshot;
  tombstones: TombstoneMap;
  stats: SyncStats;
}

export interface ServerState {
  revision: number;
  snapshot: SyncSnapshot;
  tombstones: TombstoneMap;
}

export function emptySnapshotData(): SnapshotData {
  return {
    groups: [],
    tags: [],
    systems: [],
    accounts: [],
    servers: [],
    middlewares: [],
    configProjects: [],
    configDefs: [],
  };
}

export function emptyTombstones(): TombstoneMap {
  return {
    groups: {},
    tags: {},
    systems: {},
    accounts: {},
    servers: {},
    middlewares: {},
    configProjects: {},
    configDefs: {},
  };
}

export function emptySnapshotIndex(): SnapshotIndex {
  return {
    groups: {},
    tags: {},
    systems: {},
    accounts: {},
    servers: {},
    middlewares: {},
    configProjects: {},
    configDefs: {},
  };
}

export function isSnapshotTable(value: string): value is SnapshotTable {
  return (SNAPSHOT_TABLES as readonly string[]).includes(value);
}
