<template>
  <div class="db-dbsel">
    <button class="db-dbsel-btn" :title="`当前查询使用的库：${modelValue || '未选择'}`" @click="open = !open">
      <i class="fa-solid fa-database"></i>
      <span class="db-dbsel-name">{{ modelValue || '选择数据库' }}</span>
      <i class="fa-solid fa-chevron-down"></i>
    </button>
    <div v-if="open" class="db-dbsel-menu">
      <div v-if="databases.length === 0" class="db-dbsel-empty t3">没有可用的库</div>
      <button
        v-for="db in databases"
        :key="db.name"
        class="db-dbsel-item"
        :class="{ active: db.name === modelValue }"
        @click="pick(db.name)"
      >
        <i class="fa-solid fa-database"></i>
        <span class="db-dbsel-item-name">{{ db.name }}</span>
        <i v-if="db.name === modelValue" class="fa-solid fa-check"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { DbObjectItem } from '@protocol/db';

defineProps<{
  databases: DbObjectItem[];
  modelValue: string;
}>();

const emit = defineEmits<{
  select: [name: string];
}>();

const open = ref(false);

function pick(name: string): void {
  open.value = false;
  emit('select', name);
}

function onDocClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target?.closest('.db-dbsel')) open.value = false;
}

onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
.db-dbsel { position: relative; }
.db-dbsel-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--ink2);
  font-size: 12.5px;
  cursor: pointer;
  max-width: 260px;
}
.db-dbsel-btn:hover { border-color: var(--border-strong); color: var(--ink); }
.db-dbsel-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-dbsel-menu {
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  z-index: 40;
  min-width: 220px;
  max-height: 280px;
  overflow: auto;
  padding: 6px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.db-dbsel-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 6px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--ink2);
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
}
.db-dbsel-item:hover { background: var(--surface-hover); color: var(--ink); }
.db-dbsel-item.active { color: var(--accent); }
.db-dbsel-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-dbsel-empty { padding: 8px; font-size: 12px; text-align: center; }
</style>
