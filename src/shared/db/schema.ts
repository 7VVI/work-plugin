import Dexie, { type Table } from 'dexie';
import { markDirty } from '../sync/dirtyTracker';
import type {
  System, Account, Server, Middleware, Tag,
  SystemTag, ServerTag, MiddlewareTag, Recent, MetaEntry, ConfigGroup,
  ConfigProject, ConfigDef, Group, DeletionEntry, NoteBook, Note,
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
  deletions!: Table<DeletionEntry, string>;
  noteBooks!: Table<NoteBook, string>;
  notes!: Table<Note, string>;

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
    this.version(5).upgrade(async (tx) => {
      // 历史配置可能没有 sortOrder，拖拽排序前先按“已有顺序 + 创建时间”补齐
      const rows = await tx.table('configDefs').toArray() as ConfigDef[];
      const byProject = new Map<string, ConfigDef[]>();
      for (const config of rows) {
        const list = byProject.get(config.projectId) ?? [];
        list.push(config);
        byProject.set(config.projectId, list);
      }

      const now = Date.now();
      for (const list of byProject.values()) {
        list.sort((a, b) =>
          (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
          || a.createdAt - b.createdAt
          || a.id.localeCompare(b.id),
        );
        for (let i = 0; i < list.length; i++) {
          if (list[i].sortOrder !== i) {
            await tx.table('configDefs').update(list[i].id, { sortOrder: i, updatedAt: now });
          }
        }
      }
    });
    this.version(6).stores({
      tags: 'id, name, createdAt, updatedAt',
      deletions: 'id, entityType, entityId, deletedAt',
    }).upgrade(async (tx) => {
      // 标签参与云端合并，需要 updatedAt；老数据用创建时间回填
      await tx.table<Tag, string>('tags').toCollection().modify((tag) => {
        if (typeof tag.updatedAt !== 'number') tag.updatedAt = tag.createdAt;
      });
    });
    this.version(7).stores({
      noteBooks: 'id, name, sortOrder, createdAt, updatedAt',
      notes: 'id, notebookId, [notebookId+sortOrder], sortOrder, updatedAt, createdAt',
    });
  }
}

export const db = new NavPortalDB();

const SYNC_DIRTY_TABLES = new Set([
  'groups', 'tags', 'systems', 'accounts', 'servers', 'middlewares',
  'systemTags', 'serverTags', 'middlewareTags', 'configProjects', 'configDefs',
  'noteBooks', 'notes',
]);

// 统一捕获所有业务表写入（包括导入/弹窗），只标记 dirty，不做数据变换
db.use({
  stack: 'dbcore',
  name: 'dock-sync-dirty-tracker',
  create: (down) => ({
    ...down,
    table: (name: string) => {
      const table = down.table(name);
      if (!SYNC_DIRTY_TABLES.has(name)) return table;
      return {
        ...table,
        mutate: (req) => table.mutate(req).then((result) => {
          markDirty(name);
          return result;
        }),
      };
    },
  }),
});
