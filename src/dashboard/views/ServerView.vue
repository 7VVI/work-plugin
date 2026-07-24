<template>
  <div class="server-view">
    <GroupSidebar entity-type="server" label="服务器" :records="store.list" v-model="selectedGroupId" />
    <div class="server-content">
      <!-- 操作栏 - v3 风格 -->
      <div class="action-bar">
        <button class="btn-p" @click="onCreate">
          <i class="fa-solid fa-plus"></i>新增服务器
        </button>
        <div class="flex-spacer"></div>
        <div class="search-field">
          <i class="fa-solid fa-magnifying-glass search-ico t3"></i>
          <input v-model="search" class="inp search-inp" placeholder="搜索服务器名称、IP…" />
        </div>
      </div>

      <!-- 服务器网格 - v3 风格 -->
      <VueDraggable
        v-model="filteredServers"
        class="server-grid"
        :animation="200"
        ghost-class="dragging"
        @end="onDragEnd"
      >
        <ServerCard
          v-for="s in filteredServers"
          :key="s.id"
          :server="s"
          @select="onSelect(s.id)"
          @delete="onDelete(s.id)"
        />
        <button
          v-if="filteredServers.length > 0"
          class="add-tile"
          @click="onCreate"
        >
          <i class="fa-solid fa-plus add-tile-icon"></i>
          <span class="add-tile-title">添加服务器</span>
          <span class="add-tile-sub">快速创建新的服务器连接</span>
        </button>
        <div v-if="filteredServers.length === 0 && !store.loading" class="empty-state">
          <i class="fa-solid fa-server empty-icon t3"></i>
          <div class="empty-text t3">暂无服务器，点击"新增服务器"添加</div>
        </div>
      </VueDraggable>
    </div>

    <ServerForm :visible="formVisible" :server="editing" :default-group-id="selectedGroupId === 'all' ? '' : selectedGroupId" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useServerStore } from '@shared/stores/serverStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { Server } from '@shared/types/entities';
import ServerCard from '../components/server/ServerCard.vue';
import ServerForm from '../components/server/ServerForm.vue';
import GroupSidebar from '../components/common/GroupSidebar.vue';

const store = useServerStore();
const dialog = useDialogStore();
const toast = useToastStore();
const formVisible = ref(false);
const editing = ref<Server | null>(null);
const search = ref('');
const selectedGroupId = ref<string>('all');

onMounted(async () => { await store.load(); });

const filteredServers = computed(() => {
  let result = store.list;
  if (selectedGroupId.value !== 'all') {
    result = result.filter(s => s.groupId === selectedGroupId.value);
  }
  if (!search.value.trim()) return result;
  const q = search.value.toLowerCase();
  return result.filter(s =>
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

async function onDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
  const newList = [...filteredServers.value];
  const [moved] = newList.splice(oldIndex, 1);
  newList.splice(newIndex, 0, moved);
  const orderedIds = newList.map(s => s.id);
  await store.reorder(orderedIds);
  await store.load();
  toast.success('排序已更新');
}
</script>

<style scoped>
.server-view {
  display: flex;
  flex-direction: row;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  gap: var(--gap-lg);
}
.server-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

/* 操作栏 */
.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.flex-spacer { flex: 1; min-width: 0; }
.btn-p i { font-size: 11px; }

/* 搜索框 */
.search-field {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.search-ico {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  pointer-events: none;
}
.search-inp {
  width: 288px;
  padding-left: 32px;
}

/* 服务器网格 */
.server-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-content: start;
}
@media (min-width: 640px) {
  .server-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1280px) {
  .server-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1536px) {
  .server-grid { grid-template-columns: repeat(4, 1fr); }
}

/* 添加占位卡 */
.add-tile {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 14px;
  border: 2px dashed var(--border2);
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
  font-family: inherit;
}
.add-tile:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.add-tile-icon { font-size: 18px; }
.add-tile-title { font-size: 13px; font-weight: var(--font-medium); }
.add-tile-sub { font-size: 11px; }

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  padding: 64px 0;
  text-align: center;
}
.empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }
.empty-text { font-size: 13px; }

/* 拖拽 */
.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}
</style>
