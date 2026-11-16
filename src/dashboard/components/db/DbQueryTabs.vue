<template>
  <div class="db-qtool">
    <button class="db-qtool-btn" title="保存当前查询" @click="emit('save')">
      <i class="fa-solid fa-floppy-disk"></i>
    </button>
    <div class="db-saved">
      <button class="db-qtool-btn" title="已保存的查询" @click="savedOpen = !savedOpen">
        <i class="fa-solid fa-bookmark"></i>
      </button>
      <div v-if="savedOpen" class="db-saved-menu">
        <div v-if="saved.length === 0" class="db-saved-empty t3">暂无保存的查询</div>
        <div v-for="item in saved" :key="item.id" class="db-saved-item">
          <button class="db-saved-name" :title="item.sql" @click="emit('open-saved', item.id)">
            {{ item.name }}
          </button>
          <button class="ibtn ibtn-sm danger" title="删除" @click="emit('delete-saved', item.id)">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>
    <span class="db-qtool-spacer"></span>
    <button v-if="running" class="db-qtool-btn db-qtool-stop" title="取消" @click="emit('cancel')">
      <i class="fa-solid fa-stop"></i>
    </button>
    <button class="db-qtool-btn db-qtool-run-all" title="执行全部语句 (Shift+Ctrl+Enter)" :disabled="running" @click="emit('run-all')">
      <i class="fa-solid fa-forward"></i>
    </button>
    <button class="db-qtool-btn db-qtool-run" title="执行光标所在语句 (Ctrl+Enter)" :disabled="running" @click="emit('run')">
      <i class="fa-solid fa-play"></i>
    </button>
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
.db-qtool {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.db-qtool-spacer { flex: 1; }
.db-qtool-btn {
  width: 26px;
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
.db-qtool-btn:hover:not(:disabled) { background: var(--surface-hover); color: var(--ink); }
.db-qtool-btn:disabled { opacity: .45; cursor: not-allowed; }
.db-qtool-run { color: var(--accent); }
.db-qtool-run-all { color: var(--accent2); }
.db-qtool-stop { color: var(--danger); }
.db-saved { position: relative; }
.db-saved-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
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
.db-saved-item { display: flex; align-items: center; gap: 4px; border-radius: var(--radius-sm); }
.db-saved-item:hover { background: var(--surface-hover); }
.db-saved-name {
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
.db-saved-name:hover { color: var(--accent); }
.db-saved-empty { padding: 8px; font-size: 12px; text-align: center; }
</style>
