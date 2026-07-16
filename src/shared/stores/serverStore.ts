import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { serverService } from '../services/serverService';
import type { Server, ServerInput } from '../types/entities';

export const useServerStore = defineStore('server', () => {
  const list = ref<Server[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const searchQuery = ref('');

  async function load() {
    loading.value = true;
    list.value = await serverService.all();
    loading.value = false;
  }

  async function create(input: ServerInput) {
    const id = await serverService.create(input);
    await load();
    return id;
  }

  async function update(id: string, patch: Partial<ServerInput>) {
    await serverService.update(id, patch);
    await load();
  }

  async function remove(id: string) {
    await serverService.delete(id);
    if (selectedId.value === id) selectedId.value = null;
    await load();
  }

  async function toggleFavorite(id: string) {
    await serverService.toggleFavorite(id);
    await load();
  }

  async function copyIp(id: string) { await serverService.copyIp(id); }
  async function copySshCommand(id: string) { await serverService.copySshCommand(id); }
  async function copyPassword(id: string) { await serverService.copyPassword(id); }

  const filtered = computed(() => {
    if (!searchQuery.value.trim()) return list.value;
    const q = searchQuery.value.toLowerCase();
    return list.value.filter(s =>
      s.name.toLowerCase().includes(q) || s.ip.toLowerCase().includes(q)
    );
  });

  const selected = computed(() => list.value.find(s => s.id === selectedId.value));
  const favorites = computed(() => list.value.filter(s => s.favorite));

  return {
    list, loading, selectedId, searchQuery, filtered, selected, favorites,
    load, create, update, remove, toggleFavorite,
    copyIp, copySshCommand, copyPassword,
  };
});
