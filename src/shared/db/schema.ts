import Dexie, { type Table } from 'dexie';
import type {
  System, Account, Server, Middleware, Tag,
  SystemTag, ServerTag, MiddlewareTag, Recent, MetaEntry, ConfigGroup,
  ConfigProject, ConfigDef, Group,
} from '../types/entities';

export class NavPortalDB extends Dexie {
  systems!: Table<System, string>;
  accounts!: Table<Account, string>;
  servers!: Table<Server, string>;
  middlewares!: Table<Middleware, string>;
  tags!: Table<Tag, string>;
  systemTags!: Table<SystemTag, string>;
  serverTags!: Table<ServerTag, string>;
  middlewareTags!: Table<MiddlewareTag, string>;
  recents!: Table<Recent, string>;
  meta!: Table<MetaEntry, string>;
  configs!: Table<ConfigGroup, string>;
  configProjects!: Table<ConfigProject, string>;
  configDefs!: Table<ConfigDef, string>;
  groups!: Table<Group, string>;

  constructor() {
    super('NavPortalDB');
    this.version(1).stores({
      systems:        'id, name, url, environment, favorite, sort, sortOrder, createdAt, updatedAt',
      accounts:       'id, systemId, isDefault, createdAt',
      servers:        'id, name, ip, environment, favorite, sortOrder, createdAt',
      middlewares:    'id, type, name, host, favorite, sortOrder, createdAt',
      tags:           'id, name, createdAt',
      systemTags:     '[systemId+tagId], systemId, tagId',
      serverTags:     '[serverId+tagId], serverId, tagId',
      middlewareTags: '[middlewareId+tagId], middlewareId, tagId',
      recents:        'id, entityType, entityId, lastAccessedAt',
      meta:           'key',
    });
    this.version(2).stores({
      configs:        'id, name, createdAt, updatedAt',
    });
    this.version(3).stores({
      configProjects: 'id, name, sortOrder, createdAt, updatedAt',
      configDefs:     'id, projectId, name, sortOrder, createdAt, updatedAt',
    });
    this.version(4).stores({
      // 给系统/服务器/中间件增加 groupId 索引，并新增通用分组表
      systems:     'id, name, url, environment, favorite, sort, sortOrder, createdAt, updatedAt, groupId',
      servers:     'id, name, ip, environment, favorite, sortOrder, createdAt, groupId',
      middlewares: 'id, type, name, host, favorite, sortOrder, createdAt, groupId',
      groups:      'id, entityType, name, sortOrder, createdAt, updatedAt',
    });
  }
}

export const db = new NavPortalDB();
