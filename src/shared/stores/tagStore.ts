import { defineStore } from 'pinia';
import { ref } from 'vue';
import { tagService } from '../services/tagService';
import type { Tag } from '../types/entities';

export const useTagStore = defineStore('tag', () => {
  const list = ref<Tag[]>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    list.value = await tagService.all();
    loading.value = false;
  }

  async function create(name: string, color?: string) {
    const id = await tagService.create(name, color);
    await load();
    return id;
  }

  async function update(id: string, patch: Partial<Tag>) {
    await tagService.update(id, patch);
    await load();
  }

  async function remove(id: string) {
    await tagService.delete(id);
    await load();
  }

  return { list, loading, load, create, update, remove };
});
