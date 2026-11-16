<template>
  <div class="env-chips">
    <button
      v-for="env in ENVS"
      :key="env.value"
      class="env-chip"
      :class="[env.cls, { active: active.includes(env.value) }]"
      :title="active.includes(env.value) ? `取消筛选 ${env.label}` : `只看 ${env.label}`"
      @click="toggle(env.value)"
    >
      {{ env.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useSearchStore } from '@shared/stores/searchStore';

const ENVS = [
  { value: 'production', label: '生产', cls: 'env-prod' },
  { value: 'development', label: '开发', cls: 'env-dev' },
  { value: 'test', label: '测试', cls: 'env-test' },
  { value: 'staging', label: '预发', cls: 'env-staging' },
];

const searchStore = useSearchStore();
const { environments } = storeToRefs(searchStore);

const active = environments;

function toggle(env: string): void {
  searchStore.toggleEnvironment(env);
}
</script>

<style scoped>
.env-chips {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  overflow: hidden;
}
.env-chip {
  padding: 2px 6px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: var(--font-medium);
  font-family: inherit;
  line-height: 1.5;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: var(--transition-fast);
}
/* 未选中＝浅色底，选中＝实色 */
.env-chip.env-prod { background: var(--env-prod-bg); color: var(--env-prod-fg); }
.env-chip.env-dev { background: var(--env-dev-bg); color: var(--env-dev-fg); }
.env-chip.env-test { background: var(--env-test-bg); color: var(--env-test-fg); }
.env-chip.env-staging { background: var(--env-staging-bg); color: var(--env-staging-fg); }
.env-chip:hover { filter: brightness(.96); }
.env-chip.active { color: #fff; }
.env-chip.env-prod.active { background: var(--env-prod-fg); }
.env-chip.env-dev.active { background: var(--env-dev-fg); }
.env-chip.env-test.active { background: var(--env-test-fg); }
.env-chip.env-staging.active { background: var(--env-staging-fg); }
</style>
