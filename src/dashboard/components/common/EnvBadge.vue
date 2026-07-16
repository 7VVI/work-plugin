<template>
  <span class="env-tag" :style="{ background: meta.color, color: meta.textColor }">{{ meta.label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getEnvironmentMeta } from '@shared/types/enums';

const props = defineProps<{ env: string }>();
const meta = computed(() => getEnvironmentMeta(props.env));
</script>

<style scoped>
.env-tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; line-height: 1.4; }
</style>
