<template>
  <div class="page-header">
    <div class="page-title">
      <div class="shield-icon"><i class="fa-solid fa-shield-halved"></i></div>
      <span>Nav Portal - 管理面板</span>
    </div>
    <div class="header-actions">
      <div class="icon-btn" @click="toggleTheme" :title="theme === 'light' ? '切换深色' : '切换浅色'">
        <i :class="theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
      </div>
      <div class="icon-btn" @click="$router.push('/settings')" title="设置">
        <i class="fa-solid fa-gear"></i>
      </div>
      <div class="user-avatar" title="admin">A</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePrefStore } from '@shared/stores/prefStore';
import { computed } from 'vue';

const prefStore = usePrefStore();
const theme = computed(() => prefStore.theme);

function toggleTheme() {
  prefStore.theme = theme.value === 'light' ? 'dark' : 'light';
}
</script>

<style scoped>
.page-header { height: 56px; background: white; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
.page-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; color: var(--text-primary); }
.shield-icon { width: 22px; height: 22px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; }
.header-actions { display: flex; align-items: center; gap: 4px; }
.icon-btn { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
.icon-btn:hover { background: var(--border-soft); color: var(--text-primary); }
.user-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-left: 8px; cursor: pointer; }
</style>
