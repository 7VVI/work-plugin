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
      <ServerCard v-for="s in store.filtered" :key="s.id" :server="s" @select="onSelect(s.id)" @edit="onEdit(s)" @copy-ip="store.copyIp(s.id)" @copy-ssh="store.copySshCommand(s.id)" @copy-pwd="store.copyPassword(s.id)" />
      <div class="add-card" @click="onCreate">
        <div class="add-card-icon"><i class="fa-solid fa-plus"></i></div>
        <div class="add-card-title">添加服务器</div>
        <div class="add-card-desc">快速创建新的服务器连接</div>
      </div>
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
  padding: 14px var(--page-pad);
  gap: 12px;
  flex-shrink: 0;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid transparent;
  font-family: inherit;
  white-space: nowrap;
}
.btn-dark { background: var(--primary); color: #fff; }
.btn-dark:hover { background: var(--primary-hover); }
.action-right { display: flex; align-items: center; gap: 8px; }
.search-wrap { position: relative; }
.search-input {
  width: 320px; height: 34px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 0 12px 0 34px; font-size: 13px;
  background: var(--card-bg); outline: none; font-family: inherit;
  color: var(--text-primary); transition: var(--transition);
}
.search-input::placeholder { color: var(--text-tertiary); }
.search-input:focus { border-color: var(--text-primary); box-shadow: var(--shadow-focus); }
.search-wrap > i {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--text-tertiary); font-size: 12px;
}

.server-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  padding: 4px var(--page-pad) var(--page-pad);
  flex: 1; min-height: 0; overflow-y: auto; align-content: start;
}
@media (max-width: 1400px) { .server-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 1100px) { .server-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 720px) { .server-grid { grid-template-columns: 1fr; } }

.add-card {
  background: var(--surface-secondary);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 14px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  cursor: pointer; transition: var(--transition);
  min-height: 240px; gap: 8px;
}
.add-card:hover { border-color: var(--text-primary); background: var(--card-bg); }
.add-card-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--card-bg); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-tertiary); font-size: 18px;
}
.add-card:hover .add-card-icon { border-color: var(--text-primary); color: var(--text-primary); }
.add-card-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.add-card:hover .add-card-title { color: var(--text-primary); }
.add-card-desc { font-size: 11.5px; color: var(--text-tertiary); }

.empty-state {
  grid-column: 1 / -1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 64px 0; color: var(--text-tertiary);
}
.empty-state i { font-size: 36px; margin-bottom: 10px; }
.empty-state p { font-size: 13px; margin: 0; }
</style>
