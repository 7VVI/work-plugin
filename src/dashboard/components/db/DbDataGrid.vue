<template>
  <div class="db-grid-wrap">
    <div v-if="loading" class="db-grid-hint t3">
      <i class="fa-solid fa-spinner fa-spin"></i> 加载中…
    </div>
    <div v-else-if="!result" class="db-grid-hint t3">暂无数据</div>
    <template v-else>
      <div class="db-grid-scroll">
        <table class="db-grid">
          <thead>
            <tr>
              <th class="db-grid-idx" style="width: 48px">
                #
              </th>
              <th
                v-for="col in result.columns"
                :key="col.name"
                :title="`${col.name}${col.dataType ? ' · ' + col.dataType : ''}`"
                :style="{ width: `${widthOf(col.name)}px` }"
              >
                <span class="db-grid-th-text">{{ col.name }}</span>
                <span
                  class="db-grid-resizer"
                  title="拖动调整列宽"
                  @mousedown.prevent="startResize($event, col.name)"
                ></span>
                <span v-if="col.primary" class="db-grid-pk" title="主键">PK</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in result.rows" :key="rowIndex">
              <td class="db-grid-idx t3">{{ rowIndex + 1 }}</td>
              <td
                v-for="(cell, cellIndex) in row"
                :key="cellIndex"
                class="db-grid-cell mono"
                :title="cellText(cell)"
              >
                <span :class="cellClass(cell)">{{ cellText(cell) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="db-grid-foot t3">
        <span>{{ result.rowCount }} 行</span>
        <span v-if="result.affectedRows !== undefined">· 影响 {{ result.affectedRows }} 行</span>
        <span>· {{ result.elapsedMs }} ms</span>
        <span v-if="result.truncated" class="db-grid-warn">· 结果已截断</span>
        <span class="db-grid-spacer"></span>
        <template v-if="paging">
          <span class="db-grid-page t3">{{ pageOffset + 1 }}–{{ pageOffset + result.rowCount }}</span>
          <button class="db-grid-btn" :disabled="pageOffset <= 0" @click="emit('prev')">
            <i class="fa-solid fa-chevron-left"></i>上一页
          </button>
          <button class="db-grid-btn" :disabled="!hasNext" @click="emit('next')">
            下一页<i class="fa-solid fa-chevron-right"></i>
          </button>
        </template>
        <button class="db-grid-btn" @click="emit('export')">
          <i class="fa-solid fa-file-csv"></i>导出 CSV
        </button>
        <slot name="footer" />
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DbCell } from '@protocol/db';
import type { DbQueryOutcome } from '@shared/db/DbClient';

const props = defineProps<{
  result: DbQueryOutcome | null;
  loading?: boolean;
  /** 是否显示翻页控件 */
  paging?: boolean;
  offset?: number;
  hasNext?: boolean;
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
  export: [];
}>();

const DEFAULT_WIDTH = 180;
const MIN_WIDTH = 60;
const MAX_WIDTH = 1200;

/** 列名 → 宽度（px），切换结果时保留同名列的宽度 */
const columnWidths = ref<Record<string, number>>({});
const resizing = ref<string | null>(null);
const pageOffset = computed(() => props.offset ?? 0);

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
  },
);

function widthOf(name: string): number {
  return columnWidths.value[name] ?? DEFAULT_WIDTH;
}

function startResize(event: MouseEvent, name: string): void {
  const th = (event.target as HTMLElement).closest('th') as HTMLElement | null;
  if (!th) return;
  const startX = event.clientX;
  const startWidth = th.getBoundingClientRect().width;
  resizing.value = name;

  const onMove = (moveEvent: MouseEvent) => {
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX)));
    columnWidths.value = { ...columnWidths.value, [name]: Math.round(width) };
  };
  const onUp = () => {
    resizing.value = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

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
.db-grid-wrap { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.db-grid-scroll { flex: 1; min-height: 0; overflow: auto; }
.db-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  table-layout: fixed;
}
.db-grid th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  font-weight: var(--font-medium);
  color: var(--ink2);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  padding: 7px 10px;
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
}
.db-grid-th-text { display: inline-block; max-width: calc(100% - 14px); overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }
.db-grid-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  border-right: 2px solid transparent;
}
.db-grid-resizer:hover { border-right-color: var(--accent); }
.db-grid td {
  border-bottom: 1px solid var(--border-soft);
  padding: 6px 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.db-grid tbody tr:hover td { background: var(--surface-hover); }
.db-grid-idx { width: 48px; color: var(--ink4); }
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
  padding: 6px 10px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}
.db-grid-spacer { flex: 1; }
.db-grid-warn { color: var(--warning); }
.db-grid-page { margin-right: 4px; }
.db-grid-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--ink2);
  font-size: 11.5px;
  cursor: pointer;
}
.db-grid-btn:hover:not(:disabled) { border-color: var(--border-strong); color: var(--ink); }
.db-grid-btn:disabled { opacity: .45; cursor: not-allowed; }
</style>
