<template>
  <div class="tabs-bar">
    <router-link v-for="tab in tabs" :key="tab.path" :to="tab.path" class="tab" :class="{ active: isActive(tab.path) }">
      <i :class="tab.icon"></i>
      <span>{{ tab.label }}</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const tabs = [
  { path: '/systems', label: '系统', icon: 'fa-solid fa-table-columns' },
  { path: '/servers', label: '服务器', icon: 'fa-solid fa-server' },
  { path: '/middlewares', label: '中间件', icon: 'fa-solid fa-cubes' },
  { path: '/configs', label: '配置', icon: 'fa-solid fa-sliders' },
  { path: '/tags', label: '标签', icon: 'fa-solid fa-tags' },
  { path: '/import-export', label: '导入 / 导出', icon: 'fa-solid fa-file-import' },
  { path: '/settings', label: '设置', icon: 'fa-solid fa-gear' },
];

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<style scoped>
.tabs-bar {
  height: var(--tabs-h);
  background: var(--header-bg);
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  padding: 0 var(--page-pad);
  gap: 2px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs-bar::-webkit-scrollbar { display: none; }

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  position: relative;
}
.tab:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.tab.active {
  background: var(--primary-50);
  color: var(--primary);
  font-weight: var(--font-semibold);
}
.tab.active::after {
  content: '';
  position: absolute;
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2.5px;
  border-radius: 2px;
  background: var(--primary);
}
.tab i { font-size: var(--text-xs); opacity: 0.8; }
.tab.active i { opacity: 1; }
</style>
