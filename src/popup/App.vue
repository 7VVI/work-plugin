<template>
  <div class="popup-root">
    <SearchBox />
    <FavoriteGrid :key="`sys-${refreshKey}`" />
    <QuickAdd @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';
import SearchBox from './components/SearchBox.vue';
import FavoriteGrid from './components/FavoriteGrid.vue';
import QuickAdd from './components/QuickAdd.vue';

const prefStore = usePrefStore();
const cryptoStore = useCryptoStore();
const refreshKey = ref(0);

onMounted(async () => {
  await prefStore.load();
  await cryptoStore.checkStatus();
});

function onSaved() {
  refreshKey.value++;
}
</script>

<style scoped>
.popup-root {
  width: 360px;
  height: 600px;
  overflow-y: auto;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}
</style>
