import { defineStore } from 'pinia';
import { ref } from 'vue';
import { searchService, type SearchResult } from '../services/searchService';

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref<SearchResult[]>([]);
  const loading = ref(false);
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

  return { query, results, loading, search, clear };
});
