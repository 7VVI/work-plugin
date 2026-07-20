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
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--page-pad);
  gap: 4px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs-bar::-webkit-scrollbar { display: none; }

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: var(--tabs-h);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  position: relative;
  transition: color 0.15s;
  font-weight: 500;
  user-select: none;
  text-decoration: none;
  white-space: nowrap;
}
.tab:hover { color: var(--text-primary); }
.tab.active { color: var(--text-primary); font-weight: 600; }
.tab.active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 14px;
  right: 14px;
  height: 2px;
  background: var(--primary);
  border-radius: 2px 2px 0 0;
}
.tab i { font-size: 13px; }
</style>
