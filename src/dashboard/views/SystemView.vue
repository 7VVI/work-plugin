<template>
  <div class="system-view">
    <div class="table-area">
      <SystemTable
        :systems="store.list"
        :selected-id="store.selectedId"
        @create="onCreate"
        @select="onSelect"
        @open="onOpen"
        @delete="onDelete"
        @toggle-fav="store.toggleFavorite"
        @bulk-delete="onBulkDelete"
      />
    </div>
    <div class="detail-area">
      <SystemForm
        v-if="store.selected || creating"
        :system="store.selected ?? null"
        :system-id="store.selectedId || ''"
        @close="onCloseForm"
        @saved="onSaved"
        @cancel="onCloseForm"
      />
      <div v-else class="empty-state">
        <i class="fa-solid fa-table-columns"></i>
        <p>选择一个系统查看详情，或点击"新增系统"</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { System } from '@shared/types/entities';
import SystemTable from '../components/system/SystemTable.vue';
import SystemForm from '../components/system/SystemForm.vue';

const store = useSystemStore();
const toast = useToastStore();
const creating = ref(false);

onMounted(async () => {
  await store.load();
});

function onCreate() {
  creating.value = true;
  store.select(null);
}

function onSelect(id: string) {
  creating.value = false;
  store.select(id);
}

function onOpen(system: System) {
  window.open(system.url, '_blank');
  store.update(system.id, {}).then(() => store.load());
}

async function onDelete(id: string) {
  if (!confirm('确认删除该系统？')) return;
  await store.remove(id);
  toast.success('已删除');
}

async function onBulkDelete(ids: string[]) {
  if (!confirm(`确认删除 ${ids.length} 个系统？`)) return;
  for (const id of ids) await store.remove(id);
  toast.success(`已删除 ${ids.length} 个系统`);
}

function onCloseForm() {
  creating.value = false;
  store.select(null);
}

async function onSaved() {
  creating.value = false;
  await store.load();
}
</script>

<style scoped>
.system-view { display: grid; grid-template-columns: 1fr 360px; gap: 12px; padding: 12px; flex: 1; min-height: 0; }
.table-area { min-width: 0; }
.detail-area { min-width: 0; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary); }
.empty-state i { font-size: 48px; margin-bottom: 12px; }
.empty-state p { font-size: 13px; }
</style>
