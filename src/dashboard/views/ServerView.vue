<template>
  <div class="server-view">
    <!-- 操作栏 - v3 风格 -->
    <div class="action-bar">
      <button class="btn-p" @click="onCreate">
        <i class="fa-solid fa-plus text-[11px]"></i>新增服务器
      </button>
      <div class="flex-1"></div>
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] t3"></i>
        <input v-model="search" class="inp w-72 !pl-8" placeholder="搜索服务器名称、IP…" />
      </div>
    </div>

    <!-- 服务器网格 - v3 风格 -->
    <div class="server-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <ServerCard
        v-for="s in filteredServers"
        :key="s.id"
        :server="s"
        @select="onSelect(s.id)"
        @delete="onDelete(s.id)"
      />
      <button
        v-if="filteredServers.length > 0"
        class="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed t3 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        style="border-color:var(--border2)"
        @click="onCreate"
      >
        <i class="fa-solid fa-plus text-lg"></i>
        <span class="text-[13px] font-medium">添加服务器</span>
        <span class="text-[11px]">快速创建新的服务器连接</span>
      </button>
      <div v-if="filteredServers.length === 0 && !store.loading" class="py-16 text-center">
        <i class="fa-solid fa-server text-2xl t3"></i>
        <div class="mt-2 text-[13px] t3">暂无服务器，点击"新增服务器"添加</div>
      </div>
    </div>

    <ServerForm :visible="formVisible" :server="editing" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useServerStore } from '@shared/stores/serverStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { Server } from '@shared/types/entities';
import ServerCard from '../components/server/ServerCard.vue';
import ServerForm from '../components/server/ServerForm.vue';

const store = useServerStore();
const dialog = useDialogStore();
const toast = useToastStore();
const formVisible = ref(false);
const editing = ref<Server | null>(null);
const search = ref('');

onMounted(async () => { await store.load(); });

const filteredServers = computed(() => {
  if (!search.value.trim()) return store.list;
  const q = search.value.toLowerCase();
  return store.list.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.ip.toLowerCase().includes(q)
  );
});

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(s: Server) { editing.value = s; formVisible.value = true; }
function onSelect(id: string) { onEdit(store.list.find(s => s.id === id)!); }
async function onSaved() { formVisible.value = false; await store.load(); }

async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该服务器？');
  if (!ok) return;
  await store.remove(id);
  toast.success('已删除');
}
</script>

<style scoped>
.server-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  flex-shrink: 0;
}

.server-grid {
  padding: 0 24px 24px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
}
</style>
