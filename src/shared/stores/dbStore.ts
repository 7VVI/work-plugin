import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  DbCaps,
  DbCell,
  DbColumn,
  DbDialect,
  DbForeignKeyInfo,
  DbIndexInfo,
  DbObjectItem,
  DbObjectKind,
  DbRoutineParameter,
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

/** 存储过程 / 函数 / 触发器：只看定义，没有数据 */
export interface DbRoutineOpenTab {
  id: string;
  kind: 'routine';
  label: string;
  schema?: string;
  name: string;
  routineKind: 'functions' | 'procedures' | 'triggers';
  definition: string;
  parameters: DbRoutineParameter[];
  loading: boolean;
  error: string | null;
}

export type DbOpenTab = DbObjectTab | DbQueryOpenTab | DbRoutineOpenTab;

export interface DbQueryTab {
  id: string;
  title: string;
  sql: string;
  running: boolean;
  error: string | null;
  result: DbQueryOutcome | null;
  offset: number;
  pageSize: number;
  /** 该查询使用的库（PG 为 schema），执行时切到它，表名可不带库名 */
  database: string;
  /** 光标位置（决定执行哪条语句） */
  cursor: number;
  /** 正在执行的请求 id（用于取消） */
  requestId: number | null;
  /** 正在追加下一页 */
  loadingMore: boolean;
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
/** 表数据瀑布流：单页行数与自动续拉页数上限 */
const TABLE_PAGE_SIZE = 200;
const TABLE_AUTO_PAGES = 5;

/** 已打开表的快照：切 tab 时直接复用，不重新查 */
interface TableSnapshot {
  columns: DbColumn[];
  indexes: DbIndexInfo[];
  foreignKeys: DbForeignKeyInfo[];
  triggers: DbTriggerInfo[];
  data: DbQueryOutcome | null;
  offset: number;
  hasMore: boolean;
}

function tableKey(schema: string | undefined, name: string): string {
  return `${schema ?? ''}.${name}`;
}

let tabSeq = 0;

export const useDbStore = defineStore('db', () => {
  const status = ref<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const error = ref<DbErrorInfo | null>(null);
  const dialect = ref<DbDialect | null>(null);
  const caps = ref<DbCaps | null>(null);
  const middlewareId = ref<string>('');

  const databases = ref<DbObjectItem[]>([]);
  /** 查询工作区当前使用的库（PG 为 schema） */
  const currentDatabase = ref('');
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
  const tablePageSize = ref(TABLE_PAGE_SIZE);
  const tableHasMore = ref(false);
  const tableLoading = ref(false);
  const tableLoadingMore = ref(false);

  const queryTabs = ref<DbQueryTab[]>([]);
  const activeQueryTabId = ref<string | null>(null);
  const savedQueries = ref<DbSavedQuery[]>([]);
  /** 顶部打开的 tab（对象 + 查询混排） */
  const openTabs = ref<DbOpenTab[]>([]);
  const activeOpenTabId = ref<string | null>(null);

  let socket: DbSocket | null = null;
  let client: DbClient | null = null;
  const tableCache = new Map<string, TableSnapshot>();

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
    currentDatabase.value = '';
    tableCache.clear();
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
    // 打开哪个库的表，查询就跟着用哪个库，表名可以不写库名
    if (schema) setCurrentDatabase(schema);
    await openTable(schema, table);
  }

  /** 切换查询使用的库（同时同步到当前查询 tab） */
  function setCurrentDatabase(name: string): void {
    currentDatabase.value = name;
    const tab = activeTab.value;
    if (tab && tab.database !== name) tab.database = name;
  }

  /** 切换对象 tab 的属性页（数据/结构/索引/外键/触发器） */
  function setObjectProp(id: string, prop: DbPanelTab): void {
    const tab = openTabs.value.find(item => item.id === id);
    if (tab && tab.kind === 'object') tab.prop = prop;
  }

  /** 打开（或聚焦）一个存储过程 / 函数 / 触发器：看定义而不是数据 */
  async function openRoutineTab(
    schema: string | undefined,
    name: string,
    routineKind: 'functions' | 'procedures' | 'triggers',
  ): Promise<void> {
    const id = `rtn:${routineKind}:${schema ?? ''}.${name}`;
    let tab = openTabs.value.find(item => item.id === id) as DbRoutineOpenTab | undefined;
    if (!tab) {
      tab = {
        id,
        kind: 'routine',
        label: name,
        schema,
        name,
        routineKind,
        definition: '',
        parameters: [],
        loading: false,
        error: null,
      };
      openTabs.value = [...openTabs.value, tab];
    }
    activeOpenTabId.value = id;
    // 必须取回数组里的响应式对象，直接改原始对象界面不会更新
    const reactive = openTabs.value.find(item => item.id === id) as DbRoutineOpenTab | undefined;
    if (reactive) await loadRoutine(reactive);
  }

  /** 拉取存储过程 / 函数 / 触发器的定义 */
  async function loadRoutine(tab: DbRoutineOpenTab): Promise<void> {
    if (!client) return;
    tab.loading = true;
    tab.error = null;
    try {
      const info = await client.getRoutine(tab.routineKind, tab.schema, tab.name);
      tab.definition = info.definition;
      tab.parameters = info.parameters;
    } catch (e) {
      tab.error = (e as Error).message;
    } finally {
      tab.loading = false;
    }
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
      if (next) {
        // 切到相邻 tab 时要把它的内容也带出来
        activateOpenTab(next.id);
      } else {
        activeOpenTabId.value = null;
        activeQueryTabId.value = null;
      }
    }
  }

  function activateOpenTab(id: string): void {
    const tab = openTabs.value.find(item => item.id === id);
    if (!tab) return;
    activeOpenTabId.value = id;
    if (tab.kind === 'query') {
      activeQueryTabId.value = tab.queryTabId;
    } else if (tab.kind === 'routine') {
      if (!tab.definition && !tab.loading) void loadRoutine(tab);
    } else {
      activeTable.value = { schema: tab.schema, name: tab.table };
      // 切换到别的表 tab 时要加载该表的内容，否则下方仍是上一张表的数据
      void openTable(tab.schema, tab.table);
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
      if (!currentDatabase.value && items.length > 0) currentDatabase.value = items[0].name;
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

  async function openTable(schema: string | undefined, name: string, force = false): Promise<void> {
    if (!client) return;
    const key = tableKey(schema, name);
    activeTable.value = { schema, name };
    panelTab.value = 'data';
    // 已经加载过的表直接复用快照，切 tab 时不用重新查
    const cached = force ? undefined : tableCache.get(key);
    if (cached) {
      tableColumns.value = cached.columns;
      tableIndexes.value = cached.indexes;
      tableForeignKeys.value = cached.foreignKeys;
      tableTriggers.value = cached.triggers;
      tableData.value = cached.data;
      tableOffset.value = cached.offset;
      tableHasMore.value = cached.hasMore;
      return;
    }
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
      await autoFillTable();
      saveSnapshot(key);
    } catch (e) {
      error.value = { kind: 'unknown', message: (e as Error).message };
    } finally {
      tableLoading.value = false;
    }
  }

  /** 把当前表的内容存进快照（切换 tab 时复用） */
  function saveSnapshot(key: string): void {
    tableCache.set(key, {
      columns: tableColumns.value,
      indexes: tableIndexes.value,
      foreignKeys: tableForeignKeys.value,
      triggers: tableTriggers.value,
      data: tableData.value,
      offset: tableOffset.value,
      hasMore: tableHasMore.value,
    });
  }

  async function loadTablePage(offset: number, append = false): Promise<void> {
    if (!client || !activeTable.value) return;
    const { schema, name } = activeTable.value;
    const qualified = qualifiedTable(schema, name, dialect.value);
    try {
      const result = await client.query(`SELECT * FROM ${qualified}`, { maxRows: tablePageSize.value, offset });
      const more = result.rows.length >= tablePageSize.value;
      if (append && tableData.value) {
        tableData.value = {
          ...tableData.value,
          rows: [...tableData.value.rows, ...result.rows],
          rowCount: tableData.value.rowCount + result.rows.length,
          elapsedMs: result.elapsedMs,
          truncated: result.truncated,
          nextOffset: result.nextOffset,
        };
      } else {
        tableData.value = result;
      }
      tableOffset.value = offset + result.rows.length;
      tableHasMore.value = more;
      saveSnapshot(tableKey(schema, name));
    } catch (e) {
      error.value = { kind: 'unknown', message: (e as Error).message };
    }
  }

  /** 表数据用瀑布流：一页满就自动续拉（最多连拉几页） */
  async function autoFillTable(): Promise<void> {
    let guard = 0;
    while (tableHasMore.value && guard < TABLE_AUTO_PAGES) {
      guard += 1;
      tableLoadingMore.value = true;
      try {
        await loadTablePage(tableOffset.value, true);
      } finally {
        tableLoadingMore.value = false;
      }
    }
  }

  /** 滚动到底时继续加载下一页 */
  async function loadMoreTable(): Promise<void> {
    if (!tableHasMore.value || tableLoadingMore.value) return;
    tableLoadingMore.value = true;
    try {
      await loadTablePage(tableOffset.value, true);
    } finally {
      tableLoadingMore.value = false;
    }
  }

  /** 重新查询当前表 */
  async function refreshTable(): Promise<void> {
    const table = activeTable.value;
    if (!table) return;
    await openTable(table.schema, table.name, true);
  }

  /** 改每页行数：重新按新页大小拉取 */
  async function setTablePageSize(size: number): Promise<void> {
    if (!Number.isFinite(size) || size <= 0 || size === tablePageSize.value) return;
    tablePageSize.value = Math.floor(size);
    await refreshTable();
  }

  /**
   * 修改一个单元格：按主键定位行，生成 UPDATE 交给服务端执行。
   * 成功返回 true（并同步本地数据），失败返回 false（错误信息进 error）。
   */
  async function updateCell(rowIndex: number, column: string, value: string | null): Promise<boolean> {
    const table = activeTable.value;
    const row = tableData.value?.rows[rowIndex];
    if (!client || !table || !row) return false;
    const columns = tableColumns.value;
    const primaryKeys = columns.filter(col => col.primary);
    if (primaryKeys.length === 0) {
      error.value = { kind: 'unknown', message: '该表没有主键，无法直接修改单元格' };
      return false;
    }
    const keys = primaryKeys.map(col => {
      const index = columns.findIndex(item => item.name === col.name);
      return { column: col.name, value: cellToText(row[index]) };
    });
    try {
      await client.updateCell({
        schema: table.schema,
        table: table.name,
        column,
        value,
        keys,
      });
    } catch (e) {
      error.value = { kind: 'unknown', message: (e as Error).message };
      return false;
    }
    // 更新本地显示
    const columnIndex = columns.findIndex(col => col.name === column);
    if (columnIndex >= 0 && tableData.value) {
      const rows = tableData.value.rows.map((item, index) => (index === rowIndex
        ? item.map((cell, i) => (i === columnIndex ? (value ?? null) : cell))
        : item));
      tableData.value = { ...tableData.value, rows };
      saveSnapshot(tableKey(table.schema, table.name));
    }
    return true;
  }

  /** 单元格值转成可写回的文本（空表示 NULL） */
  function cellToText(cell: DbCell | undefined): string | null {
    if (cell === null || cell === undefined) return null;
    if (typeof cell === 'boolean') return cell ? 'true' : 'false';
    if (typeof cell === 'object') return JSON.stringify(cell);
    return String(cell);
  }

  // ---------- SQL 标签页 ----------

  function newTab(sql = ''): string {
    const id = `tab_${Date.now()}_${++tabSeq}`;
    queryTabs.value = [...queryTabs.value, { id, title: `查询 ${queryTabs.value.length + 1}`, sql, running: false, error: null, result: null, offset: 0, pageSize: 500, database: currentDatabase.value, cursor: 0, requestId: null, loadingMore: false }];
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

  /** 当前生效的语句（光标所在那条） */
  function currentStatement(tab: DbQueryTab): string {
    const statement = statementAtCursor(tab.sql, tab.cursor);
    return statement?.text.trim() ? statement.text : tab.sql;
  }

  /**
   * 执行查询。
   * mode='current'：只执行光标所在的那条语句（DBeaver 行为）；
   * mode='all'：按顶层分号拆开后依次执行。
   */
  async function runSql(id: string, mode: 'current' | 'all' = 'current'): Promise<void> {
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
          database: tab.database || undefined,
          onRequestId: (requestId) => { tab.requestId = requestId; },
        });
        last = result;
      }
      tab.result = last;
      tab.offset = 0;
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

  /** 改查询结果的每页行数：按新页大小重跑当前语句 */
  async function setQueryPageSize(id: string, size: number): Promise<void> {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab || !Number.isFinite(size) || size <= 0 || size === tab.pageSize) return;
    tab.pageSize = Math.floor(size);
    tab.offset = 0;
    await runSql(id, 'current');
  }

  /** 查询结果瀑布流：滚动到底继续加载下一页并追加 */
  async function loadMoreQuery(id: string): Promise<void> {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab || !client || tab.loadingMore) return;
    const next = tab.result?.nextOffset;
    if (next === undefined) return;
    tab.loadingMore = true;
    try {
      const result = await client.query(currentStatement(tab), { maxRows: tab.pageSize, offset: next, database: tab.database || undefined });
      if (!tab.result) return;
      tab.result = {
        ...tab.result,
        rows: [...tab.result.rows, ...result.rows],
        rowCount: tab.result.rowCount + result.rows.length,
        elapsedMs: result.elapsedMs,
        truncated: result.truncated,
        nextOffset: result.nextOffset,
      };
      tab.offset = next + result.rows.length;
    } catch (e) {
      tab.error = (e as Error).message;
    } finally {
      tab.loadingMore = false;
    }
  }

  /** 把结果集导出为 CSV（rows 给了就只导这些行） */
  function exportResultCsv(result: DbQueryOutcome | null, filename: string, rows?: DbCell[][]): void {
    if (!result) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
    const payload = rows ? { ...result, rows } : result;
    downloadText(toCsv(payload), `${filename}-${stamp}.csv`, 'text/csv;charset=utf-8');
  }

  /** 导出当前查询结果为 CSV */
  function exportCsv(id: string, rows?: DbCell[][]): void {
    const tab = queryTabs.value.find(item => item.id === id);
    if (!tab) return;
    exportResultCsv(tab.result, 'dock-query', rows);
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
    currentDatabase,
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
    openRoutineTab,
    setObjectProp,
    setCurrentDatabase,
    openQueryTab,
    closeOpenTab,
    activateOpenTab,
    loadTablePage,
    loadMoreTable,
    refreshTable,
    setTablePageSize,
    setQueryPageSize,
    updateCell,
    tableHasMore,
    tableLoadingMore,
    newTab,
    closeTab,
    selectTab,
    updateTabSql,
    setCursor,
    runSql,
    cancelSql,
    loadMoreQuery,
    exportCsv,
    exportResultCsv,
    loadSavedQueries,
    saveQuery,
    deleteSavedQuery,
    openSavedQuery,
  };
});
