import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { systemService } from '../services/systemService';
import { tagService } from '../services/tagService';
import type { System, SystemInput, Environment } from '../types/entities';

export const useSystemStore = defineStore('system', () => {
  const list = ref<System[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const filterEnv = ref<Environment | 'all'>('all');
  const filterTagId = ref<string | null>(null);
  const searchQuery = ref('');

  async function load() {
    loading.value = true;
    list.value = await systemService.all();
    loading.value = false;
  }

  async function create(input: SystemInput) {
    const id = await systemService.create(input);
    await load();
    return id;
  }

  async function update(id: string, patch: Partial<SystemInput>) {
    await systemService.update(id, patch);
    await load();
  }

  async function remove(id: string) {
    await systemService.delete(id);
    if (selectedId.value === id) selectedId.value = null;
    await load();
  }

  async function toggleFavorite(id: string) {
    await systemService.toggleFavorite(id);
    await load();
  }

  async function reorder(orderedIds: string[]) {
    await systemService.reorder(orderedIds);
    await load();
  }

  async function setTags(systemId: string, tagNames: string[]) {
    const tagIds = await tagService.findOrCreate(tagNames);
    await systemService.setTags(systemId, tagIds);
  }

  function select(id: string | null) {
    selectedId.value = id;
  }

  const filtered = computed(() => {
    let result = list.value;
    if (filterEnv.value !== 'all') {
      result = result.filter(s => s.environment === filterEnv.value);
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q) ||
        (s.remark ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  });

  const selected = computed(() => list.value.find(s => s.id === selectedId.value));
  const favorites = computed(() => list.value.filter(s => s.favorite));

  return {
    list, loading, selectedId, filterEnv, filterTagId, searchQuery,
    filtered, selected, favorites,
    load, create, update, remove, toggleFavorite, reorder, setTags, select,
  };
});
