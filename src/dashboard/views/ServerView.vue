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
      <div v-if="store.filtered.length > 0" class="add-card" @click="onCreate">
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
  padding: var(--gap-lg) var(--page-pad);
  gap: var(--gap-lg);
  flex-shrink: 0;
}
.action-right { display: flex; align-items: center; gap: var(--gap-md); }
.action-right .search-wrap { width: 320px; }

.server-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--gap-lg);
  padding: 0 var(--page-pad) var(--page-pad);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  position: relative;
}

.add-card {
  background: var(--bg-pure);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-xl);
  padding: var(--gap-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
  min-height: 220px;
  gap: var(--gap-md);
  color: var(--text-tertiary);
}
.add-card:hover {
  border-color: var(--primary);
  background: var(--primary-50);
  color: var(--primary);
}
.add-card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-pill);
  background: var(--surface-secondary);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xl);
  transition: var(--transition);
}
.add-card:hover .add-card-icon {
  background: var(--bg-pure);
  border-color: var(--primary);
  color: var(--primary);
}
.add-card-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}
.add-card:hover .add-card-title { color: var(--primary); }
.add-card-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

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
