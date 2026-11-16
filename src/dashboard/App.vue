<template>
  <div class="app-shell">
    <template v-if="!isFullscreen">
      <header class="app-header">
        <PageHeader />
        <NavTabs />
      </header>
    </template>
    <main class="content-area">
      <div class="view-container">
        <router-view />
      </div>
    </main>
    <StatusBar v-if="!isFullscreen" />
    <ToastContainer />
    <DialogHost />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import PageHeader from './components/layout/PageHeader.vue';
import NavTabs from './components/layout/NavTabs.vue';
import ToastContainer from './components/common/ToastContainer.vue';
import DialogHost from './components/common/DialogHost.vue';
import StatusBar from './components/layout/StatusBar.vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';
import { useConfigStore } from '@shared/stores/configStore';
import { useCloudSyncStore } from '@shared/stores/cloudSyncStore';
import { cryptoSession } from '@shared/crypto/session';
import { startSyncScheduler } from '@shared/sync/syncScheduler';
import { applyTheme } from '@shared/utils/themeTransition';

const prefStore = usePrefStore();
const cryptoStore = useCryptoStore();
const configStore = useConfigStore();
const cloudStore = useCloudSyncStore();
const route = useRoute();
let stopSyncScheduler: (() => void) | null = null;

/** 全屏页（如数据库工作台）不显示导航外壳 */
const isFullscreen = computed(() => route.meta.fullscreen === true);

function onSystemThemeChange() {
  if (prefStore.theme === 'system') applyTheme('system');
}

let mq: MediaQueryList | null = null;

onMounted(async () => {
  await prefStore.load();
  cryptoSession.setAutoLockMinutes(prefStore.autoLockMinutes);
  applyTheme(prefStore.theme);
  mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onSystemThemeChange);
  await cryptoStore.checkStatus();
  await configStore.load();
  await cloudStore.load();
  stopSyncScheduler = startSyncScheduler();
});

watch(() => prefStore.autoLockMinutes, (minutes) => {
  cryptoSession.setAutoLockMinutes(minutes);
});

onBeforeUnmount(() => {
  mq?.removeEventListener('change', onSystemThemeChange);
  stopSyncScheduler?.();
  stopSyncScheduler = null;
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
