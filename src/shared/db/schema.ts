import Dexie, { type Table } from 'dexie';
import type {
  System, Account, Server, Middleware, Tag,
  SystemTag, ServerTag, MiddlewareTag, Recent, MetaEntry, ConfigProject,
} from '../types/entities';

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

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
  configs!: Table<ConfigProject, string>;

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
    this.version(2).stores({
      configs:        'id, name, createdAt, updatedAt',
    });
    // v3: 配置升级为三级结构 项目 → 配置 → 字段（迁移旧的两级 ConfigGroup）
    this.version(3).stores({
      configs:        'id, name, createdAt, updatedAt',
    }).upgrade(async (tx) => {
      await tx.table('configs').toCollection().modify((rec: any) => {
        if (rec && rec.configs) return; // 已是三级结构
        const oldItems: any[] = Array.isArray(rec.items) ? rec.items : [];
        const fields = oldItems.map((it) => ({
          key: it.key ?? '',
          label: it.label,
          value: it.value ?? it.defaultValue ?? '',
        }));
        rec.configs = [{ id: genId(), name: '默认配置', fields }];
        delete rec.items;
      });
    });
  }
}

export const db = new NavPortalDB();
