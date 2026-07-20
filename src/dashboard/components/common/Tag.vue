<template>
  <span
    class="tag"
    :class="[`tag-${resolvedVariant}`, { 'tag-sm': size === 'sm', removable }]"
    :style="customStyle"
  >
    <span class="tag-text"><slot>{{ label }}</slot></span>
    <span v-if="removable" class="tag-x" @click.stop="$emit('remove')">
      <i class="fa-solid fa-xmark"></i>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Variant = 'env-dev' | 'env-prod' | 'env-test' | 'env-staging' | 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger';

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    color?: string;
    label?: string | number;
    removable?: boolean;
    size?: 'sm' | 'md';
  }>(),
  { variant: 'default', size: 'md' },
);

defineEmits<{ remove: [] }>();

const envVariantMap: Record<string, Variant> = {
  development: 'env-dev',
  production: 'env-prod',
  test: 'env-test',
  staging: 'env-staging',
};

const resolvedVariant = computed<Variant>(() => {
  if (props.color) return 'default';
  if ((props.variant || '').startsWith('env-')) return props.variant as Variant;
  return props.variant || 'default';
});

const customStyle = computed(() => {
  if (!props.color) return undefined;
  return {
    background: `${props.color}1A`,
    color: props.color,
  };
});

void envVariantMap;
</script>

<style scoped>
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.1px;
  user-select: none;
}
.tag.tag-sm { height: 22px; padding: 0 8px; font-size: 11px; }
.tag-text { display: inline-flex; align-items: center; }
.tag-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-pill);
  opacity: 0.55;
  cursor: pointer;
  transition: var(--transition-fast);
}
.tag-x:hover { opacity: 1; background: rgba(0, 0, 0, 0.08); }
.tag-x i { font-size: 9px; }

.tag-default { background: var(--surface-secondary); color: var(--text-secondary); }
.tag-primary { background: var(--primary-50); color: var(--primary); }
.tag-info { background: var(--info-light); color: var(--info-text); }
.tag-success { background: var(--success-light); color: var(--success-text); }
.tag-warning { background: var(--warning-light); color: var(--warning-text); }
.tag-danger { background: var(--danger-light); color: var(--danger-text); }

.tag-env-dev { background: var(--env-dev-bg); color: var(--env-dev-fg); }
.tag-env-prod { background: var(--env-prod-bg); color: var(--env-prod-fg); }
.tag-env-test { background: var(--env-test-bg); color: var(--env-test-fg); }
.tag-env-staging { background: var(--env-staging-bg); color: var(--env-staging-fg); }
</style>
