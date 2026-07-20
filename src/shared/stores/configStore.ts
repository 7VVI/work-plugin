import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { configService } from '../services/configService';
import type { ConfigGroup, ConfigItem } from '../types/entities';

export const useConfigStore = defineStore('config', () => {
  const list = ref<ConfigGroup[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);

  async function load() {
    loading.value = true;
    list.value = await configService.all();
    if (!selectedId.value && list.value.length > 0) {
      selectedId.value = list.value[0].id;
    }
    loading.value = false;
  }

  async function create(name: string) {
    const id = await configService.create(name);
    await load();
    selectedId.value = id;
    return id;
  }

  async function rename(id: string, name: string) {
    await configService.rename(id, name);
    await load();
  }

  async function remove(id: string) {
    await configService.delete(id);
    if (selectedId.value === id) selectedId.value = null;
    await load();
  }

  async function setItems(groupId: string, items: ConfigItem[]) {
    await configService.setItems(groupId, items);
    await load();
  }

  async function addItem(groupId: string, key: string, value: string) {
    await configService.addItem(groupId, key, value);
    await load();
  }

  async function updateItem(groupId: string, index: number, key: string, value: string) {
    await configService.updateItem(groupId, index, key, value);
    await load();
  }

  async function removeItem(groupId: string, index: number) {
    await configService.removeItem(groupId, index);
    await load();
  }

  function select(id: string) {
    selectedId.value = id;
  }

  const selected = computed(() => list.value.find(g => g.id === selectedId.value));

  return {
    list, loading, selectedId, selected,
    load, create, rename, remove, setItems, addItem, updateItem, removeItem, select,
  };
});
