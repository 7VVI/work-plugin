import { defineStore } from 'pinia';
import { ref } from 'vue';
import { groupService } from '../services/groupService';
import type { Group, EntityType } from '../types/entities';

export const useGroupStore = defineStore('group', () => {
  const groups = ref<Group[]>([]);
  const currentType = ref<EntityType | null>(null);
  const loading = ref(false);

  async function load(entityType: EntityType) {
    currentType.value = entityType;
    loading.value = true;
    groups.value = await groupService.allByType(entityType);
    loading.value = false;
  }

  async function create(name: string, color: string) {
    if (!currentType.value) return;
    const id = await groupService.create(currentType.value, name, color);
    await load(currentType.value);
    return id;
  }

  async function rename(id: string, name: string) {
    await groupService.rename(id, name);
    if (currentType.value) await load(currentType.value);
  }

  async function setColor(id: string, color: string) {
    await groupService.setColor(id, color);
    if (currentType.value) await load(currentType.value);
  }

  async function remove(id: string) {
    if (!currentType.value) return;
    await groupService.remove(id, currentType.value);
    await load(currentType.value);
  }

  async function reorder(orderedIds: string[]) {
    if (!currentType.value) return;
    await groupService.reorder(orderedIds);
    await load(currentType.value);
  }

  return { groups, currentType, loading, load, create, rename, setColor, remove, reorder };
});
