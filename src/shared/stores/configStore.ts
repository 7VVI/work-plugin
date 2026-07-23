import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { configService } from '../services/configService';
import { generateId } from '../utils/id';
import type { ConfigField, ConfigProject } from '../types/entities';

export const useConfigStore = defineStore('config', () => {
  const list = ref<ConfigProject[]>([]);
  const loading = ref(false);
  const selectedProjectId = ref<string | null>(null);
  const selectedConfigId = ref<string | null>(null);

  const selectedProject = computed(
    () => list.value.find(p => p.id === selectedProjectId.value) ?? null
  );
  const selectedConfig = computed(
    () => selectedProject.value?.configs.find(c => c.id === selectedConfigId.value) ?? null
  );

  function ensureConfigSelection() {
    const p = selectedProject.value;
    if (p) {
      if (!p.configs.some(c => c.id === selectedConfigId.value)) {
        selectedConfigId.value = p.configs[0]?.id ?? null;
      }
    } else {
      selectedConfigId.value = null;
    }
  }

  async function load() {
    loading.value = true;
    list.value = await configService.all();
    if (!selectedProjectId.value && list.value.length > 0) {
      selectedProjectId.value = list.value[0].id;
    }
    ensureConfigSelection();
    loading.value = false;
  }

  function selectProject(id: string) {
    selectedProjectId.value = id;
    ensureConfigSelection();
  }

  function selectConfig(id: string) {
    selectedConfigId.value = id;
  }

  async function createProject(name: string) {
    const id = await configService.createProject(name);
    await load();
    selectedProjectId.value = id;
    selectedConfigId.value = null;
    return id;
  }

  async function renameProject(id: string, name: string) {
    const p = list.value.find(x => x.id === id);
    if (!p) return;
    await configService.renameProject(p, name);
  }

  async function deleteProject(id: string) {
    await configService.deleteProject(id);
    await load();
  }

  async function addConfig(projectId: string, name: string): Promise<string | null> {
    const p = list.value.find(x => x.id === projectId);
    if (!p) return null;
    const cfg = { id: generateId(), name, fields: [] as ConfigField[] };
    p.configs.push(cfg);
    selectedConfigId.value = cfg.id;
    await configService.saveProject(p);
    return cfg.id;
  }

  async function renameConfig(projectId: string, configId: string, name: string) {
    const p = list.value.find(x => x.id === projectId);
    const c = p?.configs.find(x => x.id === configId);
    if (!p || !c) return;
    c.name = name;
    await configService.saveProject(p);
  }

  async function deleteConfig(projectId: string, configId: string) {
    const p = list.value.find(x => x.id === projectId);
    if (!p) return;
    p.configs = p.configs.filter(c => c.id !== configId);
    if (selectedConfigId.value === configId) {
      selectedConfigId.value = p.configs[0]?.id ?? null;
    }
    await configService.saveProject(p);
  }

  async function setFields(projectId: string, configId: string, fields: ConfigField[]) {
    const p = list.value.find(x => x.id === projectId);
    const c = p?.configs.find(x => x.id === configId);
    if (!p || !c) return;
    c.fields = fields;
    await configService.saveProject(p);
  }

  async function copyValue(value: string) {
    await configService.copyValue(value);
  }

  return {
    list, loading, selectedProjectId, selectedConfigId, selectedProject, selectedConfig,
    load, selectProject, selectConfig,
    createProject, renameProject, deleteProject,
    addConfig, renameConfig, deleteConfig, setFields, copyValue,
  };
});
