import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { configService } from '../services/configService';
import type { ConfigProject, ConfigDef, ConfigField, Environment } from '../types/entities';

export const useConfigStoreV3 = defineStore('configV3', () => {
  const projects = ref<ConfigProject[]>([]);
  const configs = ref<ConfigDef[]>([]);
  const projectConfigs = ref<Record<string, ConfigDef[]>>({});
  const configCounts = ref<Record<string, number>>({});
  const selectedProjectId = ref<string | null>(null);
  const selectedConfigId = ref<string | null>(null);
  const loading = ref(false);

  async function loadProjects() {
    loading.value = true;
    const all = await configService.allProjectsWithConfigs();
    projects.value = all.map(({ configs: _, ...p }) => p);
    const counts: Record<string, number> = {};
    const pcMap: Record<string, ConfigDef[]> = {};
    for (const p of all) {
      counts[p.id] = p.configs.length;
      pcMap[p.id] = p.configs;
    }
    configCounts.value = counts;
    projectConfigs.value = pcMap;
    if (!selectedProjectId.value && projects.value.length > 0) {
      selectedProjectId.value = projects.value[0].id;
      await loadConfigs(selectedProjectId.value);
    }
    loading.value = false;
  }

  async function loadConfigs(projectId: string) {
    const list = await configService.configsByProject(projectId);
    projectConfigs.value = { ...projectConfigs.value, [projectId]: list };
    configCounts.value = { ...configCounts.value, [projectId]: list.length };
    // configs 始终对应当前选中的分组，避免拖拽/重命名其他分组时覆盖右侧详情
    if (selectedProjectId.value === projectId) {
      configs.value = list;
      if (list.length > 0 && !selectedConfigId.value) {
        selectedConfigId.value = list[0].id;
      }
    }
  }

  function projectIdOfConfig(id: string): string | undefined {
    for (const [projectId, list] of Object.entries(projectConfigs.value)) {
      if (list.some(c => c.id === id)) return projectId;
    }
    return undefined;
  }

  function selectProject(id: string) {
    if (id === selectedProjectId.value) return;
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
    selectedConfigId.value = null;
    configs.value = [];
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

  async function addConfig(projectId: string, name: string, environment?: Environment) {
    const id = await configService.createConfig(projectId, name, environment);
    await loadConfigs(projectId);
    selectedConfigId.value = id;
    return id;
  }

  async function renameConfig(id: string, name: string) {
    const projectId = projectIdOfConfig(id) ?? selectedProjectId.value;
    await configService.renameConfig(id, name);
    if (projectId) await loadConfigs(projectId);
  }

  async function setConfigEnvironment(id: string, environment?: Environment) {
    await configService.setConfigEnvironment(id, environment);
    if (selectedProjectId.value) {
      await loadConfigs(selectedProjectId.value);
    }
  }

  async function deleteConfig(id: string) {
    const projectId = projectIdOfConfig(id) ?? selectedProjectId.value;
    await configService.deleteConfig(id);
    if (selectedConfigId.value === id) {
      selectedConfigId.value = null;
    }
    if (projectId) {
      await loadConfigs(projectId);
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

  async function moveConfig(id: string, targetProjectId: string, targetIndex: number) {
    const wasSelected = selectedConfigId.value === id;
    await configService.moveConfig(id, targetProjectId, targetIndex);
    await loadProjects();
    if (wasSelected) {
      // 选中的配置被移动后跟随到目标分组，保持右侧详情不变
      selectedProjectId.value = targetProjectId;
      await loadConfigs(targetProjectId);
      selectedConfigId.value = id;
    } else if (selectedProjectId.value) {
      await loadConfigs(selectedProjectId.value);
    }
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
    projects, configs, projectConfigs, configCounts, selectedProjectId, selectedConfigId, loading,
    selectedProject, selectedConfig,
    loadProjects, loadConfigs, selectProject, selectConfig,
    createProject, renameProject, deleteProject, reorderProjects,
    addConfig, renameConfig, deleteConfig, setFields, reorderConfigs, moveConfig, setConfigEnvironment,
    copyValue,
  };
});
