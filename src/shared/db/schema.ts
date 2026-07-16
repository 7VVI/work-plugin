import Dexie, { type Table } from 'dexie';
import type {
  System, Account, Server, Middleware, Tag,
  SystemTag, ServerTag, MiddlewareTag, Recent, MetaEntry,
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

  constructor() {
    super('NavPortalDB');
    this.version(1).stores({
      systems:        'id, name, url, environment, favorite, sort, createdAt, updatedAt',
      accounts:       'id, systemId, isDefault, createdAt',
      servers:        'id, name, ip, environment, favorite, createdAt',
      middlewares:    'id, type, name, host, favorite, createdAt',
      tags:           'id, name, createdAt',
      systemTags:     '[systemId+tagId], systemId, tagId',
      serverTags:     '[serverId+tagId], serverId, tagId',
      middlewareTags: '[middlewareId+tagId], middlewareId, tagId',
      recents:        'id, entityType, entityId, lastAccessedAt',
      meta:           'key',
    });
  }
}

export const db = new NavPortalDB();
