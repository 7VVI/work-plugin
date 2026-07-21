<template>
  <div class="page-header">
    <div class="brand">
      <div class="brand-logo">D</div>
      <div class="brand-text">
        <div class="brand-name-row">
          <span class="brand-name">Dock</span>
          <span class="brand-tag">管理控制台</span>
        </div>
      </div>
    </div>
    <div class="header-actions">
      <button class="icon-btn" @click="toggleTheme" :title="isDark ? '切换到亮色主题' : '切换到暗色主题'">
        <i :class="isDark ? 'fa-regular fa-sun' : 'fa-regular fa-moon'"></i>
      </button>
      <button class="icon-btn" @click="$router.push('/settings')" title="设置">
        <i class="fa-solid fa-gear"></i>
      </button>
      <div class="avatar">A</div>
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
  background: var(--header-bg);
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--page-pad);
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
}
.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, #4F7CFF 0%, #3D6DF7 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-semibold);
  font-size: var(--text-lg);
  letter-spacing: -0.5px;
  box-shadow: var(--shadow-primary);
}
.brand-text { display: flex; flex-direction: column; }
.brand-name-row {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}
.brand-name {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.3px;
}
.brand-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: var(--font-medium);
  color: var(--primary);
  background: var(--primary-50);
  border-radius: var(--radius-sm);
  letter-spacing: 0.1px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
}
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
}
.icon-btn:hover {
  background: var(--primary-50);
  color: var(--primary);
}
.icon-btn i { font-size: var(--text-sm); }

.avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  background: var(--surface-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  margin-left: var(--gap-xs);
  cursor: pointer;
  transition: var(--transition-fast);
}
.avatar:hover {
  background: var(--primary-50);
  color: var(--primary);
  border-color: var(--primary-100);
}
</style>
