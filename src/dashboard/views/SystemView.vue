<template>
  <div class="system-view">
    <!-- 操作栏 - v3 风格 -->
    <div class="action-bar">
      <button class="btn-p" @click="onCreate"><i class="fa-solid fa-plus text-[11px]"></i>新增系统</button>
      <button v-if="selectedIds.size > 0" class="btn-d" @click="onBulkDelete">
        <i class="fa-regular fa-trash-can text-[11px]"></i>删除选中（{{ selectedIds.size }}）
      </button>
      <div class="flex-1"></div>
      <!-- 视图切换 - v3 风格 -->
      <div class="view-toggle">
        <button class="view-btn" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'" title="列表视图">
          <i class="fa-solid fa-list text-xs"></i>
        </button>
        <button class="view-btn" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'" title="网格视图">
          <i class="fa-solid fa-table-cells-large text-xs"></i>
        </button>
      </div>
      <!-- 搜索框 - v3 风格 -->
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] t3"></i>
        <input v-model="search" class="inp w-72 !pl-8" placeholder="搜索系统名称、URL、标签…" />
      </div>
    </div>

    <!-- 列表视图 - v3 风格 -->
    <div v-if="viewMode === 'table'" class="systems-list panel">
      <table class="w-full">
        <thead style="border-bottom:1px solid var(--border);background:var(--panel2)">
          <tr class="text-left text-[10.5px] font-semibold uppercase tracking-widest t3">
            <th class="w-10 py-2.5 pl-4 pr-2">
              <input type="checkbox" class="h-3.5 w-3.5 cursor-pointer" style="accent-color:var(--accent)" :checked="allChecked" @change="toggleAll" />
            </th>
            <th class="px-4 py-2.5 font-semibold">系统名称</th>
            <th class="px-4 py-2.5 font-semibold">URL</th>
            <th class="w-24 px-4 py-2.5 font-semibold">环境</th>
            <th class="w-24 px-4 py-2.5 font-semibold">账号</th>
            <th class="w-28 px-4 py-2.5 font-semibold">最近更新</th>
            <th class="w-32 px-4 py-2.5 pr-4 text-right font-semibold">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filteredSystems" :key="s.id" class="row-h group transition" style="border-bottom:1px solid var(--border)">
            <td class="py-3 pl-4 pr-2">
              <input type="checkbox" class="h-3.5 w-3.5 cursor-pointer" style="accent-color:var(--accent)" :checked="selectedIds.has(s.id)" @change="toggleOne(s.id)" />
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <span class="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-[13px] text-white" :style="iconStyle(s)">
                  <i :class="s.icon || 'fa-solid fa-globe'"></i>
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-[13.5px] font-medium t1">{{ s.name }}</span>
                </span>
              </div>
            </td>
            <td class="px-4 py-3">
              <span class="flex items-center gap-1.5 mono text-xs t2">
                <i class="fa-solid fa-link text-[10px] t3"></i>
                <span class="max-w-[340px] truncate">{{ s.url }}</span>
                <button class="ibtn !h-5 !w-5 opacity-0 transition group-hover:opacity-100" title="复制链接" @click="copyUrl(s.url)">
                  <i class="fa-regular fa-copy text-[10px]"></i>
                </button>
              </span>
            </td>
            <td class="px-4 py-3"><EnvBadge :env="s.environment" /></td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center gap-1 text-xs t2">
                <i class="fa-solid fa-key text-[10px] t3"></i>{{ acctCounts[s.id] ?? 0 }} 个
              </span>
            </td>
            <td class="px-4 py-3 text-xs t3">{{ formatRelativeTime(s.updatedAt) }}</td>
            <td class="py-3 pl-4 pr-4 text-right">
              <div class="flex justify-end gap-0.5 opacity-50 transition group-hover:opacity-100">
                <button class="ibtn" title="编辑" @click.stop="onEdit(s)"><i class="fa-solid fa-pen text-xs"></i></button>
                <button class="ibtn" title="打开系统" @click.stop="onOpen(s)"><i class="fa-solid fa-arrow-up-right-from-square text-xs"></i></button>
                <button class="ibtn danger" title="删除" @click.stop="onDelete(s.id)"><i class="fa-regular fa-trash-can text-xs"></i></button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredSystems.length === 0">
            <td colspan="7" class="py-16 text-center">
              <i class="fa-regular fa-folder-open text-2xl t3"></i>
              <div class="mt-2 text-[13px] t3">暂无系统，点击"新增系统"创建</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 网格视图 - v3 风格 -->
    <div v-else class="systems-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <div v-for="s in filteredSystems" :key="s.id" class="panel stat-card group p-4">
        <div class="flex items-start justify-between">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl text-base text-white" :style="iconStyle(s)">
            <i :class="s.icon || 'fa-solid fa-globe'"></i>
          </span>
          <EnvBadge :env="s.environment" />
        </div>
        <div class="mt-3 text-[14px] font-semibold t1">{{ s.name }}</div>
        <div class="mono mt-0.5 truncate text-xs t3">{{ s.url }}</div>
        <div class="mt-3 flex items-center justify-between pt-3 text-xs t3" style="border-top:1px solid var(--border)">
          <span>
            <i class="fa-solid fa-key mr-1 text-[10px]"></i>{{ acctCounts[s.id] ?? 0 }} 个账号 · {{ formatRelativeTime(s.updatedAt) }}
          </span>
          <div class="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button class="ibtn !h-6 !w-6" @click="onEdit(s)"><i class="fa-solid fa-pen text-[11px]"></i></button>
            <button class="ibtn danger !h-6 !w-6" @click="onDelete(s.id)"><i class="fa-regular fa-trash-can text-[11px]"></i></button>
          </div>
        </div>
      </div>
      <div v-if="filteredSystems.length === 0" class="py-16 text-center">
        <i class="fa-regular fa-folder-open text-2xl t3"></i>
        <div class="mt-2 text-[13px] t3">暂无系统，点击"新增系统"创建</div>
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
      const accounts = await accountService.bySystemId(s.id);
      counts[s.id] = accounts.length;
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
    s.url.toLowerCase().includes(q)
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
</script>

<style scoped>
.system-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  flex-shrink: 0;
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg2);
  padding: 2px;
}
.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border-radius: 7px;
  color: var(--ink3);
  cursor: pointer;
  transition: .15s;
  border: none;
  background: transparent;
}
.view-btn.active {
  background: var(--panel);
  color: var(--accent);
  box-shadow: 0 0 0 1px var(--border), 0 2px 8px -2px rgba(15, 23, 38, .1);
}

.systems-list {
  margin: 0 24px 16px;
  overflow: hidden;
}

.systems-grid {
  padding: 0 24px 24px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
}
</style>
