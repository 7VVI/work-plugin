<template>
  <div class="system-view">
    <div class="action-bar">
      <div class="action-left">
        <button class="btn btn-dark" @click="onCreate"><i class="fa-solid fa-plus"></i> 新增系统</button>
        <button class="btn btn-danger" :disabled="selectedIds.size === 0" @click="onBulkDelete">
          <i class="fa-solid fa-trash"></i> 删除选中
        </button>
      </div>
      <div class="action-right">
        <div class="view-toggle">
          <button class="vt-btn" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'" title="列表视图">
            <i class="fa-solid fa-list"></i>
          </button>
          <button class="vt-btn" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'" title="卡片视图">
            <i class="fa-solid fa-grip"></i>
          </button>
        </div>
        <div class="search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input v-model="search" class="search-input" type="text" placeholder="搜索系统名称、URL..." />
        </div>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-if="viewMode === 'table'" class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:48px;"><input type="checkbox" class="form-check" :checked="allChecked" @change="toggleAll" /></th>
            <th style="width:28%;">系统名称</th>
            <th style="width:32%;">URL</th>
            <th style="width:80px;">环境</th>
            <th style="width:120px;">最近更新</th>
            <th style="width:140px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filteredSystems" :key="s.id">
            <td><input type="checkbox" class="form-check" :checked="selectedIds.has(s.id)" @change="toggleOne(s.id)" /></td>
            <td>
              <div class="sys-cell">
                <div class="sys-icon" :style="iconStyle(s)">
                  <i :class="s.icon || 'fa-solid fa-globe'"></i>
                </div>
                <div class="sys-text">
                  <div class="sys-name">{{ s.name }}</div>
                  <div v-if="s.remark" class="sys-desc">{{ s.remark }}</div>
                </div>
              </div>
            </td>
            <td class="url-cell">
              <a class="url-link" @click.stop="onOpen(s)" :title="s.url">
                <i class="fa-solid fa-globe"></i>
                <span class="url-text">{{ s.url }}</span>
              </a>
            </td>
            <td><EnvBadge :env="s.environment" /></td>
            <td><span class="time-cell">{{ formatRelativeTime(s.updatedAt) }}</span></td>
            <td>
              <div class="row-actions">
                <button class="row-action row-action-sm edit" @click.stop="onEdit(s)" title="编辑"><i class="fa-solid fa-pen"></i></button>
                <button class="row-action row-action-sm" @click.stop="onOpen(s)" title="打开"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                <button class="row-action row-action-sm danger" @click.stop="onDelete(s.id)" title="删除"><i class="fa-solid fa-trash"></i></button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredSystems.length === 0">
            <td colspan="6" class="empty-cell">
              <div class="empty-state">
                <i class="fa-solid fa-globe"></i>
                <p>暂无系统，点击“新增系统”添加</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 卡片视图 -->
    <div v-else class="card-wrap">
      <div class="card-grid">
        <div v-for="s in filteredSystems" :key="s.id" class="sys-card stat-card" @click="onOpen(s)">
          <div class="card-header">
            <div class="card-icon" :style="iconStyle(s)">
              <i :class="s.icon || 'fa-solid fa-globe'"></i>
            </div>
            <div class="card-actions" @click.stop>
              <button class="row-action row-action-sm edit" @click="onEdit(s)" title="编辑"><i class="fa-solid fa-pen"></i></button>
              <button class="row-action row-action-sm danger" @click="onDelete(s.id)" title="删除"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
          <div class="card-body">
            <div class="card-name">{{ s.name }}</div>
            <div class="card-url" :title="s.url">{{ s.url }}</div>
            <div v-if="s.remark" class="card-remark">{{ s.remark }}</div>
          </div>
          <div class="card-footer">
            <EnvBadge :env="s.environment" />
            <span class="card-time">{{ formatRelativeTime(s.updatedAt) }}</span>
          </div>
        </div>
        <div v-if="filteredSystems.length === 0" class="empty-state">
          <i class="fa-solid fa-globe"></i>
          <p>暂无系统，点击“新增系统”添加</p>
        </div>
      </div>
    </div>

    <SystemForm v-if="formVisible" :visible="formVisible" :system="editing" :system-id="editing?.id || ''" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import type { System } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import EnvBadge from '../components/common/EnvBadge.vue';
import SystemForm from '../components/system/SystemForm.vue';

const store = useSystemStore();
const toast = useToastStore();
const dialog = useDialogStore();
const formVisible = ref(false);
const editing = ref<System | null>(null);
const search = ref('');
const selectedIds = ref<Set<string>>(new Set());
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

onMounted(async () => { await store.load(); });

const filteredSystems = computed(() => {
  if (!search.value.trim()) return store.list;
  const q = search.value.toLowerCase();
  return store.list.filter(s => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
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
  toast.success('已删除');
}

async function onBulkDelete() {
  const ids = Array.from(selectedIds.value);
  const ok = await dialog.confirm('批量删除', `确认删除选中的 ${ids.length} 个系统？`);
  if (!ok) return;
  for (const id of ids) await store.remove(id);
  selectedIds.value.clear();
  toast.success(`已删除 ${ids.length} 个系统`);
}

async function onSaved() {
  formVisible.value = false;
  await store.load();
}
</script>

<style scoped>
.system-view { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-lg) var(--page-pad);
  gap: var(--gap-lg);
  flex-shrink: 0;
}
.action-left { display: flex; align-items: center; gap: var(--gap-md); }
.action-right { display: flex; align-items: center; gap: var(--gap-md); }
.action-right .search-wrap { width: 280px; }

/* 视图切换按钮 */
.view-toggle {
  display: flex;
  align-items: center;
  background: var(--surface-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px;
  gap: 2px;
}
.vt-btn {
  width: 30px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: 12px;
}
.vt-btn:hover { color: var(--text-primary); background: var(--surface-hover); }
.vt-btn.active {
  background: var(--bg-pure);
  color: var(--primary);
  box-shadow: var(--shadow-xs);
}

/* 表格视图 */
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  margin: 0 var(--page-pad) var(--page-pad);
  box-shadow: var(--shadow-xs);
  position: relative;
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}
.data-table thead th {
  background: var(--panel2);
  color: var(--ink3);
  font-weight: var(--font-medium);
  padding: 0 var(--gap-lg);
  height: var(--table-header-h);
  text-align: center;
  border-bottom: 1px solid var(--border-soft);
  white-space: nowrap;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  z-index: 1;
}
/* 减少checkbox列和系统名称列的间距 */
.data-table thead th:first-child { padding-right: 0; }
.data-table tbody td:first-child { padding-right: 0; }
.data-table thead th:nth-child(2) { padding-left: var(--gap-sm); }
.data-table tbody td:nth-child(2) { padding-left: var(--gap-sm); }

.data-table thead th:nth-child(2),
.data-table thead th:nth-child(3) { text-align: left; }
.data-table tbody td {
  padding: 0 var(--gap-lg);
  height: var(--table-row-h);
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-primary);
  vertical-align: middle;
  text-align: center;
}
.data-table tbody td:nth-child(2),
.data-table tbody td:nth-child(3) { text-align: left; }
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr { transition: background 0.2s ease; }
.data-table tbody tr:hover td { background: var(--surface-hover); }
.data-table tbody tr:hover td:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.data-table tbody tr:hover td:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }

/* URL列左对齐 */
.url-cell { text-align: left !important; }
.url-cell .url-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.sys-cell { display: flex; align-items: center; gap: var(--gap-md); }
.sys-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--text-sm);
  flex-shrink: 0;
  box-shadow: var(--shadow-xs);
}
.sys-text { min-width: 0; }
.sys-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--ink);
  line-height: var(--leading-tight);
}
.sys-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

.url-text {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--ink2);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-cell { color: var(--text-tertiary); font-size: var(--text-sm); }
.row-actions { display: flex; align-items: center; justify-content: center; gap: var(--gap-sm); }

.empty-cell {
  padding: 0 !important;
  height: auto !important;
}
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}
.empty-state i {
  font-size: 36px;
  margin-bottom: var(--gap-md);
  color: var(--ink3);
}
.empty-state p { font-size: var(--text-sm); margin: 0; }

/* 卡片视图 */
.card-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 var(--page-pad) var(--page-pad);
  position: relative;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--gap-lg);
  align-content: start;
}
.sys-card {
  background: var(--card-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  padding: var(--gap-lg);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}
.sys-card:hover {
  border-color: var(--primary);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--text-base);
  box-shadow: var(--shadow-xs);
}
.card-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: var(--transition-fast);
}
.sys-card:hover .card-actions { opacity: 1; }
.card-body { flex: 1; min-width: 0; }
.card-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--ink);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-url {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--ink3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-remark {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--gap-sm);
  border-top: 1px solid var(--border-soft);
}
.card-time {
  font-size: var(--text-xs);
  color: var(--text-quaternary);
}
.card-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--text-tertiary);
}
.card-empty .empty-icon {
  font-size: 32px;
  color: var(--text-quaternary);
  margin-bottom: var(--gap-md);
}
.card-empty > div { font-size: var(--text-base); color: var(--text-secondary); }
.card-empty .empty-hint { font-size: var(--text-sm); color: var(--text-quaternary); margin-top: var(--gap-xs); }
</style>
