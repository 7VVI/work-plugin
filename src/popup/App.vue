<template>
  <div class="popup-root">
    <SearchBox />
    <RecentList />
    <FavoriteGrid />
    <QuickAdd />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';
import SearchBox from './components/SearchBox.vue';
import RecentList from './components/RecentList.vue';
import FavoriteGrid from './components/FavoriteGrid.vue';
import QuickAdd from './components/QuickAdd.vue';

const prefStore = usePrefStore();
const cryptoStore = useCryptoStore();

onMounted(async () => {
  await prefStore.load();
  await cryptoStore.checkStatus();
});
</script>

<style scoped>
.popup-root { width: 360px; height: 480px; overflow-y: auto; background: var(--bg); }
.popup-root::-webkit-scrollbar { width: 6px; }
.popup-root::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
</style>
