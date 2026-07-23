<template>
  <div class="app-shell">
    <header class="app-header">
      <PageHeader />
      <NavTabs />
    </header>
    <main class="content-area">
      <div class="view-container">
        <router-view />
      </div>
    </main>
    <StatusBar />
    <ToastContainer />
    <DialogHost />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue';
import PageHeader from './components/layout/PageHeader.vue';
import NavTabs from './components/layout/NavTabs.vue';
import ToastContainer from './components/common/ToastContainer.vue';
import DialogHost from './components/common/DialogHost.vue';
import StatusBar from './components/layout/StatusBar.vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';

const prefStore = usePrefStore();
const cryptoStore = useCryptoStore();

function resolveTheme(theme: string): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: string) {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

function onSystemThemeChange() {
  if (prefStore.theme === 'system') applyTheme('system');
}

let mq: MediaQueryList | null = null;

onMounted(async () => {
  await prefStore.load();
  applyTheme(prefStore.theme);
  mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onSystemThemeChange);
  await cryptoStore.checkStatus();
});

onBeforeUnmount(() => {
  mq?.removeEventListener('change', onSystemThemeChange);
});

watch(() => prefStore.theme, (t) => applyTheme(t));
</script>

<style scoped>
.app-shell { height: 100vh; overflow: hidden; display: flex; flex-direction: column; position: relative; z-index: 1; }
.app-header {
  position: sticky; top: 0; z-index: var(--z-sticky);
  border-bottom: 1px solid var(--border);
  background: var(--header-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  flex-shrink: 0;
}
.content-area { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.view-container { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
</style>
