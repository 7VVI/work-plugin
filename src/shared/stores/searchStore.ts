import { defineStore } from 'pinia';
import { ref } from 'vue';
import { searchService, type SearchResult } from '../services/searchService';
import { ENVIRONMENTS } from '../types/enums';

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref<SearchResult[]>([]);
  const loading = ref(false);
  /** 环境筛选（多选），空数组＝不筛选（显示全部） */
  const environments = ref<string[]>([]);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function search(q: string) {
    query.value = q;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!q.trim()) {
      results.value = [];
      return;
    }
    debounceTimer = setTimeout(async () => {
      loading.value = true;
      results.value = await searchService.search(q);
      loading.value = false;
    }, 150);
  }

  function clear() {
    query.value = '';
    results.value = [];
  }

  /** 切换某个环境：选中＝只看它，取消＝回到全部 */
  function toggleEnvironment(env: string): void {
    const current = environments.value;
    environments.value = current.includes(env)
      ? current.filter(item => item !== env)
      : [...current, env];
  }

  function resetEnvironments(): void {
    environments.value = ENVIRONMENTS.map(item => item.value);
  }

  /** 清空关键字与环境筛选 */
  function clearAll(): void {
    clear();
    resetEnvironments();
  }

  return {
    query,
    results,
    loading,
    environments,
    search,
    clear,
    clearAll,
    toggleEnvironment,
    resetEnvironments,
  };
});
