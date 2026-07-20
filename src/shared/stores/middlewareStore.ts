import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { middlewareService } from '../services/middlewareService';
import type { Middleware, MiddlewareInput } from '../types/entities';

export const useMiddlewareStore = defineStore('middleware', () => {
  const list = ref<Middleware[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const searchQuery = ref('');

  async function load() {
    loading.value = true;
    list.value = await middlewareService.all();
    loading.value = false;
  }

  async function create(input: MiddlewareInput) {
    const id = await middlewareService.create(input);
    await load();
    return id;
  }

  async function update(id: string, patch: Partial<MiddlewareInput>) {
    await middlewareService.update(id, patch);
    await load();
  }

  async function remove(id: string) {
    await middlewareService.delete(id);
    if (selectedId.value === id) selectedId.value = null;
    await load();
  }

  async function copyConnectionString(id: string) { await middlewareService.copyConnectionString(id); }
  async function copyPassword(id: string) { await middlewareService.copyPassword(id); }

  const filtered = computed(() => {
    if (!searchQuery.value.trim()) return list.value;
    const q = searchQuery.value.toLowerCase();
    return list.value.filter(m =>
      m.name.toLowerCase().includes(q) || m.host.toLowerCase().includes(q)
    );
  });

  const selected = computed(() => list.value.find(m => m.id === selectedId.value));

  return {
    list, loading, selectedId, searchQuery, filtered, selected,
    load, create, update, remove,
    copyConnectionString, copyPassword,
  };
});
