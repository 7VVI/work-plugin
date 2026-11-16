<template>
  <div class="db-qbar">
    <button
      class="db-qbar-btn db-qbar-run"
      title="执行光标所在语句 (Ctrl+Enter)"
      :disabled="running"
      @click="emit('run')"
    >
      <i class="fa-solid fa-play"></i>
    </button>
    <button
      class="db-qbar-btn db-qbar-run-all"
      title="执行全部语句 (Shift+Ctrl+Enter)"
      :disabled="running"
      @click="emit('run-all')"
    >
      <i class="fa-solid fa-forward"></i>
    </button>
    <button
      v-if="running"
      class="db-qbar-btn db-qbar-stop"
      title="取消"
      @click="emit('cancel')"
    >
      <i class="fa-solid fa-stop"></i>
    </button>
    <span class="db-qbar-sep"></span>
    <button class="db-qbar-btn" title="保存当前查询" @click="emit('save')">
      <i class="fa-solid fa-floppy-disk"></i>
    </button>
    <div class="db-qbar-saved">
      <button class="db-qbar-btn" title="已保存的查询" @click="savedOpen = !savedOpen">
        <i class="fa-solid fa-bookmark"></i>
      </button>
      <div v-if="savedOpen" class="db-qbar-menu">
        <div v-if="saved.length === 0" class="db-qbar-empty t3">暂无保存的查询</div>
        <div v-for="item in saved" :key="item.id" class="db-qbar-item">
          <button class="db-qbar-name" :title="item.sql" @click="emit('open-saved', item.id)">
            {{ item.name }}
          </button>
          <button class="ibtn ibtn-sm danger" title="删除" @click="emit('delete-saved', item.id)">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { DbSavedQuery } from '@shared/stores/dbStore';

defineProps<{
  saved: DbSavedQuery[];
  running?: boolean;
}>();

const emit = defineEmits<{
  run: [];
  'run-all': [];
  cancel: [];
  save: [];
  'open-saved': [id: string];
  'delete-saved': [id: string];
}>();

const savedOpen = ref(false);
</script>

<style scoped>
/* 左侧竖排操作条 */
.db-qbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 30px;
  flex-shrink: 0;
  padding: 5px 0;
  border-right: 1px solid var(--border);
  background: var(--panel);
}
.db-qbar-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--ink3);
  font-size: 11px;
  cursor: pointer;
}
.db-qbar-btn:hover:not(:disabled) { background: var(--surface-hover); color: var(--ink); }
.db-qbar-btn:disabled { opacity: .45; cursor: not-allowed; }
.db-qbar-run { color: var(--accent); }
.db-qbar-run-all { color: var(--accent2); }
.db-qbar-stop { color: var(--danger); }
.db-qbar-sep { width: 16px; height: 1px; background: var(--border); margin: 3px 0; }
.db-qbar-saved { position: relative; }
.db-qbar-menu {
  position: absolute;
  left: calc(100% + 6px);
  top: 0;
  z-index: 40;
  min-width: 220px;
  max-height: 260px;
  overflow: auto;
  padding: 6px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.db-qbar-item { display: flex; align-items: center; gap: 4px; border-radius: var(--radius-sm); }
.db-qbar-item:hover { background: var(--surface-hover); }
.db-qbar-name {
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  color: var(--ink2);
  font-size: 12.5px;
  padding: 5px 6px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-qbar-name:hover { color: var(--accent); }
.db-qbar-empty { padding: 8px; font-size: 12px; text-align: center; }
</style>
