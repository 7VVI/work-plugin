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
            <th style="width:48px;"><input type="checkbox" class="form-check" :checked="allChecked" @change="toggleAll" /></th>
            <th>系统名称</th>
            <th>URL</th>
            <th style="width:96px;">环境</th>
            <th style="width:140px;">最近更新</th>
            <th style="width:160px;">操作</th>
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
            <td>
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
            <td colspan="6" class="empty-row">
              <i class="fa-regular fa-folder-open empty-icon"></i>
              <div>暂无系统</div>
              <div class="empty-hint">点击"新增系统"开始添加</div>
            </td>
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

const iconPalettes = [
  'linear-gradient(135deg, #4F7CFF 0%, #3D6DF7 100%)',
  'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
  'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
  'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)',
  'linear-gradient(135deg, #22D3EE 0%, #06B6D4 100%)',
];

function iconStyle(s: System) {
  if (s.iconColor) return { background: s.iconColor };
  const hash = s.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  return { background: iconPalettes[Math.abs(hash) % iconPalettes.length] };
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
.action-right .search-wrap { width: 320px; }

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  margin: 0 var(--page-pad) var(--page-pad);
  box-shadow: var(--shadow-sm);
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}
.data-table thead th {
  background: var(--surface-secondary);
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
  padding: 0 var(--gap-lg);
  height: var(--table-header-h);
  text-align: left;
  border-bottom: 1px solid var(--border-soft);
  white-space: nowrap;
  font-size: var(--text-xs);
  letter-spacing: 0.3px;
  text-transform: none;
  position: sticky;
  top: 0;
  z-index: 1;
}
.data-table tbody td {
  padding: 0 var(--gap-lg);
  height: var(--table-row-h);
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-primary);
  vertical-align: middle;
}
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr { transition: background 0.15s ease; }
.data-table tbody tr:hover td { background: var(--surface-active); }

.sys-cell { display: flex; align-items: center; gap: var(--gap-md); }
.sys-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--text-base);
  flex-shrink: 0;
  box-shadow: var(--shadow-xs);
}
.sys-text { min-width: 0; }
.sys-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
}
.sys-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

.url-text {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-cell {
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

.row-actions { display: flex; align-items: center; gap: var(--gap-sm); }

.empty-row {
  text-align: center;
  color: var(--text-tertiary);
  padding: 64px 0;
  height: auto !important;
}
.empty-row .empty-icon {
  font-size: 32px;
  color: var(--text-quaternary);
  margin-bottom: var(--gap-md);
  display: block;
}
.empty-row > div { font-size: var(--text-base); color: var(--text-secondary); }
.empty-row .empty-hint {
  font-size: var(--text-sm);
  color: var(--text-quaternary);
  margin-top: var(--gap-xs);
}
</style>
