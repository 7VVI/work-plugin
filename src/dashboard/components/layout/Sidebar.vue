<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <div class="shield-icon"><i class="fa-solid fa-shield-halved"></i></div>
        Nav Portal
      </div>
    </div>
    <div class="sidebar-search">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input v-model="searchQuery" type="text" placeholder="搜索系统/URL/标签..." @input="onSearch" @keyup.enter="openFirstResult" />
      <span class="shortcut">{{ shortcutKey }}</span>
    </div>
    <div class="quick-actions">
      <div class="quick-action" @click="$router.push('/systems')">
        <div class="qa-icon qa-blue"><i class="fa-solid fa-plus"></i></div>
        <div class="qa-label">新增系统</div>
      </div>
      <div class="quick-action" @click="$router.push('/servers')">
        <div class="qa-icon qa-green"><i class="fa-solid fa-server"></i></div>
        <div class="qa-label">服务器</div>
      </div>
      <div class="quick-action" @click="$router.push('/middlewares')">
        <div class="qa-icon qa-orange"><i class="fa-solid fa-cubes"></i></div>
        <div class="qa-label">中间件</div>
      </div>
      <div class="quick-action" @click="$router.push('/import-export')">
        <div class="qa-icon qa-purple"><i class="fa-solid fa-file-import"></i></div>
        <div class="qa-label">导入导出</div>
      </div>
    </div>
    <div class="recent-header"><span>最近访问</span></div>
    <div class="recent-list">
      <div v-for="r in recents" :key="r.id" class="recent-item" @click="openRecent(r)">
        <div class="ri-icon" :style="{ background: getIconColor(r.entityType) }">
          <i :class="getIconClass(r.entityType)"></i>
        </div>
        <div class="ri-text">
          <div class="ri-name">{{ r.title || r.entityId }}</div>
          <div class="ri-time">{{ formatRelativeTime(r.lastAccessedAt) }}</div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import { formatRelativeTime } from '@shared/utils/time';
import { useSearchStore } from '@shared/stores/searchStore';

interface RecentItem {
  id: string;
  entityType: string;
  entityId: string;
  lastAccessedAt: number;
  role?: string;
  title?: string;
}

const DASHBOARD_SYSTEMS_URL = '/dashboard.html#/systems';

const searchQuery = ref('');
const recents = ref<RecentItem[]>([]);
const searchStore = useSearchStore();
const shortcutKey = navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K';

onMounted(async () => {
  recents.value = await recentRepo.top(5) as RecentItem[];
});

async function onSearch() {
  await searchStore.search(searchQuery.value);
}

async function openFirstResult() {
  if (searchStore.results.length > 0) {
    const first = searchStore.results[0];
    if (first.type === 'system') {
      window.open(DASHBOARD_SYSTEMS_URL, '_self');
    }
  }
}

function openRecent(r: RecentItem) {
  if (r.entityType === 'system') window.open(DASHBOARD_SYSTEMS_URL, '_self');
}

function getIconColor(type: string) {
  const colors: Record<string, string> = {
    system: 'linear-gradient(135deg,#3b82f6,#2563eb)',
    server: 'linear-gradient(135deg,#10b981,#059669)',
    middleware: 'linear-gradient(135deg,#f59e0b,#d97706)',
  };
  return colors[type] || colors.system;
}

function getIconClass(type: string) {
  const icons: Record<string, string> = {
    system: 'fa-solid fa-briefcase',
    server: 'fa-solid fa-server',
    middleware: 'fa-solid fa-cubes',
  };
  return icons[type] || icons.system;
}
</script>

<style scoped>
.sidebar { width: 208px; background: white; border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; }
.sidebar-header { padding: 14px; display: flex; align-items: center; justify-content: space-between; }
.sidebar-logo { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.shield-icon { width: 22px; height: 22px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; }
.sidebar-search { margin: 0 12px 12px; position: relative; }
.sidebar-search input { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 6px; padding: 0 30px 0 30px; font-size: 12px; background: #f9fafb; outline: none; font-family: inherit; color: var(--text-primary); }
.sidebar-search input:focus { background: white; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.sidebar-search i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; }
.sidebar-search .shortcut { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--text-tertiary); border: 1px solid var(--border); padding: 1px 4px; border-radius: 3px; background: white; }
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 0 12px 12px; }
.quick-action { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; background: #f9fafb; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
.quick-action:hover { background: var(--border-soft); transform: translateY(-1px); }
.qa-icon { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; }
.qa-blue { background: linear-gradient(135deg,#3b82f6,#2563eb); }
.qa-green { background: linear-gradient(135deg,#10b981,#059669); }
.qa-orange { background: linear-gradient(135deg,#f59e0b,#d97706); }
.qa-purple { background: linear-gradient(135deg,#8b5cf6,#7c3aed); }
.quick-action .qa-label { font-size: 11px; color: #374151; font-weight: 500; }
.recent-header { padding: 6px 14px; font-size: 12px; font-weight: 600; color: #374151; }
.recent-list { flex: 1; overflow-y: auto; padding: 0 4px 4px; }
.recent-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: background 0.15s; margin-bottom: 2px; }
.recent-item:hover { background: var(--border-soft); }
.ri-icon { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; flex-shrink: 0; }
.ri-text { flex: 1; min-width: 0; }
.ri-name { font-size: 12px; color: var(--text-primary); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ri-time { font-size: 10px; color: var(--text-tertiary); }
</style>
