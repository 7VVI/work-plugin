<template>
  <div class="db-grid-wrap" :class="{ 'is-fullscreen': fullscreen }">
    <!-- 工具条：刷新 / 导出（编辑时出现保存 / 取消）+ 全屏 -->
    <div class="db-grid-bar">
      <div class="db-grid-bar-group">
        <button
          v-if="refreshable"
          class="db-grid-btn db-grid-btn-primary"
          title="重新查询"
          @click="emit('refresh')"
        >
          <i class="fa-solid fa-rotate"></i>刷新
        </button>
        <button class="db-grid-btn" title="导出为 CSV" @click="emit('export', exportRows)">
          <i class="fa-solid fa-file-csv"></i>导出
        </button>
        <template v-if="editing">
          <button class="db-grid-btn db-grid-btn-primary" title="保存修改 (Enter)" @click="saveEdit">
            <i class="fa-solid fa-floppy-disk"></i>保存
          </button>
          <button class="db-grid-btn" title="放弃修改 (Esc)" @click="cancelEdit">
            <i class="fa-solid fa-xmark"></i>取消
          </button>
        </template>
      </div>
      <div class="db-grid-bar-group db-grid-bar-right">
        <button class="db-grid-btn db-grid-btn-icon" title="全屏查看" @click="fullscreen = !fullscreen">
          <i class="fa-solid" :class="fullscreen ? 'fa-compress' : 'fa-expand'"></i>
        </button>
      </div>
    </div>

    <div v-if="loading" class="db-grid-hint t3">
      <i class="fa-solid fa-spinner fa-spin"></i> 加载中…
    </div>
    <div v-else-if="!result" class="db-grid-hint t3">暂无数据</div>
    <template v-else>
      <div ref="scrollEl" class="db-grid-scroll" @scroll="onScroll">
        <table class="db-grid" :style="{ width: `max(100%, ${tableWidth}px)` }">
          <thead>
            <tr>
              <th class="db-grid-check">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  title="全选已加载的行"
                  @change="toggleAll"
                />
              </th>
              <th class="db-grid-idx" style="width: 56px">
                #
              </th>
              <th
                v-for="col in result.columns"
                :key="col.name"
                class="db-grid-th"
                :title="`${col.name}${col.dataType ? ' · ' + col.dataType : ''}`"
                :style="{ width: `${widthOf(col.name)}px` }"
              >
                <button class="db-grid-th-btn" :title="`按 ${col.name} 排序`" @click="toggleSort(col.name)">
                  <span class="db-grid-th-text">{{ col.name }}</span>
                  <i class="db-grid-sort" :class="sortIcon(col.name)"></i>
                </button>
                <span
                  class="db-grid-resizer"
                  title="拖动调整列宽"
                  @mousedown.prevent="startResize($event, col.name)"
                ></span>
                <span v-if="col.primary" class="db-grid-pk" title="主键">PK</span>
              </th>
              <th class="db-grid-filler"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in displayRows"
              :key="item.index"
              :class="{ 'is-selected': selected.has(item.index) }"
            >
              <td class="db-grid-check">
                <input
                  type="checkbox"
                  :checked="selected.has(item.index)"
                  @change="toggleRow(item.index)"
                />
              </td>
              <td class="db-grid-idx t3">{{ item.index + 1 }}</td>
              <td
                v-for="(cell, cellIndex) in item.row"
                :key="cellIndex"
                class="db-grid-cell mono"
                :class="{ 'is-editing': isEditing(item.index, result.columns[cellIndex]?.name) }"
                :title="cellText(cell)"
                @dblclick="startEdit(item.index, result.columns[cellIndex]?.name, cell)"
              >
                <input
                  v-if="isEditing(item.index, result.columns[cellIndex]?.name)"
                  ref="editInput"
                  v-model="editValue"
                  class="db-grid-edit"
                  @keyup.enter="saveEdit"
                  @keyup.esc="cancelEdit"
                  @blur="saveEdit"
                />
                <span v-else :class="cellClass(cell)">{{ cellText(cell) }}</span>
              </td>
              <td class="db-grid-filler"></td>
            </tr>
            <tr v-if="loadingMore">
              <td class="db-grid-check"></td>
              <td class="db-grid-idx"></td>
              <td class="db-grid-cell db-grid-loading t3" :colspan="Math.max(1, result.columns.length)">
                <i class="fa-solid fa-spinner fa-spin"></i> 正在加载更多…
              </td>
              <td class="db-grid-filler"></td>
            </tr>
            <tr v-if="displayRows.length === 0">
              <td class="db-grid-check"></td>
              <td class="db-grid-idx"></td>
              <td class="db-grid-cell db-grid-loading t3" :colspan="Math.max(1, result.columns.length)">
                没有数据
              </td>
              <td class="db-grid-filler"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="db-grid-foot t3">
        <span>共 {{ result.rowCount }} 行</span>
        <span>· 当前显示 {{ rangeStart }} - {{ rangeEnd }} 行</span>
        <span v-if="selected.size">· 已选 {{ selected.size }} 行</span>
        <span v-if="result.affectedRows !== undefined">· 影响 {{ result.affectedRows }} 行</span>
        <span>· {{ result.elapsedMs }} ms</span>
        <span v-if="result.truncated && !hasMore" class="db-grid-warn">· 结果已截断</span>
        <span class="db-grid-spacer"></span>
        <span v-if="hasMore && !loadingMore" class="db-grid-more">
          <i class="fa-solid fa-arrow-down"></i> 继续下滑加载更多
        </span>
        <label class="db-grid-size">
          每页
          <input
            class="db-grid-size-input"
            type="number"
            min="1"
            max="10000"
            :value="pageSize"
            @change="onPageSizeChange"
          />
          行
        </label>
        <button
          v-if="hasMore"
          class="db-grid-btn db-grid-btn-more"
          :title="`再取 ${pageSize ?? 0} 行`"
          :disabled="loadingMore"
          @click="emit('load-more')"
        >
          {{ pageSize ?? 0 }}+
        </button>
        <slot name="footer" />
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { DbCell } from '@protocol/db';
import type { DbQueryOutcome } from '@shared/db/DbClient';

const props = defineProps<{
  result: DbQueryOutcome | null;
  loading?: boolean;
  /** 每页行数 */
  pageSize?: number;
  /** 是否还有下一页 */
  hasMore?: boolean;
  loadingMore?: boolean;
  /** 显示「刷新」按钮（表数据页用） */
  refreshable?: boolean;
  /** 允许直接编辑单元格（表数据页用） */
  editable?: boolean;
  /** 保存单元格：返回 false 表示失败，编辑态保留 */
  onSaveCell?: (rowIndex: number, column: string, value: string | null) => Promise<boolean>;
}>();

const emit = defineEmits<{
  'load-more': [];
  export: [rows?: DbCell[][]];
  refresh: [];
  'update:pageSize': [size: number];
}>();

const CHECK_WIDTH = 34;
const INDEX_WIDTH = 56;
const DEFAULT_WIDTH = 180;
const MIN_WIDTH = 60;
const MAX_WIDTH = 1200;

/** 列名 → 宽度（px），切换结果时保留同名列的宽度 */
const columnWidths = ref<Record<string, number>>({});
const scrollEl = ref<HTMLElement | null>(null);
const fullscreen = ref(false);
/** 正在编辑的单元格 */
const editing = ref<{ rowIndex: number; column: string; original: string } | null>(null);
const editValue = ref('');
const saving = ref(false);
/** 选中行的下标（对应原始行号） */
const selected = ref<Set<number>>(new Set());
const sortKey = ref('');
const sortDir = ref<'asc' | 'desc'>('asc');

watch(
  () => props.result?.columns.map(col => col.name).join('|'),
  () => {
    // 结果集换了：只保留仍然存在的列的宽度
    const names = new Set((props.result?.columns ?? []).map(col => col.name));
    const next: Record<string, number> = {};
    for (const [name, width] of Object.entries(columnWidths.value)) {
      if (names.has(name)) next[name] = width;
    }
    columnWidths.value = next;
    selected.value = new Set();
  },
);

function widthOf(name: string): number {
  return columnWidths.value[name] ?? DEFAULT_WIDTH;
}

/** 表格宽度 = 各列宽之和，列宽才是真实像素值（否则会被 100% 宽度按比例缩放） */
const tableWidth = computed(() => {
  const columns = props.result?.columns ?? [];
  return CHECK_WIDTH + INDEX_WIDTH + columns.reduce((sum, col) => sum + widthOf(col.name), 0);
});

/** 展示行：按列排序，并保留原始行号 */
const displayRows = computed(() => {
  const rows = props.result?.rows ?? [];
  const items = rows.map((row, index) => ({ row, index }));
  if (!sortKey.value) return items;
  const columnIndex = (props.result?.columns ?? []).findIndex(col => col.name === sortKey.value);
  if (columnIndex < 0) return items;
  const factor = sortDir.value === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = a.row[columnIndex];
    const right = b.row[columnIndex];
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    const text = String(cellText(left)).localeCompare(String(cellText(right)), 'zh-CN');
    return (text === 0 ? a.index - b.index : text) * factor;
  });
});

const rangeStart = computed(() => (displayRows.value.length ? 1 : 0));
const rangeEnd = computed(() => displayRows.value.length);
const allSelected = computed(() => {
  const rows = props.result?.rows.length ?? 0;
  return rows > 0 && selected.value.size === rows;
});

/** 导出：勾选了行就只导勾选的，否则导当前展示的行 */
const exportRows = computed(() => {
  if (selected.value.size) {
    return displayRows.value.filter(item => selected.value.has(item.index)).map(item => item.row);
  }
  return undefined;
});

function toggleSort(name: string): void {
  if (sortKey.value === name) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    return;
  }
  sortKey.value = name;
  sortDir.value = 'asc';
}

function sortIcon(name: string): string {
  if (sortKey.value !== name) return 'fa-sort';
  return sortDir.value === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
}

function toggleRow(index: number): void {
  const next = new Set(selected.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  selected.value = next;
}

function toggleAll(): void {
  const rows = props.result?.rows.length ?? 0;
  selected.value = allSelected.value ? new Set() : new Set(Array.from({ length: rows }, (_, i) => i));
}

function onPageSizeChange(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(value) && value > 0) emit('update:pageSize', Math.floor(value));
}

// ---------- 单元格编辑 ----------

function isEditing(rowIndex: number, column: string | undefined): boolean {
  return !!editing.value && editing.value.rowIndex === rowIndex && editing.value.column === column;
}

function startEdit(rowIndex: number, column: string | undefined, cell: DbCell): void {
  if (!props.editable || !column) return;
  const original = cell === null || cell === undefined ? '' : String(cell);
  editing.value = { rowIndex, column, original };
  editValue.value = original;
  // 下一帧聚焦输入框
  void nextTick(() => {
    const input = document.querySelector('.db-grid-edit') as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });
}

function cancelEdit(): void {
  editing.value = null;
  editValue.value = '';
}

async function saveEdit(): Promise<void> {
  const current = editing.value;
  if (!current || saving.value) return;
  const value = editValue.value;
  if (value === current.original) {
    cancelEdit();
    return;
  }
  saving.value = true;
  try {
    const ok = await props.onSaveCell?.(current.rowIndex, current.column, value === '' ? null : value);
    if (ok !== false) editing.value = null;
  } finally {
    saving.value = false;
  }
}

function startResize(event: MouseEvent, name: string): void {
  if (!name) return;
  const startX = event.clientX;
  // 用记录下来的列宽做基准（末列可能被拉宽填满面板，取实际渲染宽度会跳）
  const startWidth = columnWidths.value[name] ?? DEFAULT_WIDTH;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';

  const onMove = (moveEvent: MouseEvent) => {
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX)));
    columnWidths.value = { ...columnWidths.value, [name]: Math.round(width) };
  };
  const onUp = () => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function onScroll(): void {
  const el = scrollEl.value;
  if (!el || !props.hasMore || props.loadingMore) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
    emit('load-more');
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && fullscreen.value) fullscreen.value = false;
}

watch(fullscreen, value => {
  if (value) window.addEventListener('keydown', onKeyDown);
  else window.removeEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));

function isBinary(cell: DbCell): cell is { __bin: true; bytes: number; base64: string } {
  return typeof cell === 'object' && cell !== null && '__bin' in cell;
}

function cellText(cell: DbCell): string {
  if (cell === null || cell === undefined) return 'NULL';
  if (typeof cell === 'boolean') return cell ? 'true' : 'false';
  if (isBinary(cell)) return cell.base64 ? `二进制 ${cell.bytes} B` : `二进制 ${cell.bytes} B（未内联）`;
  return String(cell);
}

function cellClass(cell: DbCell): string {
  if (cell === null || cell === undefined) return 'db-cell-null';
  if (isBinary(cell)) return 'db-cell-bin';
  return '';
}
</script>

<style scoped>
.db-grid-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--panel);
}
.db-grid-wrap.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 120;
  border-top: 1px solid var(--border);
}

/* 工具条 */
.db-grid-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}
.db-grid-bar-group { display: flex; align-items: center; gap: 6px; }
.db-grid-bar-right { margin-left: auto; }
.db-grid-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--ink2);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.db-grid-btn:hover:not(:disabled) { border-color: var(--border-strong); color: var(--ink); }
.db-grid-btn:disabled { opacity: .5; cursor: not-allowed; }
.db-grid-btn.is-active { border-color: var(--accent); color: var(--accent); background: var(--primary-50); }
.db-grid-btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.db-grid-btn-primary:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); color: #fff; }
.db-grid-btn-icon { width: 28px; padding: 0; justify-content: center; }

.db-grid-hint { padding: 24px; text-align: center; font-size: 12.5px; }
.db-grid-scroll { flex: 1; min-height: 0; overflow: auto; }
.db-grid {
  border-collapse: collapse;
  font-size: 12.5px;
  table-layout: fixed;
  background: var(--panel);
}
.db-grid th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  font-weight: var(--font-medium);
  color: var(--ink2);
  background: var(--panel2);
  border-bottom: 1px solid var(--border);
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
}
.db-grid-th-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}
.db-grid-th-btn:hover { color: var(--accent); }
.db-grid-th-text { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.db-grid-sort { font-size: 10px; opacity: .45; }
.db-grid-th-btn:hover .db-grid-sort { opacity: .8; }
.db-grid-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  height: 100%;
  cursor: col-resize;
  background: linear-gradient(to right, transparent 0, transparent 9px, var(--border) 9px, var(--border) 11px, transparent 11px);
  background-size: 12px 100%;
}
.db-grid-resizer:hover { background: linear-gradient(to right, transparent 0, transparent 8px, var(--accent) 8px, var(--accent) 10px, transparent 10px); }
.db-grid td {
  border-bottom: 1px solid var(--border-soft);
  padding: 6px 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.db-grid tbody tr:nth-child(even) td { background: var(--panel2); }
.db-grid tbody tr:hover td { background: var(--surface-hover); }
.db-grid tbody tr.is-selected td { background: var(--primary-50); }
.db-grid-check { width: 34px; text-align: center; padding: 0 !important; }
.db-grid-check input { cursor: pointer; }
/* 末尾填充列：表格填满面板宽度，各数据列仍是精确像素宽 */
.db-grid-filler { width: auto; padding: 0 !important; }
.db-grid-idx { width: 56px; color: var(--ink4); }
.db-grid-loading { text-align: center; padding: 10px; }
.db-grid-pk {
  margin-left: 4px;
  font-size: 9.5px;
  color: var(--accent);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 3px;
}
.db-cell-null { color: var(--ink4); font-style: italic; }
.db-cell-bin { color: var(--warning); }
.db-grid-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-top: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}
.db-grid-spacer { flex: 1; }
.db-grid-warn { color: var(--warning); }
.db-grid-more { display: inline-flex; align-items: center; gap: 4px; color: var(--ink3); }
.db-grid-size { display: inline-flex; align-items: center; gap: 5px; }
.db-grid-size-input {
  width: 62px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--ink2);
  font-size: 11.5px;
  text-align: right;
  outline: none;
}
.db-grid-size-input:focus { border-color: var(--accent); }
.db-grid-btn-more { height: 24px; padding: 0 8px; font-size: 11.5px; }
/* 单元格编辑 */
.db-grid-cell.is-editing { padding: 0 !important; background: var(--panel) !important; }
.db-grid-edit {
  width: 100%;
  height: 100%;
  min-height: 26px;
  padding: 6px 10px;
  border: 2px solid var(--accent);
  border-radius: 2px;
  background: var(--panel);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12.5px;
  outline: none;
}
</style>
