<template>
  <div class="section">
    <div class="section-header" @click="toggleExpand">
      <span>全部系统</span>
      <div class="header-right">
        <span class="count">{{ systems.length }}</span>
        <i :class="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
      </div>
    </div>
    <div v-if="expanded" class="sys-list">
      <div v-for="s in systems" :key="s.id" class="sys-item" @click="onOpen(s)" :title="s.url">
        <div class="sys-icon" :style="{ background: s.iconColor || 'linear-gradient(135deg,#3b82f6,#2563eb)' }">
          <i :class="s.icon || 'fa-solid fa-globe'"></i>
        </div>
        <div class="sys-text">
          <div class="sys-name">{{ s.name }}</div>
          <div class="sys-url">{{ s.url }}</div>
        </div>
        <EnvBadge :env="s.environment" />
      </div>
      <div v-if="systems.length === 0" class="empty">暂无系统，点击下方"新增系统"添加</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { systemRepo } from '@shared/db/repositories/systemRepo';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import type { System } from '@shared/types/entities';
import EnvBadge from '../../dashboard/components/common/EnvBadge.vue';

const systems = ref<System[]>([]);
const expanded = ref(true);

onMounted(async () => {
  const all = await systemRepo.all();
  systems.value = all.sort((a, b) => a.sort - b.sort || b.updatedAt - a.updatedAt);
});

function toggleExpand() {
  expanded.value = !expanded.value;
}

async function onOpen(s: System) {
  await recentRepo.touch('system', s.id);
  chrome.tabs.create({ url: s.url });
  window.close();
}
</script>

<style scoped>
.section { padding: 0 12px 8px; }
.section-header { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 600; color: var(--text-secondary); padding: 8px 4px; text-transform: uppercase; cursor: pointer; user-select: none; }
.section-header:hover { color: var(--text-primary); }
.header-right { display: flex; align-items: center; gap: 6px; }
.count { font-size: 10px; color: var(--text-tertiary); background: var(--border-soft); padding: 1px 6px; border-radius: 8px; }
.header-right i { font-size: 9px; color: var(--text-tertiary); }
.sys-list { display: flex; flex-direction: column; gap: 2px; max-height: 280px; overflow-y: auto; }
.sys-list::-webkit-scrollbar { width: 4px; }
.sys-list::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
.sys-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.sys-item:hover { background: var(--border-soft); }
.sys-icon { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; flex-shrink: 0; }
.sys-text { flex: 1; min-width: 0; }
.sys-name { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sys-url { font-size: 10px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty { padding: 16px; text-align: center; font-size: 11px; color: var(--text-tertiary); }
</style>
