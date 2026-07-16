<template>
  <span class="tag-pill" :style="{ background: bgColor, color: textColor }">
    {{ name }}
    <span v-if="removable" class="x" @click.stop="$emit('remove')"><i class="fa-solid fa-xmark"></i></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string; color?: string; removable?: boolean }>();
defineEmits<{ remove: [] }>();

const bgColor = computed(() => props.color ? `${props.color}20` : '#eff6ff');
const textColor = computed(() => props.color || '#1d4ed8');
</script>

<style scoped>
.tag-pill { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; line-height: 1.5; }
.tag-pill .x { cursor: pointer; opacity: 0.6; }
.tag-pill .x:hover { opacity: 1; }
</style>
