<template>
  <div class="section">
    <div class="section-header">
      <span>最近访问</span>
    </div>
    <div class="recent-list">
      <div v-for="r in recents" :key="r.id" class="recent-item" @click="onOpen(r)">
        <div class="ri-icon" :style="{ background: getColor(r.entityType) }">
          <i :class="getIcon(r.entityType)"></i>
        </div>
        <div class="ri-text">
          <div class="ri-name">{{ getEntityName(r) }}</div>
          <div class="ri-time">{{ formatRelativeTime(r.lastAccessedAt) }} · {{ r.role || '' }}</div>
        </div>
      </div>
      <div v-if="recents.length === 0" class="empty">暂无最近访问</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import { systemRepo } from '@shared/db/repositories/systemRepo';
import { formatRelativeTime } from '@shared/utils/time';

interface RecentItem {
  id: string;
  entityType: string;
  entityId: string;
  lastAccessedAt: number;
  role?: string;
}

const recents = ref<RecentItem[]>([]);
const systemNames = ref<Map<string, string>>(new Map());

onMounted(async () => {
  recents.value = await recentRepo.top(5) as RecentItem[];
  const systems = await systemRepo.all();
  systemNames.value = new Map(systems.map(s => [s.id, s.name]));
});

async function onOpen(r: RecentItem) {
  if (r.entityType === 'system') {
    const sys = await systemRepo.byId(r.entityId);
    if (sys) {
      await recentRepo.touch('system', sys.id, r.role);
      chrome.tabs.create({ url: sys.url });
      window.close();
    }
  }
}

function getEntityName(r: RecentItem): string {
  if (r.entityType === 'system') {
    return systemNames.value.get(r.entityId) ?? r.entityId;
  }
  return r.entityId;
}

function getColor(type: string) {
  return { system: 'linear-gradient(135deg,#3b82f6,#2563eb)', server: 'linear-gradient(135deg,#10b981,#059669)', middleware: 'linear-gradient(135deg,#f59e0b,#d97706)' }[type] || '#3b82f6';
}
function getIcon(type: string) {
  return { system: 'fa-solid fa-briefcase', server: 'fa-solid fa-server', middleware: 'fa-solid fa-cubes' }[type] || 'fa-solid fa-globe';
}
</script>

<style scoped>
.section { padding: 0 12px 12px; }
.section-header { font-size: 11px; font-weight: 600; color: var(--text-secondary); padding: 8px 0 4px; text-transform: uppercase; }
.recent-list { display: flex; flex-direction: column; gap: 2px; }
.recent-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.recent-item:hover { background: var(--border-soft); }
.ri-icon { width: 24px; height: 24px; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; flex-shrink: 0; }
.ri-text { flex: 1; min-width: 0; }
.ri-name { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ri-time { font-size: 10px; color: var(--text-tertiary); }
.empty { padding: 12px; text-align: center; font-size: 11px; color: var(--text-tertiary); }
</style>
