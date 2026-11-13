<template>
  <div class="page-header">
    <div class="brand">
      <span class="brand-logo">D</span>
      <span class="brand-name">Dock</span>
    </div>
    <div class="header-actions">
      <button
        ref="toggleEl"
        class="icon-btn theme-toggle"
        :title="isDark ? '切换到亮色' : '切换到暗色'"
        @click="toggleTheme"
      >
        <i class="fa-solid" :class="isDark ? 'fa-moon' : 'fa-sun'"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { applyTheme, resolvedTheme, switchTheme } from '@shared/utils/themeTransition';

const prefStore = usePrefStore();
const toggleEl = ref<HTMLButtonElement | null>(null);
const isDark = computed(() => resolvedTheme.value === 'dark');

function toggleTheme() {
  const next = resolvedTheme.value === 'dark' ? 'light' : 'dark';
  void switchTheme(() => {
    prefStore.theme = next;
    applyTheme(next);
  }, toggleEl.value);
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
.header-actions { margin-left: auto; display: flex; align-items: center; gap: var(--gap-xs); }
.icon-btn {
  width: 36px; height: 36px; border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; color: var(--ink3); cursor: pointer;
  transition: var(--transition-fast);
}
.icon-btn:hover { background: var(--panel2); color: var(--ink); }
.icon-btn i { font-size: var(--text-sm); }
.theme-toggle {
  view-transition-name: dock-theme-toggle;
  transition: transform 450ms cubic-bezier(.2, .8, .2, 1), background-color 300ms ease, color 300ms ease;
}
.theme-toggle:active { transform: scale(.85); }
.theme-toggle i.fa-sun { color: #F59E0B; }
.icon-btn:hover i.fa-sun { color: #FBBF24; }
</style>
