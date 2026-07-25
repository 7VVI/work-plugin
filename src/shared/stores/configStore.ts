import { defineStore } from 'pinia';
import { ref } from 'vue';
import { configService } from '../services/configService';
import type { ConfigProject, ConfigDef } from '../types/entities';

// 精简的配置统计存储：仅用于状态栏 / 导航标签的项目与配置计数展示。
// 三级结构（项目 → 配置 → 字段）的完整编辑逻辑在 configStoreV3 中，
// 由 ConfigView 使用。此处只做只读聚合，避免两套模型冲突。
export const useConfigStore = defineStore('config', () => {
  const list = ref<Array<ConfigProject & { configs: ConfigDef[] }>>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      list.value = await configService.allProjectsWithConfigs();
    } finally {
      loading.value = false;
    }
  }

  return { list, loading, load };
});
