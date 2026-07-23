import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { configService } from '../services/configService';
import type { ConfigProject, ConfigDef, ConfigField } from '../types/entities';

export const useConfigStoreV3 = defineStore('configV3', () => {
  const projects = ref<ConfigProject[]>([]);
  const configs = ref<ConfigDef[]>([]);
  const selectedProjectId = ref<string | null>(null);
  const selectedConfigId = ref<string | null>(null);
  const loading = ref(false);

  async function loadProjects() {
    loading.value = true;
    projects.value = await configService.allProjects();
    if (!selectedProjectId.value && projects.value.length > 0) {
      selectedProjectId.value = projects.value[0].id;
      await loadConfigs(selectedProjectId.value);
    }
    loading.value = false;
  }

  async function loadConfigs(projectId: string) {
    configs.value = await configService.configsByProject(projectId);
    if (configs.value.length > 0 && !selectedConfigId.value) {
      selectedConfigId.value = configs.value[0].id;
    }
  }

  function selectProject(id: string) {
    selectedProjectId.value = id;
    selectedConfigId.value = null;
    loadConfigs(id);
  }

  function selectConfig(id: string) {
    selectedConfigId.value = id;
  }

  async function createProject(name: string) {
    const id = await configService.createProject(name);
    await loadProjects();
    selectedProjectId.value = id;
    return id;
  }

  async function renameProject(id: string, name: string) {
    await configService.renameProject(id, name);
    await loadProjects();
  }

  async function deleteProject(id: string) {
    await configService.deleteProject(id);
    if (selectedProjectId.value === id) {
      selectedProjectId.value = null;
      selectedConfigId.value = null;
      configs.value = [];
    }
    await loadProjects();
  }

  async function reorderProjects(orderedIds: string[]) {
    await configService.reorderProjects(orderedIds);
    await loadProjects();
  }

  async function addConfig(projectId: string, name: string) {
    const id = await configService.createConfig(projectId, name);
    await loadConfigs(projectId);
    selectedConfigId.value = id;
    return id;
  }

  async function renameConfig(id: string, name: string) {
    await configService.renameConfig(id, name);
    if (selectedProjectId.value) {
      await loadConfigs(selectedProjectId.value);
    }
  }

  async function deleteConfig(id: string) {
    await configService.deleteConfig(id);
    if (selectedConfigId.value === id) {
      selectedConfigId.value = null;
    }
    if (selectedProjectId.value) {
      await loadConfigs(selectedProjectId.value);
    }
  }

  async function setFields(configId: string, fields: ConfigField[]) {
    await configService.setConfigFields(configId, fields);
    if (selectedProjectId.value) {
      await loadConfigs(selectedProjectId.value);
    }
  }

  async function reorderConfigs(projectId: string, orderedIds: string[]) {
    await configService.reorderConfigs(projectId, orderedIds);
    await loadConfigs(projectId);
  }

  async function copyValue(value: string) {
    await configService.copyValue(value);
  }

  const selectedProject = computed(() =>
    projects.value.find(p => p.id === selectedProjectId.value)
  );

  const selectedConfig = computed(() =>
    configs.value.find(c => c.id === selectedConfigId.value)
  );

  return {
    projects, configs, selectedProjectId, selectedConfigId, loading,
    selectedProject, selectedConfig,
    loadProjects, loadConfigs, selectProject, selectConfig,
    createProject, renameProject, deleteProject, reorderProjects,
    addConfig, renameConfig, deleteConfig, setFields, reorderConfigs,
    copyValue,
  };
});
