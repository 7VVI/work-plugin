<template>
  <div class="server-view">
    <div class="action-bar">
      <button class="btn btn-primary" @click="onCreate"><i class="fa-solid fa-plus"></i> 新增服务器</button>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="store.searchQuery" class="search-input" placeholder="搜索服务器..." />
      </div>
    </div>
    <div class="server-grid">
      <ServerCard v-for="s in store.filtered" :key="s.id" :server="s" @select="onSelect(s.id)" @edit="onEdit(s)" @copy-ip="store.copyIp(s.id)" @copy-ssh="store.copySshCommand(s.id)" @copy-pwd="store.copyPassword(s.id)" @toggle-fav="store.toggleFavorite(s.id)" />
      <div class="server-card add-card" @click="onCreate"><i class="fa-solid fa-plus"></i><div>新增服务器</div></div>
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
function onSelect(id: string) { /* show detail or edit */ onEdit(store.list.find(s => s.id === id)!); }
async function onSaved() { formVisible.value = false; await store.load(); }
</script>

<style scoped>
.server-view { padding: 12px; }
.action-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.search-wrap { position: relative; margin-left: auto; }
.search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; }
.search-input { height: 30px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px 0 30px; font-size: 12px; width: 240px; outline: none; font-family: inherit; }
.server-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.add-card { border: 1px dashed #d1d5db; background: #fafbfc; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 12px; min-height: 110px; cursor: pointer; }
.add-card i { font-size: 18px; margin-bottom: 4px; }
.add-card:hover { border-color: #93c5fd; color: var(--primary); }
</style>
