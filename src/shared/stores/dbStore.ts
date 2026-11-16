import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  DbCaps,
  DbColumn,
  DbDialect,
  DbForeignKeyInfo,
  DbIndexInfo,
  DbObjectItem,
  DbObjectKind,
  DbTriggerInfo,
} from '@protocol/db';
import { DbClient, type DbQueryOutcome } from '@shared/db/DbClient';
import { DbSocket } from '@shared/db/DbSocket';
import { describeDbError, requestDbWsUrl, type DbErrorInfo } from '@shared/db/ticket';
import { platform } from '@shared/platform';
import { downloadText } from '@shared/utils/download';
import { toCsv } from '@shared/db/csv';
import { qualifiedTable } from '@shared/db/sql';
import { splitSqlStatements, statementAtCursor } from '@shared/db/sqlStatement';

/** 各方言支持的元数据类型（前端据此隐藏不可用标签） */
const DIALECT_CAPABILITIES: Record<string, { functions: boolean; procedures: boolean; triggers: boolean; foreignKeys: boolean }> = {
  postgres: { functions: true, procedures: true, triggers: true, foreignKeys: true },
  mysql: { functions: true, procedures: true, triggers: true, foreignKeys: true },
  mssql: { functions: true, procedures: true, triggers: true, foreignKeys: true },
  sqlite: { functions: true, procedures: false, triggers: true, foreignKeys: true },
  clickhouse: { functions: true, procedures: false, triggers: false, foreignKeys: false },
};

export type DbPanelTab = 'data' | 'schema' | 'indexes' | 'foreignKeys' | 'triggers';

/** 顶部打开的 tab：对象（表/视图）或查询 */
export interface DbObjectTab {
  id: string;
  kind: 'object';
  label: string;
  schema?: string;
  table: string;
  prop: DbPanelTab;
}

export interface DbQueryOpenTab {
  id: string;
  kind: 'query';
  label: string;
  queryTabId: string;
}

export type DbOpenTab = DbObjectTab | DbQueryOpenTab;

export interface DbQueryTab {
  id: string;
  title: string;
  sql: string;
  running: boolean;
  error: string | null;
  result: DbQueryOutcome | null;
  offset: number;
  pageSize: number;
  /** 光标位置（决定执行哪条语句） */
  cursor: number;
  /** 正在执行的请求 id（用于取消） */
  requestId: number | null;
}

export interface DbSavedQuery {
  id: string;
  middlewareId: string;
  name: string;
  sql: string;
  createdAt: number;
  updatedAt: number;
}

const SAVED_QUERIES_KEY = 'db.savedQueries';

let tabSeq = 0;

export const useDbStore = defineStore('db', () => {
  const status = ref<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const error = ref<DbErrorInfo | null>(null);
  const dialect = ref<DbDialect | null>(null);
  const caps = ref<DbCaps | null>(null);
  const middlewareId = ref<string>('');

  const databases = ref<DbObjectItem[]>([]);
  /** 每个库下面的对象：{ 库名: { tables: [], views: [], ... } } */
  const dbObjects = ref<Record<string, Partial<Record<DbObjectKind, DbObjectItem[]>>>>({});
  const loadingDatabases = ref<Record<string, boolean>>({});
  const activeSchema = ref<string | undefined>(undefined);
  const activeTable = ref<{ schema?: string; name: string } | null>(null);
  const panelTab = ref<DbPanelTab>('data');
  const tableColumns = ref<DbColumn[]>([]);
  const tableIndexes = ref<DbIndexInfo[]>([]);
  const tableForeignKeys = ref<DbForeignKeyInfo[]>([]);
  const tableTriggers = ref<DbTriggerInfo[]>([]);
  const tableData = ref<DbQueryOutcome | null>(null);
  const tableOffset = ref(0);
  const tablePageSize = 200;
  const tableLoading = ref(false);

  const queryTabs = ref<DbQueryTab[]>([]);
  const activeQueryTabId = ref<string | null>(null);
  const savedQueries = ref<DbSavedQuery[]>([]);
  /** 顶部打开的 tab（对象 + 查询混排） */
  const openTabs = ref<DbOpenTab[]>([]);
  const activeOpenTabId = ref<string | null>(null);

  let socket: DbSocket | null = null;
  let client: DbClient | null = null;

  const activeTab = computed(() => queryTabs.value.find(tab => tab.id === activeQueryTabId.value) ?? null);
  const activeOpenTab = computed(() => openTabs.value.find(tab => tab.id === activeOpenTabId.value) ?? null);
  const isReady = computed(() => status.value === 'ready');
  /** 当前方言支持的能力位 */
  const capabilities = computed(() => DIALECT_CAPABILITIES[dialect.value ?? ''] ?? {
    functions: true,
    procedures: true,
    triggers: true,
    foreignKeys: true,
  });

  async function connect(id: string): Promise<void> {
    if (status.value === 'connecting' || status.value === 'ready') return;
    status.value = 'connecting';
    error.value = null;
    middlewareId.value = id;
    try {
      const url = await requestDbWsUrl(id);
      socket = new DbSocket(url, {
        onReady: (info) => {
          dialect.value = info.dialect;
          caps.value = info.caps;
          status.value = 'ready';
          void loadAllObjects();
        },
        onError: (code, message) => {
          status.value = 'error';
          error.value = { kind: 'unknown', message: message || code };
        },
        onClose: (info) => {
          client?.dispose();
          client = null;
          socket = null;
          if (!info.intentional && status.value === 'ready') {
            status.value = 'error';
            error.value = { kind: 'unknown', message: '与云端服务端的连接已断开' };
          }
        },
      });
      client = new DbClient(socket);
    } catch (e) {
      status.value = 'error';
      error.value = describeDbError(e);
    }
  }

  function disconnect(): void {
    client?.dispose();
    client = null;
    socket?.close();
    socket = null;
    status.value = 'idle';
    dialect.value = null;
    caps.value = null;
    tableData.value = null;
    tableColumns.value = [];
    tableIndexes.value = [];
    tableForeignKeys.value = [];
    tableTriggers.value = [];
    activeTable.value = null;
    queryTabs.value = [];
    activeQueryTabId.value = null;
    openTabs.value = [];
    activeOpenTabId.value = null;
  }

  // ---------- 顶部 tab（对象 + 查询） ----------

  /** 打开（或聚焦）一个表/视图 tab */
  async function openObjectTab(schema: string | undefined, table: string): Promise<void> {
    const id = `obj:${schema ?? ''}.${table}`;
    const existing = openTabs.value.find(tab => tab.id === id);
    if (!existing) {
      openTabs.value = [...openTabs.value, { id, kind: 'object', label: table, schema, table, prop: 'data' }];
    }
    activeOpenTabId.value = id;
    await openTable(schema, table);
  }

  /** 切换对象 tab 的属性页（数据/结构/索引/外键/触发器） */
  function setObjectProp(id: string, prop: DbPanelTab): void {
    const tab = openTabs.value.find(item => item.id === id);
    if (tab && tab.kind === 'object') tab.prop = prop;
  }

  /** 新建查询 tab */
  function openQueryTab(sql = ''): string {
    const queryTabId = newTab(sql);
    const openId = `qry:${queryTabId}`;
    openTabs.value = [...openTabs.value, { id: openId, kind: 'query', label: `Query ${queryTabs.value.length}`, queryTabId }];
    activeOpenTabId.value = openId;
    activeQueryTabId.value = queryTabId;
    return openId;
  }

  function closeOpenTab(id: string): void {
    const tab = openTabs.value.find(item => item.id === id);
    if (!tab) return;
    const index = openTabs.value.findIndex(item => item.id === id);
    openTabs.value = openTabs.value.filter(item => item.id !== id);
    if (tab.kind === 'query') {
      queryTabs.value = queryTabs.value.filter(item => item.id !== tab.queryTabId);
      if (activeQueryTabId.value === tab.queryTabId) {
        activeQueryTabId.value = queryTabs.value.length > 0 ? queryTabs.value[queryTabs.value.length - 1].id : null;
      }
    }
    if (activeOpenTabId.value === id) {
      const next = openTabs.value[index - 1] ?? openTabs.value[index] ?? null;
      activeOpenTabId.value = next?.id ?? null;
      if (next?.kind === 'query') activeQueryTabId.value = next.queryTabId;
    }
  }

  function activateOpenTab(id: string): void {
    const tab = openTabs.value.find(item => item.id === id);
    if (!tab) return;
    activeOpenTabId.value = id;
    if (tab.kind === 'query') {
      activeQueryTabId.value = tab.queryTabId;
    } else {
      activeTable.value = { schema: tab.schema, name: tab.table };
    }
  }

  async function loadAllObjects(): Promise<void> {
    await loadDatabases();
  }

  /** 顶层：库（PG/MySQL 为 schema/database，SQLite 为 main） */
  async function loadDatabases(): Promise<void> {
    if (!client) return;
    try {
      const items = await client.listObjects('schemas');
      databases.value = items;
      if (!activeSchema.value && items.length > 0) activeSchema.value = items[0].name;
    } catch (e) {
      error.value = { kind: 'unknown', message: (e as Error).message };
    }
  }

  /** 展开某个库时加载它下面的表/视图/函数/存储过程/触发器 */
  async function loadDatabaseObjects(database: string): Promise<void> {
    if (!client) return;
    loadingDatabases.value = { ...loadingDatabases.value, [database]: true };
    const kinds: DbObjectKind[] = ['tables', 'views', 'functions', 'procedures', 'triggers'];
    const caps = capabilities.value;
    const wanted = kinds.filter(kind => {
      if (kind === 'functions') return caps.functions;
      if (kind === 'procedures') return caps.procedures;
      if (kind === 'triggers') return caps.triggers;
      return true;
    });
    try {
      const db = client;
      // 单个对象类型查不到（权限不足等）不应拖垮整棵树，逐类容错
      const results = await Promise.all(wanted.map(async (kind) => {
        try {
          return { kind, items: await db.listObjects(kind, database) };
        } catch {
          return { kind, items: [] as DbObjectItem[] };
        }
      }));
      const bucket: Partial<Record<DbObjectKind, DbObjectItem[]>> = {};
      for (const entry of results) bucket[entry.kind] = entry.items;
      dbObjects.value = { ...dbObjects.value, [database]: { ...dbObjects.value[database], ...bucket } };
    } catch (e) {
      error.value = { kind: 'unknown', message: (e as Error).message };
    } finally {
      loadingDatabases.value = { ...loadingDatabases.value, [database]: false };
    }
  }

  function objectsOf(database: string, kind: DbObjectKind): DbObjectItem[] {
    return dbObjects.value[database]?.[kind] ?? [];
  }

  async function openTable(schema: string | undefined, name: string): Promise<void> {
    if (!client) return;
    activeTable.value = { schema, name };
    panelTab.value = 'data';
    tableLoading.value = true;
    try {
      const [columns, indexes, foreignKeys, triggers] = await Promise.all([
        client.describeTable(schema, name),
        client.listIndexes(schema, name),
        client.listForeignKeys(schema, name),
        client.listTriggers(schema, name),
      ]);
      tableColumns.value = columns;
      tableIndexes.value = indexes;
      tableForeignKeys.value = foreignKeys;
      tableTriggers.value = triggers;
      await loadTablePage(0);
    } catch (e) {
      error.value = { kind: 'unknown', message: (e as Error).message };
    } finally {
      tableLoading.value = false;
    }
  }

  async function loadTablePage(offset: number): Promise<void> {
    if (!client || !activeTable.value) return;
    const { schema, name } = activeTable.value;
    const qualified = qualifiedTable(schema, name, dialect.value);
    try {
      const result = await client.query(`SELECT * FROM ${qualified}`, { maxRows: tablePageSize, offset });
      tableData.value = result;
      tableOffset.value = offset;
    } catch (e) {
      error.value = { kind: 'unknown', message: (e as Error).message };
    }
  }

  /** 表数据翻页（用服务端返回的 nextOffset，避免服务端行数上限与客户端页大小不一致） */
  async function nextTablePage(): Promise<void> {
    const next = tableData.value?.nextOffset;
    if (next === undefined) return;
    await loadTablePage(next);
  }

  async function prevTablePage(): Promise<void> {
    const size = tableData.value?.rowCount ?? tablePageSize;
    await loadTablePage(Math.max(0, tableOffset.value - size));
  }

  // ---------- SQL 标签页 ----------

  function newTab(sql = ''): string {
    const id = `tab_${Date.now()}_${++tabSeq}`;
    queryTabs.value = [...queryTabs.value, { id, title: `查询 ${queryTabs.value.length + 1}`, sql, running: false, error: null, result: null, offset: 0, pageSize: 500, cursor: 0, requestId: null }];
    activeQueryTabId.value = id;
    return id;
  }

  function closeTab(id: string): void {
    const index = queryTabs.value.findIndex(tab => tab.id === id);
    if (index < 0) return;
    const next = queryTabs.value.filter(tab => tab.id !== id);
    queryTabs.value = next;
    if (activeQueryTabId.value === id) {
      activeQueryTabId.value = next.length > 0 ? next[Math.max(0, index - 1)].id : null;
    }
  }

  function selectTab(id: string): void {
    activeQueryTabId.value = id;
  }

  function updateTabSql(id: string, sql: string): void {
    const tab = queryTabs.value.find(item => item.id === id);
    if (tab) tab.sql = sql;
  }

  /** 记录光标位置（决定执行光标所在的那条语句） */
  function setCursor(id: string, position: number): void {
    const tab = queryTabs.value.find(item => item.id === id);
    if (tab) tab.cursor = position;
  }

  /**
   * 执行查询。
   * mode='current'：只执行光标所在的那条语句（DBeaver 行为）；
   * mode='all'：按顶层分号拆开后依次执行。
   */
  async function runSql(id: string, mode: 'current' | 'all' = 'current', offset = 0): Promise<void> {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab || !client) return;
    const statements = mode === 'all'
      ? splitSqlStatements(tab.sql)
      : [statementAtCursor(tab.sql, tab.cursor)].filter((item): item is NonNullable<typeof item> => !!item);
    const targets = statements.length > 0 ? statements : [{ text: tab.sql, start: 0, end: tab.sql.length }];
    tab.running = true;
    tab.error = null;
    try {
      let last: DbQueryOutcome | null = null;
      for (const statement of targets) {
        if (!statement.text.trim()) continue;
        const result = await client.query(statement.text, {
          maxRows: tab.pageSize,
          offset,
          onRequestId: (requestId) => { tab.requestId = requestId; },
        });
        last = result;
      }
      tab.result = last;
      tab.offset = offset;
    } catch (e) {
      tab.result = null;
      tab.error = (e as Error).message;
    } finally {
      tab.running = false;
      tab.requestId = null;
    }
  }

  /** 取消正在执行的查询 */
  function cancelSql(id: string): void {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab || !client || tab.requestId == null) return;
    client.cancel(tab.requestId);
  }

  /** 翻页（offset 为起始行） */
  async function goToPage(id: string, offset: number): Promise<void> {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab) return;
    await runSql(id, 'current', Math.max(0, offset));
  }

  /** 查询结果翻页：下一页用服务端 nextOffset，上一页按实际行数回退 */
  async function nextQueryPage(id: string): Promise<void> {
    const tab = queryTabs.value.find(item => item.id === id);
    const next = tab?.result?.nextOffset;
    if (!tab || next === undefined) return;
    await runSql(id, 'current', next);
  }

  async function prevQueryPage(id: string): Promise<void> {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab) return;
    const size = tab.result?.rowCount ?? tab.pageSize;
    await runSql(id, 'current', Math.max(0, tab.offset - size));
  }

  /** 把结果集导出为 CSV */
  function exportResultCsv(result: DbQueryOutcome | null, filename: string): void {
    if (!result) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
    downloadText(toCsv(result), `${filename}-${stamp}.csv`, 'text/csv;charset=utf-8');
  }

  /** 导出当前查询结果为 CSV */
  function exportCsv(id: string): void {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab) return;
    exportResultCsv(tab.result, 'dock-query');
  }

  // ---------- 保存的查询（本地存储，不进云同步） ----------

  async function loadSavedQueries(): Promise<void> {
    const result = await platform.storage.local.get(SAVED_QUERIES_KEY);
    const list = result[SAVED_QUERIES_KEY];
    savedQueries.value = Array.isArray(list) ? (list as DbSavedQuery[]) : [];
  }

  async function saveQuery(id: string, name: string): Promise<void> {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab || !name.trim()) return;
    const now = Date.now();
    const existing = savedQueries.value.find(item => item.id === id);
    if (existing) {
      existing.name = name.trim();
      existing.sql = tab.sql;
      existing.updatedAt = now;
    } else {
      savedQueries.value = [
        ...savedQueries.value,
        { id, middlewareId: middlewareId.value, name: name.trim(), sql: tab.sql, createdAt: now, updatedAt: now },
      ];
    }
    await platform.storage.local.set({ [SAVED_QUERIES_KEY]: savedQueries.value });
  }

  async function deleteSavedQuery(id: string): Promise<void> {
    savedQueries.value = savedQueries.value.filter(item => item.id !== id);
    await platform.storage.local.set({ [SAVED_QUERIES_KEY]: savedQueries.value });
  }

  async function openSavedQuery(id: string): Promise<void> {
    const saved = savedQueries.value.find(item => item.id === id);
    if (!saved) return;
    const tabId = newTab(saved.sql);
    await runSql(tabId);
  }

  return {
    status,
    error,
    dialect,
    caps,
    middlewareId,
    databases,
    dbObjects,
    loadingDatabases,
    activeSchema,
    activeTable,
    panelTab,
    tableColumns,
    tableIndexes,
    tableForeignKeys,
    tableTriggers,
    tableData,
    tableOffset,
    tablePageSize,
    tableLoading,
    queryTabs,
    activeQueryTabId,
    activeTab,
    openTabs,
    activeOpenTabId,
    activeOpenTab,
    savedQueries,
    isReady,
    capabilities,
    connect,
    disconnect,
    loadAllObjects,
    loadDatabases,
    loadDatabaseObjects,
    objectsOf,
    openTable,
    openObjectTab,
    setObjectProp,
    openQueryTab,
    closeOpenTab,
    activateOpenTab,
    loadTablePage,
    nextTablePage,
    prevTablePage,
    newTab,
    closeTab,
    selectTab,
    updateTabSql,
    setCursor,
    runSql,
    cancelSql,
    goToPage,
    nextQueryPage,
    prevQueryPage,
    exportCsv,
    exportResultCsv,
    loadSavedQueries,
    saveQuery,
    deleteSavedQuery,
    openSavedQuery,
  };
});
