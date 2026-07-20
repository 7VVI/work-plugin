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
        <div class="sys-icon" :style="{ background: s.iconColor || 'linear-gradient(135deg,#4F7CFF,#3D6DF7)' }">
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
.section { padding: 0 var(--gap-md) var(--gap-sm); }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  padding: var(--gap-sm) var(--gap-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  user-select: none;
  transition: var(--transition-fast);
}
.section-header:hover { color: var(--text-primary); }
.header-right { display: flex; align-items: center; gap: 6px; }
.count {
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--surface-secondary);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-weight: var(--font-medium);
}
.header-right i {
  font-size: 9px;
  color: var(--text-quaternary);
  transition: var(--transition-fast);
}
.section-header:hover .header-right i { color: var(--text-secondary); }

.sys-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 300px;
  overflow-y: auto;
}
.sys-item {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding: var(--gap-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}
.sys-item:hover {
  background: var(--surface-hover);
}
.sys-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  flex-shrink: 0;
  box-shadow: var(--shadow-xs);
}
.sys-text { flex: 1; min-width: 0; }
.sys-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.sys-url {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.empty {
  padding: 24px var(--gap-md);
  text-align: center;
  font-size: var(--text-xs);
  color: var(--text-quaternary);
}
</style>
