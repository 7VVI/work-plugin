<template>
  <div class="nav-tabs">
    <router-link v-for="tab in tabs" :key="tab.path" :to="tab.path" class="nav-tab" :class="{ active: isActive(tab.path) }">
      <i :class="tab.icon"></i>
      <span>{{ tab.label }}</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const tabs = [
  { path: '/systems', label: '系统管理', icon: 'fa-solid fa-table-columns' },
  { path: '/servers', label: '服务器', icon: 'fa-solid fa-server' },
  { path: '/middlewares', label: '中间件', icon: 'fa-solid fa-cubes' },
  { path: '/tags', label: '标签', icon: 'fa-solid fa-tags' },
  { path: '/import-export', label: '导入/导出', icon: 'fa-solid fa-file-import' },
  { path: '/settings', label: '设置中心', icon: 'fa-solid fa-gear' },
];

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<style scoped>
.nav-tabs { display: flex; align-items: center; gap: 4px; padding: 0 16px; height: 44px; background: white; border-bottom: 1px solid var(--border); }
.nav-tab { display: flex; align-items: center; gap: 6px; padding: 0 14px; height: 100%; font-size: 13px; color: var(--text-secondary); cursor: pointer; position: relative; transition: color 0.15s; font-weight: 500; text-decoration: none; }
.nav-tab:hover { color: var(--text-primary); }
.nav-tab.active { color: var(--primary); font-weight: 600; }
.nav-tab.active::after { content: ""; position: absolute; bottom: -1px; left: 8px; right: 8px; height: 2px; background: var(--primary); border-radius: 2px 2px 0 0; }
</style>
