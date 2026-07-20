<template>
  <span class="env-tag" :class="`env-${env}`">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ env: string }>();
const label = computed(() => ({
  production: '生产',
  development: '开发',
  test: '测试',
  staging: '预发布',
}[props.env] ?? props.env));
</script>

<style scoped>
.env-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
}
.env-production { background: var(--env-prod-bg); color: var(--env-prod-fg); }
.env-development { background: var(--env-dev-bg); color: var(--env-dev-fg); }
.env-test { background: var(--env-test-bg); color: var(--env-test-fg); }
.env-staging { background: var(--env-staging-bg); color: var(--env-staging-fg); }
</style>
