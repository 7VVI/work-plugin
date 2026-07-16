<template>
  <div class="middleware-view">
    <MiddlewareTable :middlewares="store.list" @create="onCreate" @edit="onEdit" @delete="onDelete" @copy-conn="store.copyConnectionString" @copy-pwd="store.copyPassword" />
    <MiddlewareForm :visible="formVisible" :middleware="editing" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { Middleware } from '@shared/types/entities';
import MiddlewareTable from '../components/middleware/MiddlewareTable.vue';
import MiddlewareForm from '../components/middleware/MiddlewareForm.vue';

const store = useMiddlewareStore();
const toast = useToastStore();
const formVisible = ref(false);
const editing = ref<Middleware | null>(null);

onMounted(async () => { await store.load(); });

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(m: Middleware) { editing.value = m; formVisible.value = true; }
async function onDelete(id: string) {
  if (!confirm('确认删除？')) return;
  await store.remove(id);
  toast.success('已删除');
}
async function onSaved() { formVisible.value = false; await store.load(); }
</script>

<style scoped>
.middleware-view { padding: 12px; }
</style>
