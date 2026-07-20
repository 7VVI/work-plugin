<template>
  <Tag
    :variant="color ? undefined : 'primary'"
    :color="color"
    :label="name"
    :removable="removable"
    size="sm"
    @remove="$emit('remove')"
  />
</template>

<script setup lang="ts">
import Tag from './Tag.vue';

defineProps<{ name: string; color?: string; removable?: boolean }>();
defineEmits<{ remove: [] }>();
</script>
