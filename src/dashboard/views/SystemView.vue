<template>
  <div class="system-view">
    <!-- 操作栏 - v3 风格 -->
    <div class="action-bar rise d1">
      <button class="btn btn-primary btn-create" @click="onCreate">
        <i class="fa-solid fa-plus icon-11"></i>新增系统
      </button>
      <button v-if="selectedIds.size > 0" class="btn btn-danger" @click="onBulkDelete">
        <i class="fa-regular fa-trash-can icon-11"></i>删除选中<span v-if="selectedIds.size" class="sel-count">（{{ selectedIds.size }}）</span>
      </button>
      <div class="flex-spacer"></div>
      <!-- 视图切换 - v3 风格 -->
      <div class="view-toggle">
        <button class="view-btn" :class="{ active: viewMode === 'table' }" title="列表视图" @click="viewMode = 'table'">
          <i class="fa-solid fa-list icon-12"></i>
        </button>
        <button class="view-btn" :class="{ active: viewMode === 'card' }" title="网格视图" @click="viewMode = 'card'">
          <i class="fa-solid fa-table-cells-large icon-12"></i>
        </button>
      </div>
      <!-- 搜索框 - v3 风格 -->
      <div class="search-wrap search-wide-wrap">
        <i class="fa-solid fa-magnifying-glass search-ico t3"></i>
        <input v-model="search" class="search-input search-wide" placeholder="搜索系统名称、URL、标签…" />
      </div>
    </div>

    <!-- 列表视图 - v3 风格 -->
    <div v-if="viewMode === 'table'" class="systems-list panel rise d2">
      <table class="data-table">
        <thead class="table-head">
          <tr>
            <th class="col-check">
              <input type="checkbox" class="row-checkbox" style="accent-color:var(--accent)" :checked="allChecked" @change="toggleAll" />
            </th>
            <th class="col-name">系统名称</th>
            <th class="col-url">URL</th>
            <th class="col-env">环境</th>
            <th class="col-acct">账号</th>
            <th class="col-updated">最近更新</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <VueDraggable
          v-model="filteredSystems"
          tag="tbody"
          :animation="200"
          ghost-class="dragging"
          handle=".drag-handle"
          @end="onDragEnd"
        >
          <tr v-for="s in filteredSystems" :key="s.id" class="row-group">
            <td class="col-check">
              <input type="checkbox" class="row-checkbox" style="accent-color:var(--accent)" :checked="selectedIds.has(s.id)" @change="toggleOne(s.id)" />
            </td>
            <td class="col-name">
              <div class="name-cell">
                <span class="sys-icon" :style="iconStyle(s)">
                  <i :class="s.icon || 'fa-solid fa-globe'"></i>
                </span>
                <span class="name-text">
                  <span class="sys-name t1">{{ s.name }}</span>
                </span>
              </div>
            </td>
            <td class="col-url">
              <span class="url-cell">
                <i class="fa-solid fa-link t3"></i>
                <span class="url-text t2">{{ s.url }}</span>
                <button class="ibtn ibtn-tiny url-copy" title="复制链接" @click.stop="copyUrl(s.url)">
                  <i class="fa-regular fa-copy icon-10"></i>
                </button>
              </span>
            </td>
            <td class="col-env"><EnvBadge :env="s.environment" /></td>
            <td class="col-acct">
              <span class="acct-cell t2">
                <i class="fa-solid fa-key icon-10 t3"></i>{{ acctCounts[s.id] ?? 0 }} 个
              </span>
            </td>
            <td class="col-updated t3">{{ formatRelativeTime(s.updatedAt) }}</td>
            <td class="col-actions">
              <div class="row-actions-fade">
                <button class="ibtn" title="编辑" @click.stop="onEdit(s)"><i class="fa-solid fa-pen"></i></button>
                <button class="ibtn" title="打开系统" @click.stop="onOpen(s)"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                <button class="ibtn danger" title="删除" @click.stop="onDelete(s.id)"><i class="fa-regular fa-trash-can"></i></button>
                <i class="fa-solid fa-grip-vertical drag-handle row-grip" title="拖动排序"></i>
              </div>
            </td>
          </tr>
          <tr v-if="filteredSystems.length === 0">
            <td colspan="7" class="empty-row">
              <i class="fa-regular fa-folder-open empty-icon t3"></i>
              <div class="empty-text t3">{{ search ? '未找到匹配的系统' : '暂无系统，点击"新增系统"创建' }}</div>
            </td>
          </tr>
        </VueDraggable>
      </table>
    </div>

    <!-- 网格视图 - v3 风格 -->
    <VueDraggable
      v-else
      v-model="filteredSystems"
      class="systems-grid rise d2"
      :animation="200"
      ghost-class="dragging"
      @end="onDragEnd"
    >
      <div v-for="s in filteredSystems" :key="s.id" class="panel stat-card grid-card" @click="onOpen(s)">
        <div class="grid-card-top">
          <span class="grid-icon" :style="iconStyle(s)">
            <i :class="s.icon || 'fa-solid fa-globe'"></i>
          </span>
          <EnvBadge :env="s.environment" />
        </div>
        <div class="grid-card-name t1">{{ s.name }}</div>
        <div class="grid-card-url t3" :title="s.url">{{ s.url }}</div>
        <div class="grid-card-footer">
          <span class="grid-card-meta t3">
            <i class="fa-solid fa-key icon-10"></i>{{ acctCounts[s.id] ?? 0 }} 个账号 · {{ formatRelativeTime(s.updatedAt) }}
          </span>
          <div class="grid-card-actions">
            <button class="ibtn" @click.stop="onEdit(s)" title="编辑"><i class="fa-solid fa-pen icon-11"></i></button>
            <button class="ibtn danger" @click.stop="onDelete(s.id)" title="删除"><i class="fa-regular fa-trash-can icon-11"></i></button>
          </div>
        </div>
      </div>
      <div v-if="filteredSystems.length === 0" class="empty-state">
        <i class="fa-regular fa-folder-open empty-icon t3"></i>
        <div class="empty-text t3">{{ search ? '未找到匹配的系统' : '暂无系统，点击"新增系统"创建' }}</div>
      </div>
    </VueDraggable>

    <SystemForm v-if="formVisible" :visible="formVisible" :system="editing" :system-id="editing?.id || ''" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import type { System } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import { accountService } from '@shared/services/accountService';
import { copyToClipboard } from '@shared/utils/clipboard';
import EnvBadge from '../components/common/EnvBadge.vue';
import SystemForm from '../components/system/SystemForm.vue';

const store = useSystemStore();
const toast = useToastStore();
const dialog = useDialogStore();
const formVisible = ref(false);
const editing = ref<System | null>(null);
const search = ref('');
const selectedIds = ref<Set<string>>(new Set());
const acctCounts = ref<Record<string, number>>({});
const VIEW_KEY = 'dock-v3-system-view';
const viewMode = ref<'table' | 'card'>(
  (typeof localStorage !== 'undefined' && (localStorage.getItem(VIEW_KEY) as 'table' | 'card')) || 'table',
);
watch(viewMode, (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } });

const iconPalettes = [
  'linear-gradient(135deg, #4F7CFF 0%, #3D6DF7 100%)',
  'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
  'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
  'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)',
  'linear-gradient(135deg, #22D3EE 0%, #06B6D4 100%)',
];

function iconStyle(s: System) {
  const bg = s.iconColor || iconPalettes[Math.abs(s.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) % iconPalettes.length];
  const solid = s.iconColor || '#2E6BF0';
  return { background: bg, boxShadow: `0 5px 14px -4px ${solid}66` };
}

async function loadAcctCounts() {
  const counts: Record<string, number> = {};
  await Promise.all(
    store.list.map(async (s) => {
      try {
        const accounts = await accountService.bySystemId(s.id);
        counts[s.id] = accounts.length;
      } catch {
        counts[s.id] = 0;
      }
    }),
  );
  acctCounts.value = counts;
}

onMounted(async () => {
  await store.load();
  await loadAcctCounts();
});

const filteredSystems = computed(() => {
  if (!search.value.trim()) return store.list;
  const q = search.value.toLowerCase();
  return store.list.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.url.toLowerCase().includes(q) ||
    (s.remark || '').toLowerCase().includes(q),
  );
});

const allChecked = computed(() => filteredSystems.value.length > 0 && filteredSystems.value.every(s => selectedIds.value.has(s.id)));

function toggleAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) filteredSystems.value.forEach(s => selectedIds.value.add(s.id));
  else selectedIds.value.clear();
}

function toggleOne(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id);
  else selectedIds.value.add(id);
}

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(s: System) { editing.value = s; formVisible.value = true; }

async function onOpen(system: System) {
  window.open(system.url, '_blank');
  await store.load();
}

async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该系统？');
  if (!ok) return;
  await store.remove(id);
  await loadAcctCounts();
  toast.success('已删除');
}

async function onBulkDelete() {
  const ids = Array.from(selectedIds.value);
  const ok = await dialog.confirm('批量删除', `确认删除选中的 ${ids.length} 个系统？`);
  if (!ok) return;
  for (const id of ids) await store.remove(id);
  selectedIds.value.clear();
  await loadAcctCounts();
  toast.success(`已删除 ${ids.length} 个系统`);
}

async function onSaved() {
  formVisible.value = false;
  await store.load();
  await loadAcctCounts();
}

async function copyUrl(url: string) {
  try {
    await copyToClipboard(url);
    toast.success('链接已复制');
  } catch {
    toast.error('复制失败');
  }
}

async function onDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
  const newList = [...filteredSystems.value];
  const [moved] = newList.splice(oldIndex, 1);
  newList.splice(newIndex, 0, moved);
  const orderedIds = newList.map(s => s.id);
  await store.reorder(orderedIds);
  await store.load();
  toast.success('排序已更新');
}
</script>

<style scoped>
.system-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  gap: var(--gap-lg);
}

/* ============ 操作栏 ============ */
.action-bar {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  flex-wrap: wrap;
  flex-shrink: 0;
}
.btn-create {
  background: var(--accent);
  color: #fff;
  box-shadow: var(--shadow-primary), inset 0 1px 0 rgba(255,255,255,.2);
}
.btn-create:hover {
  filter: brightness(1.07);
  box-shadow: 0 6px 20px -4px var(--glow), inset 0 1px 0 rgba(255,255,255,.2);
}
.btn-create:active { transform: scale(.97); }
.icon-11 { font-size: 11px; }
.icon-12 { font-size: 12px; }
.icon-10 { font-size: 10px; }
.flex-spacer { flex: 1; min-width: 0; }
.sel-count { margin-left: 2px; }

/* 视图切换 */
.view-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg2);
}
.view-toggle .view-btn {
  width: 30px;
  height: 26px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink3);
  cursor: pointer;
  transition: .15s;
  border: none;
  background: transparent;
}
.view-toggle .view-btn:hover { color: var(--ink); }
.view-toggle .view-btn.active {
  background: var(--panel);
  color: var(--accent);
  box-shadow: 0 0 0 1px var(--border), 0 2px 8px -2px rgba(15, 23, 38, .1);
}

/* 搜索框 */
.search-wide-wrap { position: relative; display: inline-flex; align-items: center; }
.search-wide { width: 288px; padding-left: 30px !important; }
.search-ico {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  pointer-events: none;
}

/* ============ 表格视图 ============ */
.systems-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.table-head {
  border-bottom: 1px solid var(--border);
  background: var(--panel2);
}
.table-head th {
  text-align: left;
  padding: 10px 16px;
  font-size: 10.5px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink3);
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--panel2);
}

/* 列宽 - 匹配 v3 w-10/w-24/w-28/w-32 */
.col-check { width: 40px; padding: 10px 8px 10px 16px !important; }
.col-env { width: 96px; }
.col-acct { width: 96px; }
.col-updated { width: 112px; }
.col-actions { width: 156px; text-align: right !important; padding-right: 16px !important; }

.row-checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.data-table tbody td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  font-size: var(--text-sm);
  color: var(--ink);
}
.row-group { transition: background 0.15s ease; }
.row-group:hover { background: var(--surface-hover); }
.row-group:last-child td { border-bottom: none; }

/* 名称单元格 */
.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.sys-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  flex-shrink: 0;
}
.name-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}
.sys-name {
  font-size: 13.5px;
  font-weight: var(--font-medium);
  line-height: var(--leading-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sys-remark {
  font-size: var(--text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

/* URL 单元格 */
.url-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.url-cell i:first-child { font-size: 10px; }
.url-text {
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ibtn-tiny {
  width: 20px;
  height: 20px;
  opacity: 0;
  transition: opacity .15s;
}
.url-cell:hover .ibtn-tiny,
.row-group:hover .ibtn-tiny { opacity: 1; }

/* 账号单元格 */
.acct-cell {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-xs);
}

/* 操作按钮 - 默认半透明，hover 时显现 */
.row-actions-fade {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}
.row-group:hover .row-actions-fade { opacity: 1; }

/* 空状态行 */
.empty-row {
  text-align: center;
  padding: 64px 16px !important;
  border-bottom: none !important;
}
.empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }
.empty-text { font-size: 13px; }

/* ============ 网格视图 ============ */
.systems-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 16px;
  align-content: start;
}
@media (min-width: 640px) {
  .systems-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1280px) {
  .systems-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1536px) {
  .systems-grid { grid-template-columns: repeat(4, 1fr); }
}

.grid-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}
.grid-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.grid-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--text-base);
  flex-shrink: 0;
}
.grid-card-name {
  margin-top: 12px;
  font-size: 14px;
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grid-card-url {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grid-card-remark {
  margin-top: 8px;
  font-size: var(--text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grid-card-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-xs);
}
.grid-card-meta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.grid-card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.grid-card:hover .grid-card-actions { opacity: 1; }
.grid-card-actions .ibtn {
  width: 24px;
  height: 24px;
}
.grid-card-actions .ibtn i { font-size: 11px; }

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--text-tertiary);
}

/* 拖拽 */
.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}
/* 拖动手柄（放在操作列末尾，删除按钮右侧） */
.drag-handle {
  cursor: move;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: 2px;
  border-radius: var(--radius-sm);
  color: var(--ink3);
  font-size: 12px;
  transition: background 0.15s ease, color 0.15s ease;
}
.drag-handle:hover {
  background: var(--panel2);
  color: var(--ink);
}
</style>
