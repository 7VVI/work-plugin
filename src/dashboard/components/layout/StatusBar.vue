<template>
  <footer class="statusbar">
    <span class="sb-item cloud-status" :class="cloudStateClass" @click="openCloudSettings">
      <span class="pulse-dot"></span>{{ cloudStatusText }}
    </span>
    <span class="sb-item sb-stats">{{ statsText }}</span>
    <div class="sb-spacer"></div>
    <span class="sb-item">{{ storageLabel }}</span>
    <span class="sb-item sb-clock t2">{{ clock }}</span>
    <span class="sb-item sb-ver">Dock 1.0.0</span>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { formatClockHHMMSS } from '@shared/utils/clock';
import { isWeb } from '@shared/platform';
import { useSystemStore } from '@shared/stores/systemStore';
import { useServerStore } from '@shared/stores/serverStore';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useConfigStore } from '@shared/stores/configStore';
import { useCloudSyncStore } from '@shared/stores/cloudSyncStore';

const router = useRouter();
const systemStore = useSystemStore();
const serverStore = useServerStore();
const middlewareStore = useMiddlewareStore();
const configStore = useConfigStore();
const cloudStore = useCloudSyncStore();

const clock = ref('--:--:--');
const storageLabel = isWeb ? '云端数据' : 'chrome.storage.local';
let timer: number | undefined;

function tick() {
  clock.value = formatClockHHMMSS(new Date());
}

const statsText = computed(() => {
  const s = systemStore.list?.length ?? 0;
  const sv = serverStore.list?.length ?? 0;
  const mw = middlewareStore.list?.length ?? 0;
  const pj = configStore.list?.length ?? 0;
  return `系统 ${s} · 服务器 ${sv} · 中间件 ${mw} · 项目 ${pj}`;
});

const cloudStatusText = computed(() => {
  switch (cloudStore.status.state) {
    case 'healthy': return '云端已同步';
    case 'syncing': return '同步中';
    case 'waiting-unlock': return '等待解锁';
    case 'waiting-cloud': return '等待云端';
    case 'unhealthy':
    case 'error': return '云端异常';
    case 'auth-error': return 'Token 无效';
    case 'unknown': return '云端未检测';
    default: return isWeb ? '云端数据' : '本地模式';
  }
});

const cloudStateClass = computed(() => `is-${cloudStore.status.state}`);

function openCloudSettings() {
  void router.push('/settings');
}

onMounted(() => {
  tick();
  timer = window.setInterval(tick, 1000);
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<style scoped>
.statusbar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: var(--statusbar-h);
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 24px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink3);
}
.sb-item { display: inline-flex; align-items: center; gap: 6px; }
.cloud-status { cursor: pointer; }
.cloud-status:hover { color: var(--ink); }
.cloud-status.is-unhealthy .pulse-dot,
.cloud-status.is-error .pulse-dot,
.cloud-status.is-auth-error .pulse-dot {
  background: var(--danger);
  box-shadow: 0 0 8px var(--danger);
}
.cloud-status.is-waiting-unlock .pulse-dot { background: var(--warning); box-shadow: 0 0 8px var(--warning); }
.cloud-status.is-syncing .pulse-dot { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.cloud-status.is-disabled .pulse-dot { background: var(--ink3); box-shadow: none; animation: none; }
.sb-stats { color: var(--ink3); }
.sb-spacer { flex: 1; }
.sb-clock { color: var(--ink2); }
.sb-ver { color: var(--accent); }
.pulse-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ok); box-shadow: 0 0 8px var(--ok);
  animation: pulse 2.4s infinite;
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
</style>
