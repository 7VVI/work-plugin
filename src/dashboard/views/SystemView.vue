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
        <div class="search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input v-model="search" class="search-input" type="text" placeholder="搜索系统名称、URL..." />
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40px;"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
            <th>系统名称</th>
            <th>URL</th>
            <th style="width:90px;">环境</th>
            <th style="width:120px;">最近更新</th>
            <th style="width:120px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filteredSystems" :key="s.id">
            <td><input type="checkbox" :checked="selectedIds.has(s.id)" @change="toggleOne(s.id)" /></td>
            <td>
              <div class="sys-cell">
                <div class="sys-icon" :style="{ background: s.iconColor || defaultIconBg }">
                  <i :class="s.icon || 'fa-solid fa-globe'"></i>
                </div>
                <div class="sys-text">
                  <div class="sys-name">{{ s.name }}</div>
                  <div v-if="s.remark" class="sys-desc">{{ s.remark }}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="url-link" @click.stop="onOpen(s)" :title="s.url">{{ s.url }}</span>
            </td>
            <td><EnvBadge :env="s.environment" /></td>
            <td><span class="time-cell">{{ formatRelativeTime(s.updatedAt) }}</span></td>
            <td>
              <div class="row-actions">
                <button class="row-action" @click.stop="onEdit(s)" title="编辑"><i class="fa-solid fa-pen"></i></button>
                <button class="row-action" @click.stop="onOpen(s)" title="打开"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                <button class="row-action" @click.stop="onDelete(s.id)" title="删除"><i class="fa-solid fa-trash"></i></button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredSystems.length === 0">
            <td colspan="6" class="empty-row">暂无系统，点击"新增系统"添加</td>
          </tr>
        </tbody>
      </table>
    </div>
    <SystemForm v-if="formVisible" :visible="formVisible" :system="editing" :system-id="editing?.id || ''" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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

const defaultIconBg = 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)';

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
  padding: 14px var(--page-pad);
  gap: 12px;
  flex-shrink: 0;
}
.action-left { display: flex; align-items: center; gap: 8px; }
.action-right { display: flex; align-items: center; gap: 8px; }
.search-input { width: 280px; }

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin: 0 var(--page-pad) var(--page-pad);
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.data-table thead th {
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-weight: 500;
  padding: 11px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border-soft);
  white-space: nowrap;
  font-size: 12.5px;
  position: sticky;
  top: 0;
  z-index: 1;
}
.data-table tbody td {
  padding: 14px;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-primary);
  vertical-align: middle;
}
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr { transition: background 0.12s; }
.data-table tbody tr:hover { background: var(--surface-secondary); }
.data-table input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--primary);
  cursor: pointer;
}

.sys-cell { display: flex; align-items: center; gap: 10px; }
.sys-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  flex-shrink: 0;
}
.sys-text { min-width: 0; }
.sys-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}
.sys-desc {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.url-link {
  color: var(--text-primary);
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: 12.5px;
  cursor: pointer;
  transition: color 0.15s;
}
.url-link:hover { color: var(--primary); text-decoration: underline; }

.time-cell {
  color: var(--text-secondary);
  font-size: 12.5px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.row-action {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition);
  font-size: 13px;
}
.row-action:hover { background: var(--border-soft); color: var(--text-primary); }

.empty-row {
  text-align: center;
  color: var(--text-tertiary);
  padding: 48px 0;
  font-size: 13px;
}

.btn { height: 34px; padding: 0 14px; }
</style>
