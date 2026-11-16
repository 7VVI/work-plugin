<template>
  <div class="db-page">
    <header class="db-head">
      <button class="ibtn" title="返回中间件列表" @click="goBack">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <span class="db-head-icon" :style="iconStyle"><i class="fa-solid fa-database"></i></span>
      <div class="db-head-text">
        <div class="db-head-title t1">{{ record?.name ?? '数据库' }}</div>
        <div class="db-head-sub t3 mono">{{ targetText }}</div>
      </div>
      <span v-if="store.dialect" class="chip">{{ dialectLabel }}</span>
      <span class="db-status" :class="store.status">
        <i class="fa-solid fa-circle"></i>{{ statusText }}
      </span>
      <span class="db-spacer"></span>
      <button class="btn-g db-head-btn" @click="reload">
        <i class="fa-solid fa-rotate"></i>刷新
      </button>
    </header>

    <div v-if="store.error" class="db-error">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>{{ store.error.message }}</span>
      <button v-if="store.status === 'error'" class="btn-p db-head-btn" @click="reconnect">重试</button>
      <button v-else class="ibtn" title="关闭提示" @click="store.error = null">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="db-body">
      <DbObjectTree
        :databases="store.databases"
        :objects-of="store.objectsOf"
        :is-loading="(name: string) => !!store.loadingDatabases[name]"
        :active-table="store.activeTable"
        :active-routine="activeRoutine?.name ?? null"
        :capabilities="store.capabilities"
        @select-object="onSelectObject"
        @expand-database="store.loadDatabaseObjects($event)"
        @new-query="store.openQueryTab()"
        @view-prop="onViewProp"
        @reload="reload"
      />

      <section class="db-main">
        <!-- 打开的对象 / 查询 -->
        <div v-if="store.openTabs.length" class="db-tabs">
          <button
            v-for="tab in store.openTabs"
            :key="tab.id"
            class="db-tab"
            :class="{ active: tab.id === store.activeOpenTabId }"
            @click="store.activateOpenTab(tab.id)"
          >
            <i :class="tab.kind === 'query' ? 'fa-regular fa-file-lines' : 'fa-solid fa-table'"></i>
            <span class="db-tab-title">{{ tab.label }}</span>
            <i class="fa-solid fa-xmark db-tab-close" @click.stop="store.closeOpenTab(tab.id)"></i>
          </button>
          <button class="db-tab-add" title="新建查询" @click="store.openQueryTab()">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>

        <!-- 当前对象的属性 -->
        <div v-if="activeKind === 'object'" class="db-props">
          <button
            v-for="prop in propTabs"
            :key="prop.key"
            class="db-prop"
            :class="{ active: activeProp === prop.key }"
            @click="setProp(prop.key)"
          >
            {{ prop.label }}
          </button>
        </div>

        <!-- 内容区 -->
        <div class="db-content">
          <template v-if="activeKind === 'object'">
            <DbDataGrid
              v-if="activeProp === 'data'"
              :result="store.tableData"
              :loading="store.tableLoading"
              :page-size="store.tablePageSize"
              :has-more="store.tableHasMore"
              :loading-more="store.tableLoadingMore"
              refreshable
              editable
              :on-save-cell="onSaveCell"
              @load-more="store.loadMoreTable()"
              @refresh="store.refreshTable()"
              @export="onExportTable"
              @update:page-size="store.setTablePageSize($event)"
            />
            <DbMetaPanel
              v-else
              :prop="activeProp"
              :columns="store.tableColumns"
              :indexes="store.tableIndexes"
              :foreign-keys="store.tableForeignKeys"
              :triggers="store.tableTriggers"
            />
          </template>

          <!-- 存储过程 / 函数 / 触发器：只看定义 -->
          <template v-else-if="activeKind === 'routine' && activeRoutine">
            <DbRoutinePanel
              :name="activeRoutine.name"
              :schema="activeRoutine.schema"
              :kind="activeRoutine.routineKind"
              :definition="activeRoutine.definition"
              :parameters="activeRoutine.parameters"
              :loading="activeRoutine.loading"
              :error="activeRoutine.error"
            />
          </template>

          <!-- 查询：整个内容区都是查询工作区 -->
          <template v-else-if="activeKind === 'query'">
            <div class="db-query">
              <div class="db-query-top">
                <DbDatabaseSelect
                  :databases="store.databases"
                  :model-value="queryDatabase"
                  @select="onSelectDatabase"
                />
                <span class="db-query-hint t3">查询在所选库中执行，表名可直接使用</span>
              </div>
              <div class="db-query-main">
                <DbQueryToolbar
                  :saved="store.savedQueries"
                  :running="store.activeTab?.running"
                  @run="runActive"
                  @run-all="runAll"
                  @cancel="cancelActive"
                  @save="saveActive"
                  @open-saved="store.openSavedQuery"
                  @delete-saved="store.deleteSavedQuery"
                />
                <div class="db-query-editor">
                  <DbSqlEditor
                    :model-value="activeSql"
                    :dialect="store.dialect"
                    :current-database="queryDatabase"
                    @update:model-value="onSqlChange"
                    @cursor="onCursorChange"
                    @run="runActive"
                    @run-all="runAll"
                    @save="saveActive"
                  />
                </div>
              </div>
              <div v-if="store.activeTab?.error" class="db-sql-error">
                <i class="fa-solid fa-circle-exclamation"></i>{{ store.activeTab.error }}
              </div>
              <div class="db-query-result" :class="{ empty: !store.activeTab?.result }">
                <DbDataGrid
                  v-if="store.activeTab?.result"
                  :result="store.activeTab.result"
                  :loading="store.activeTab?.running"
                  :page-size="store.activeTab?.pageSize"
                  :has-more="!!store.activeTab?.result?.nextOffset"
                  :loading-more="store.activeTab?.loadingMore"
                  @load-more="loadMoreQuery"
                  @export="onExportQuery"
                  @update:page-size="onQueryPageSize"
                />
                <div v-else class="db-query-hint t3">
                  <i class="fa-solid fa-keyboard"></i>
                  Ctrl / ⌘ + Enter 执行当前查询
                </div>
              </div>
            </div>
          </template>

          <div v-else class="db-empty">
            <div class="db-conn-card">
              <i class="fa-solid fa-plug db-conn-icon"></i>
              <div class="db-conn-name">{{ record?.name ?? '数据库' }}</div>
              <div class="db-conn-line t3 mono">{{ targetText }}</div>
              <div class="db-conn-line t3">连接用户：{{ record?.username || '—' }}</div>
            </div>
            <p class="db-empty-title">准备编写查询</p>
            <button class="btn-p db-empty-btn" @click="store.openQueryTab()">新建查询</button>
            <p class="db-empty-tip t3">提示：双击侧边栏中的表格可查看其数据</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { DbCell, DbObjectKind } from '@protocol/db';
import { useDbStore, type DbPanelTab } from '@shared/stores/dbStore';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { getMiddlewareMeta } from '@shared/types/enums';
import DbObjectTree from '../components/db/DbObjectTree.vue';
import DbDataGrid from '../components/db/DbDataGrid.vue';
import DbMetaPanel from '../components/db/DbMetaPanel.vue';
import DbSqlEditor from '../components/db/DbSqlEditor.vue';
import DbQueryToolbar from '../components/db/DbQueryToolbar.vue';
import DbDatabaseSelect from '../components/db/DbDatabaseSelect.vue';
import DbRoutinePanel from '../components/db/DbRoutinePanel.vue';

const route = useRoute();
const router = useRouter();
const store = useDbStore();
const middlewareStore = useMiddlewareStore();
const dialog = useDialogStore();

const middlewareId = computed(() => String(route.params.middlewareId ?? ''));
const record = computed(() => middlewareStore.list.find(item => item.id === middlewareId.value) ?? null);

const iconStyle = computed(() => {
  const meta = record.value ? getMiddlewareMeta(record.value.type) : null;
  const color = meta?.color ?? '#2E6BF0';
  return { background: color, boxShadow: `0 5px 14px -4px ${color}` };
});

const targetText = computed(() => {
  const item = record.value;
  if (!item) return '';
  if (item.type === 'sqlite') {
    return String((item.extra as Record<string, unknown> | undefined)?.filePath ?? item.database ?? '');
  }
  return `${item.host}:${item.port}${item.database ? ` / ${item.database}` : ''}`;
});

const dialectLabel = computed(() => {
  const map: Record<string, string> = {
    postgres: 'PostgreSQL',
    mysql: 'MySQL',
    sqlite: 'SQLite',
    mssql: 'SQL Server',
    clickhouse: 'ClickHouse',
  };
  return store.dialect ? (map[store.dialect] ?? store.dialect) : '';
});

const statusText = computed(() => {
  if (store.status === 'connecting') return '连接中';
  if (store.status === 'ready') return '已连接';
  if (store.status === 'error') return '连接失败';
  return '未连接';
});

const activeKind = computed<'object' | 'query' | 'routine' | 'none'>(() => store.activeOpenTab?.kind ?? 'none');
const activeRoutine = computed(() => {
  const tab = store.activeOpenTab;
  return tab && tab.kind === 'routine' ? tab : null;
});
const activeProp = computed<DbPanelTab>(() => {
  const tab = store.activeOpenTab;
  return tab && tab.kind === 'object' ? tab.prop : 'data';
});

const propTabs: Array<{ key: DbPanelTab; label: string }> = [
  { key: 'data', label: '数据' },
  { key: 'schema', label: '结构' },
  { key: 'indexes', label: '索引' },
  { key: 'foreignKeys', label: '外键' },
  { key: 'triggers', label: '触发器' },
];

const activeSql = computed(() => store.activeTab?.sql ?? '');

/** 查询使用的库：跟随当前查询 tab，没有查询 tab 时用工作区的当前库 */
const queryDatabase = computed(() => store.activeTab?.database || store.currentDatabase);

function onSelectDatabase(name: string): void {
  store.setCurrentDatabase(name);
}

function setProp(prop: DbPanelTab): void {
  const tab = store.activeOpenTab;
  if (tab) store.setObjectProp(tab.id, prop);
}

function onSelectObject(schema: string | undefined, name: string, kind: DbObjectKind): void {
  // 表 / 视图看数据，函数 / 存储过程 / 触发器看定义
  if (kind === 'tables' || kind === 'views') {
    void store.openObjectTab(schema, name);
    return;
  }
  if (kind === 'functions' || kind === 'procedures' || kind === 'triggers') {
    void store.openRoutineTab(schema, name, kind);
  }
}

async function onViewProp(prop: DbPanelTab): Promise<void> {
  // 右键菜单作用于数据库下的第一张表
  const firstTable = store.objectsOf(store.activeSchema ?? '', 'tables')[0];
  if (!firstTable) return;
  await store.openObjectTab(store.activeSchema, firstTable.name);
  const tab = store.activeOpenTab;
  if (tab) store.setObjectProp(tab.id, prop);
}

function onSqlChange(value: string): void {
  if (store.activeQueryTabId) store.updateTabSql(store.activeQueryTabId, value);
}

function onCursorChange(position: number): void {
  if (store.activeQueryTabId) store.setCursor(store.activeQueryTabId, position);
}

async function runActive(): Promise<void> {
  if (!store.activeQueryTabId) {
    store.openQueryTab();
  }
  const id = store.activeQueryTabId;
  if (!id) return;
  await store.runSql(id, 'current');
}

async function runAll(): Promise<void> {
  if (!store.activeQueryTabId) {
    store.openQueryTab();
  }
  const id = store.activeQueryTabId;
  if (!id) return;
  await store.runSql(id, 'all');
}

function cancelActive(): void {
  if (store.activeQueryTabId) store.cancelSql(store.activeQueryTabId);
}

async function saveActive(): Promise<void> {
  const id = store.activeQueryTabId;
  if (!id) return;
  const name = await dialog.prompt('保存查询', '查询名称', store.activeTab?.title ?? '');
  if (!name) return;
  await store.saveQuery(id, name);
}

function onExportQuery(rows?: DbCell[][]): void {
  if (store.activeQueryTabId) store.exportCsv(store.activeQueryTabId, rows);
}

function onExportTable(rows?: DbCell[][]): void {
  store.exportResultCsv(store.tableData, 'dock-table', rows);
}

/** 保存单元格：返回 false 时保留编辑态 */
async function onSaveCell(rowIndex: number, column: string, value: string | null): Promise<boolean> {
  return store.updateCell(rowIndex, column, value);
}

function onQueryPageSize(size: number): void {
  if (store.activeQueryTabId) void store.setQueryPageSize(store.activeQueryTabId, size);
}

async function loadMoreQuery(): Promise<void> {
  if (!store.activeQueryTabId) return;
  await store.loadMoreQuery(store.activeQueryTabId);
}

async function reload(): Promise<void> {
  if (store.status !== 'ready') return;
  await store.loadDatabases();
  for (const db of store.databases) {
    await store.loadDatabaseObjects(db.name);
  }
  if (store.activeTable) {
    await store.openTable(store.activeTable.schema, store.activeTable.name, true);
  }
}

function reconnect(): void {
  store.disconnect();
  void store.connect(middlewareId.value);
}

function goBack(): void {
  router.push('/middlewares');
}

watch(middlewareId, (id) => {
  if (!id) return;
  store.disconnect();
  void store.connect(id);
  void store.loadSavedQueries();
});

onMounted(async () => {
  await middlewareStore.load();
  if (!middlewareId.value) return;
  await store.connect(middlewareId.value);
  await store.loadSavedQueries();
});

onBeforeUnmount(() => {
  store.disconnect();
});
</script>

<style scoped>
.db-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: var(--bg);
}
.db-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: var(--header-h);
  border-bottom: 1px solid var(--border);
  background: var(--header-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  flex-shrink: 0;
}
.db-head-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
}
.db-head-text { min-width: 0; }
.db-head-title { font-size: var(--text-md); font-weight: var(--font-bold); }
.db-head-sub { font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-spacer { flex: 1; }
.db-head-btn { height: 30px; padding: 0 10px; font-size: 12px; }
.db-status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ink3); }
.db-status i { font-size: 7px; }
.db-status.ready { color: var(--success); }
.db-status.error { color: var(--danger); }
.db-status.connecting { color: var(--warning); }
.db-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--danger-light);
  color: var(--danger-text);
  border-bottom: 1px solid var(--border);
  font-size: 12.5px;
}
.db-body { flex: 1; min-height: 0; display: flex; }
.db-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.db-tabs {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 0 8px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
  overflow-x: auto;
}
.db-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--ink3);
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
}
.db-tab:hover { color: var(--ink); }
.db-tab.active { color: var(--ink); border-bottom-color: var(--accent); }
.db-tab > i:first-child { font-size: 11px; opacity: .75; }
.db-tab-title { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.db-tab-close { font-size: 9px; opacity: .45; margin-left: 2px; }
.db-tab-close:hover { opacity: 1; }
.db-tab-add {
  width: 28px;
  border: none;
  background: none;
  color: var(--ink3);
  cursor: pointer;
  font-size: 11px;
}
.db-tab-add:hover { color: var(--accent); }

.db-props {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}
.db-prop {
  padding: 7px 10px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--ink3);
  font-size: 12.5px;
  cursor: pointer;
}
.db-prop:hover { color: var(--ink); }
.db-prop.active { color: var(--accent); border-bottom-color: var(--accent); }

.db-content { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.db-content > * { flex: 1; min-width: 0; }

/* 查询工作区：库选择 + 工具条 + 编辑器（占满）+ 结果 */
.db-query {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.db-query-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}
.db-query-hint { font-size: 12px; }
.db-query-main {
  display: flex;
  flex: 1 1 60%;
  min-height: 160px;
  overflow: hidden;
}
.db-query-editor { flex: 1; min-width: 0; overflow: hidden; }
.db-query-result {
  flex: 1 1 40%;
  min-height: 0;
  display: flex;
  border-top: 1px solid var(--border);
}
.db-query-result.empty { flex: 0 0 auto; }
.db-query-result > * { flex: 1; min-width: 0; }
.db-query-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px;
  font-size: 12px;
}

.db-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
}
.db-conn-card {
  min-width: 260px;
  padding: 22px 26px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--panel);
  text-align: center;
  box-shadow: var(--shadow-sm);
}
.db-conn-icon { color: var(--accent); font-size: 16px; margin-bottom: 8px; }
.db-conn-name { font-size: var(--text-md); font-weight: var(--font-bold); color: var(--ink); }
.db-conn-line { font-size: var(--text-xs); margin-top: 4px; }
.db-empty-title { font-size: var(--text-base); color: var(--ink2); }
.db-empty-btn { min-width: 180px; }
.db-empty-tip { font-size: var(--text-xs); }

.db-sql-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--danger-light);
  color: var(--danger-text);
  font-size: 12px;
}
</style>
