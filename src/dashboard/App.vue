<template>
  <div class="app-shell">
    <PageHeader />
    <main class="content-area">
      <NavTabs />
      <div class="view-container">
        <router-view />
      </div>
    </main>
    <ToastContainer />
    <DialogHost />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import PageHeader from './components/layout/PageHeader.vue';
import NavTabs from './components/layout/NavTabs.vue';
import ToastContainer from './components/common/ToastContainer.vue';
import DialogHost from './components/common/DialogHost.vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';

const prefStore = usePrefStore();
const cryptoStore = useCryptoStore();

function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
}

onMounted(async () => {
  await prefStore.load();
  applyTheme(prefStore.theme);
  await cryptoStore.checkStatus();
});

watch(() => prefStore.theme, (t) => applyTheme(t));
</script>

<style scoped>
.app-shell { height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
.content-area { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.view-container { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
</style>
