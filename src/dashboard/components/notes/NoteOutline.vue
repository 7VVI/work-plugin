<template>
  <aside class="note-outline">
    <div class="outline-head">
      <i class="fa-solid fa-list-ul"></i>
      <span>大纲</span>
      <span class="outline-count">{{ items.length }}</span>
      <button class="outline-close" title="关闭大纲" @click="emit('close')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="outline-body">
      <button
        v-for="item in items"
        :key="item.index"
        class="outline-item"
        :class="{ active: item.index === activeIndex }"
        :style="{ paddingLeft: `${10 + (item.level - 1) * 12}px` }"
        :title="item.text"
        @click="emit('select', item.index)"
      >
        {{ item.text }}
      </button>
      <div v-if="items.length === 0" class="outline-empty">暂无标题</div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { OutlineItem } from '@shared/utils/noteUtils';

defineProps<{
  items: OutlineItem[];
  activeIndex: number;
}>();

const emit = defineEmits<{ select: [index: number]; close: [] }>();
</script>

<style scoped>
.note-outline {
  width: 220px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--panel);
  overflow: hidden;
}
.outline-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--ink2);
  font-size: 12px;
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}
.outline-head i { color: var(--accent); font-size: 11px; }
.outline-count { margin-left: auto; font-family: var(--font-mono); font-size: 9.5px; color: var(--ink4); }
.outline-close {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink4);
  cursor: pointer;
  font-size: 10px;
  transition: background 0.12s ease, color 0.12s ease;
}
.outline-close:hover { background: var(--panel2); color: var(--ink); }
.outline-body { flex: 1; min-height: 0; overflow-y: auto; padding: 7px 8px 12px; }
.outline-item {
  width: 100%;
  display: block;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink3);
  text-align: left;
  font-size: 11.5px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.outline-item:hover { background: var(--panel2); color: var(--ink); }
.outline-item.active { background: color-mix(in srgb, var(--accent) 9%, transparent); color: var(--accent); }
.outline-empty { padding: 18px 10px; color: var(--ink4); font-size: 11px; text-align: center; }
@media (max-width: 1279px) {
  .note-outline { display: none; }
}
</style>
