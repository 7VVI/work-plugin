<template>
  <Tag :variant="variant" :label="label" :size="size" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Tag from './Tag.vue';

const props = withDefaults(
  defineProps<{ env: string; size?: 'sm' | 'md' }>(),
  { size: 'md' },
);

const envMap: Record<string, 'env-dev' | 'env-prod' | 'env-test' | 'env-staging'> = {
  production: 'env-prod',
  development: 'env-dev',
  test: 'env-test',
  staging: 'env-staging',
};

const labelMap: Record<string, string> = {
  production: '生产',
  development: '开发',
  test: '测试',
  staging: '预发布',
};

const variant = computed(() => envMap[props.env] ?? 'default');
const label = computed(() => labelMap[props.env] ?? props.env);
</script>
