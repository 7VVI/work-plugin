<template>
  <div class="page-header">
    <div class="brand">
      <span class="brand-logo">D</span>
      <span class="brand-name">Dock</span>
      <span class="brand-tag">控制台</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn" @click="toggleTheme" :title="isDark ? '切换到亮色' : '切换到暗色'">
        <i class="fa-solid fa-circle-half-stroke"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePrefStore } from '@shared/stores/prefStore';

const prefStore = usePrefStore();
const isDark = computed(() => prefStore.theme === 'dark');

function toggleTheme() {
  prefStore.theme = isDark.value ? 'light' : 'dark';
}
</script>

<style scoped>
.page-header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: 0 var(--page-pad);
  flex-shrink: 0;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand-logo {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), #1D4ED8);
  color: #fff; font-weight: var(--font-bold); font-size: var(--text-md);
  box-shadow: 0 4px 14px -4px var(--glow);
}
.brand-name { font-size: var(--text-md); font-weight: var(--font-bold); color: var(--ink); letter-spacing: -.3px; }
.brand-tag {
  display: inline-flex; align-items: center; height: 20px; padding: 0 8px;
  font-size: 10.5px; font-weight: var(--font-medium); color: var(--accent);
  background: var(--primary-50); border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(46,107,240,.18);
}
.header-actions { margin-left: auto; display: flex; align-items: center; gap: var(--gap-xs); }
.icon-btn {
  width: 36px; height: 36px; border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; color: var(--ink3); cursor: pointer;
  transition: var(--transition-fast);
}
.icon-btn:hover { background: var(--panel2); color: var(--ink); }
.icon-btn i { font-size: var(--text-sm); }
</style>
