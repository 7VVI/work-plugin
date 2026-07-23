<template>
  <div class="server-view">
    <div class="action-bar">
      <button class="btn btn-dark" @click="onCreate">
        <i class="fa-solid fa-plus"></i>
        <span>新增服务器</span>
      </button>
      <div class="action-right">
        <div class="search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input v-model="store.searchQuery" class="search-input" placeholder="搜索服务器名称、IP、标签..." />
        </div>
      </div>
    </div>
    <div class="server-grid">
      <ServerCard v-for="s in store.filtered" :key="s.id" :server="s" @select="onSelect(s.id)" @edit="onEdit(s)" />
      <button v-if="store.filtered.length > 0" class="add-card" @click="onCreate">
        <i class="fa-solid fa-plus"></i>
        <span>添加服务器</span>
        <span class="hint">快速创建新的服务器连接</span>
      </button>
      <div v-if="store.filtered.length === 0 && !store.loading" class="empty-state">
        <i class="fa-solid fa-server"></i>
        <p>暂无服务器，点击"新增服务器"添加</p>
      </div>
    </div>
    <ServerForm :visible="formVisible" :server="editing" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useServerStore } from '@shared/stores/serverStore';
import type { Server } from '@shared/types/entities';
import ServerCard from '../components/server/ServerCard.vue';
import ServerForm from '../components/server/ServerForm.vue';

const store = useServerStore();
const formVisible = ref(false);
const editing = ref<Server | null>(null);

onMounted(async () => { await store.load(); });

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(s: Server) { editing.value = s; formVisible.value = true; }
function onSelect(id: string) { onEdit(store.list.find(s => s.id === id)!); }
async function onSaved() { formVisible.value = false; await store.load(); }
</script>

<style scoped>
.server-view { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-lg) var(--page-pad);
  gap: var(--gap-lg);
  flex-shrink: 0;
}
.action-right { display: flex; align-items: center; gap: var(--gap-md); }
.action-right .search-wrap { width: 320px; }

.server-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--gap-lg);
  padding: 0 var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  position: relative;
}
@media (min-width: 640px) { .server-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1280px) { .server-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1536px) { .server-grid { grid-template-columns: repeat(4, 1fr); } }

.add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 220px;
  width: 100%;
  border-radius: var(--radius-xl);
  border: 2px dashed var(--border-strong);
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  transition: var(--transition-fast);
  font-family: inherit;
  padding: var(--gap-xl);
}
.add-card i { font-size: 20px; }
.add-card > span:not(.hint) { font-size: var(--text-sm); font-weight: var(--font-medium); }
.add-card:hover { border-color: var(--accent); color: var(--accent); }
.add-card .hint { font-size: 11px; }

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}
.empty-state i {
  font-size: 36px;
  margin-bottom: var(--gap-md);
  color: var(--text-quaternary);
}
.empty-state p { font-size: var(--text-sm); margin: 0; }
</style>
