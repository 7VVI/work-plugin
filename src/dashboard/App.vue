<template>
  <div class="app-shell">
    <PageHeader />
    <div class="body-grid">
      <Sidebar />
      <main class="content-area">
        <NavTabs />
        <router-view />
      </main>
    </div>
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import PageHeader from './components/layout/PageHeader.vue';
import Sidebar from './components/layout/Sidebar.vue';
import NavTabs from './components/layout/NavTabs.vue';
import ToastContainer from './components/common/ToastContainer.vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';

const prefStore = usePrefStore();
const cryptoStore = useCryptoStore();

onMounted(async () => {
  await prefStore.load();
  await cryptoStore.checkStatus();
});
</script>

<style scoped>
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.body-grid { flex: 1; display: flex; min-height: 0; }
.content-area { flex: 1; min-width: 0; display: flex; flex-direction: column; }
</style>
