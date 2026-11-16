<template>
  <aside class="db-tree">
    <div class="db-tree-head">
      <span class="db-tree-title-label t3">
        <i class="fa-solid fa-database"></i>{{ databases.length ? '库' : '连接中…' }}
      </span>
      <button class="ibtn" title="刷新" @click="emit('reload')">
        <i class="fa-solid fa-rotate"></i>
      </button>
    </div>
    <div class="db-tree-body" @contextmenu.prevent="onContextMenu">
      <div v-for="db in databases" :key="db.name" class="db-node">
        <button class="db-row db-row-db" @click="toggleDb(db.name)" @dblclick="emit('expand-database', db.name)">
          <i class="fa-regular fa-square db-caret" :class="{ open: isDbOpen(db.name) }"></i>
          <i class="fa-solid fa-database db-row-icon"></i>
          <span class="db-row-name">{{ db.name }}</span>
        </button>

        <div v-if="isDbOpen(db.name)" class="db-children">
          <div v-for="group in groups" :key="group.kind" class="db-node">
            <button class="db-row db-row-group" @click="toggleGroup(db.name, group.kind)">
              <i class="fa-regular fa-square db-caret" :class="{ open: isGroupOpen(db.name, group.kind) }"></i>
              <i :class="[group.icon, group.kind === 'tables' ? 'db-icon-green' : '']" class="db-row-icon"></i>
              <span class="db-row-name">{{ group.label }}</span>
              <span class="db-row-count t3">{{ countOf(db.name, group.kind) }}</span>
            </button>

            <div v-if="isGroupOpen(db.name, group.kind)" class="db-children">
              <button
                v-for="item in objectsOf(db.name, group.kind)"
                :key="item.name"
                class="db-row db-row-leaf"
                :class="{ active: isActive(item) }"
                :title="item.name"
                :draggable="group.kind === 'tables' || group.kind === 'views'"
                @dragstart="onDragStart($event, db.name, item)"
                @click="emit('select-object', db.name, item.name, group.kind)"
                @dblclick="emit('select-object', db.name, item.name, group.kind)"
              >
                <i :class="[leafIcon(group.kind), group.kind === 'tables' ? 'db-icon-green' : '']" class="db-row-icon"></i>
                <span class="db-row-name">{{ item.name }}</span>
              </button>
              <div v-if="objectsOf(db.name, group.kind).length === 0" class="db-row-empty t3">—</div>
            </div>
          </div>
          <div v-if="isLoading(db.name)" class="db-row-empty t3">加载中…</div>
        </div>
      </div>
      <div v-if="databases.length === 0" class="db-row-empty t3">未找到库</div>
    </div>

    <div v-if="menu.open" class="db-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }">
      <button class="db-menu-item" @click="runMenu('query')">
        <i class="fa-regular fa-file-lines"></i>新建查询
      </button>
      <div class="db-menu-sep"></div>
      <button class="db-menu-item" @click="runMenu('data')">
        <i class="fa-solid fa-table"></i>查看数据
      </button>
      <button class="db-menu-item" @click="runMenu('schema')">
        <i class="fa-solid fa-list"></i>查看结构
      </button>
      <button class="db-menu-item" @click="runMenu('indexes')">
        <i class="fa-solid fa-key"></i>查看索引
      </button>
      <button class="db-menu-item" @click="runMenu('foreignKeys')">
        <i class="fa-solid fa-link"></i>查看外键
      </button>
      <button class="db-menu-item" @click="runMenu('triggers')">
        <i class="fa-solid fa-bolt"></i>查看触发器
      </button>
      <div class="db-menu-sep"></div>
      <button class="db-menu-item" @click="runMenu('refresh')">
        <i class="fa-solid fa-rotate"></i>刷新
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { DbObjectItem, DbObjectKind } from '@protocol/db';
import type { DbPanelTab } from '@shared/stores/dbStore';

const props = defineProps<{
  databases: DbObjectItem[];
  objectsOf: (database: string, kind: DbObjectKind) => DbObjectItem[];
  isLoading?: (database: string) => boolean;
  activeTable?: { schema?: string; name: string } | null;
  /** 当前打开的存储过程 / 函数 / 触发器名（用于高亮） */
  activeRoutine?: string | null;
  /** 方言能力位：不支持的对象类型不展示 */
  capabilities?: { functions: boolean; procedures: boolean; triggers: boolean; foreignKeys: boolean };
}>();

const emit = defineEmits<{
  /** 选中一个对象：表 / 视图按表处理，函数 / 存储过程 / 触发器看定义 */
  'select-object': [schema: string | undefined, name: string, kind: DbObjectKind];
  'expand-database': [database: string];
  'new-query': [];
  'view-prop': [prop: DbPanelTab];
  reload: [];
}>();

const ALL_GROUPS: Array<{ kind: DbObjectKind; label: string; icon: string }> = [
  { kind: 'tables', label: '表', icon: 'fa-solid fa-table' },
  { kind: 'views', label: '视图', icon: 'fa-solid fa-eye' },
  { kind: 'functions', label: '函数', icon: 'fa-solid fa-calculator' },
  { kind: 'procedures', label: '存储过程', icon: 'fa-solid fa-gears' },
  { kind: 'triggers', label: '触发器', icon: 'fa-solid fa-bolt' },
];

/** 叶子节点按类型给图标（表为绿色） */
function leafIcon(kind: DbObjectKind): string {
  switch (kind) {
    case 'tables':
      return 'fa-solid fa-table';
    case 'views':
      return 'fa-solid fa-eye';
    case 'functions':
      return 'fa-solid fa-calculator';
    case 'procedures':
      return 'fa-solid fa-gears';
    case 'triggers':
      return 'fa-solid fa-bolt';
    default:
      return 'fa-solid fa-table';
  }
}

const groups = computed(() => ALL_GROUPS.filter(group => {
  const caps = props.capabilities;
  if (!caps) return true;
  if (group.kind === 'functions') return caps.functions;
  if (group.kind === 'procedures') return caps.procedures;
  if (group.kind === 'triggers') return caps.triggers;
  return true;
}));

const expandedDbs = ref<string[]>([]);
const expandedGroups = ref<string[]>([]);

// 第一次拿到库列表时自动展开第一个库，并默认展开它的「表」
watch(() => props.databases, (list) => {
  if (list.length > 0 && expandedDbs.value.length === 0) {
    const first = list[0].name;
    expandedDbs.value = [first];
    emit('expand-database', first);
    expandedGroups.value = [`${first}::tables`];
  }
}, { immediate: true });

function isDbOpen(name: string): boolean {
  return expandedDbs.value.includes(name);
}

function isGroupOpen(database: string, kind: DbObjectKind): boolean {
  return expandedGroups.value.includes(`${database}::${kind}`);
}

function isLoading(database: string): boolean {
  return props.isLoading?.(database) === true;
}

function countOf(database: string, kind: DbObjectKind): number {
  return props.objectsOf(database, kind).length;
}

function isActive(item: DbObjectItem): boolean {
  if (props.activeTable?.name === item.name) return true;
  return !!props.activeRoutine && props.activeRoutine === item.name;
}

/** 拖到编辑器里插入表名 */
function onDragStart(event: DragEvent, database: string, item: DbObjectItem): void {
  const transfer = event.dataTransfer;
  if (!transfer) return;
  transfer.setData('application/x-dock-db-table', JSON.stringify({ schema: database, name: item.name }));
  transfer.setData('text/plain', item.name);
  transfer.effectAllowed = 'copy';
}

function toggleDb(name: string): void {
  if (isDbOpen(name)) {
    expandedDbs.value = expandedDbs.value.filter(item => item !== name);
    return;
  }
  expandedDbs.value = [...expandedDbs.value, name];
  emit('expand-database', name);
  // 展开库时默认展开「表」
  const key = `${name}::tables`;
  if (!expandedGroups.value.includes(key)) expandedGroups.value = [...expandedGroups.value, key];
}

function toggleGroup(database: string, kind: DbObjectKind): void {
  const key = `${database}::${kind}`;
  if (isGroupOpen(database, kind)) {
    expandedGroups.value = expandedGroups.value.filter(item => item !== key);
    return;
  }
  expandedGroups.value = [...expandedGroups.value, key];
}

// ---------- 右键菜单 ----------

const menu = ref({ open: false, x: 0, y: 0, database: '' });

function onContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  const row = target?.closest('.db-row-db') as HTMLElement | null;
  const database = row?.innerText.trim() ?? '';
  if (!database) return;
  menu.value = { open: true, x: event.clientX, y: event.clientY, database };
}

function closeMenu(): void {
  menu.value = { ...menu.value, open: false };
}

function runMenu(action: 'query' | DbPanelTab | 'refresh'): void {
  const database = menu.value.database;
  closeMenu();
  if (action === 'query') {
    emit('new-query');
    return;
  }
  if (action === 'refresh') {
    emit('expand-database', database);
    emit('reload');
    return;
  }
  emit('view-prop', action);
}

onBeforeUnmount(closeMenu);
</script>

<style scoped>
.db-tree {
  width: 252px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  position: relative;
}
.db-tree-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
.db-tree-title-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: .3px;
  flex: 1;
}
.db-tree-body { flex: 1; min-height: 0; overflow: auto; padding: 4px 0 12px; }
.db-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 10px 4px 8px;
  border: none;
  background: none;
  color: var(--ink2);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.db-row:hover { background: var(--surface-hover); color: var(--ink); }
.db-row-db { color: var(--ink); font-weight: var(--font-medium); }
.db-row-group { color: var(--ink2); }
.db-row-leaf { padding-left: 26px; color: var(--ink3); cursor: grab; }
.db-row-leaf.active { background: var(--primary-50); color: var(--accent); }
.db-caret { font-size: 8px; opacity: .55; width: 8px; }
.db-caret.open { transform: rotate(90deg); }
.db-row-icon { font-size: 11px; opacity: .8; width: 13px; }
.db-icon-green { color: #16a34a; opacity: 1; }
.db-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-row-count { margin-left: auto; font-size: 11px; }
.db-children { border-left: 1px solid var(--border-soft); margin-left: 16px; }
.db-row-empty { padding: 3px 10px 3px 26px; font-size: 12px; }

.db-menu {
  position: fixed;
  z-index: 60;
  min-width: 168px;
  padding: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.db-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--ink2);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.db-menu-item:hover { background: var(--surface-hover); color: var(--ink); }
.db-menu-item i { width: 13px; font-size: 11px; opacity: .75; }
.db-menu-sep { height: 1px; margin: 4px 2px; background: var(--border); }
</style>
