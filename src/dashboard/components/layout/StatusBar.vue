<template>
  <footer class="statusbar">
    <span class="sb-item"><span class="pulse-dot"></span>本地已同步</span>
    <span class="sb-item sb-stats">{{ statsText }}</span>
    <div class="sb-spacer"></div>
    <span class="sb-item">chrome.storage.local</span>
    <span class="sb-item sb-clock t2">{{ clock }}</span>
    <span class="sb-item sb-ver">Dock 1.0.0</span>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { formatClockHHMMSS } from '@shared/utils/clock';
import { useSystemStore } from '@shared/stores/systemStore';
import { useServerStore } from '@shared/stores/serverStore';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useConfigStore } from '@shared/stores/configStore';

const systemStore = useSystemStore();
const serverStore = useServerStore();
const middlewareStore = useMiddlewareStore();
const configStore = useConfigStore();

const clock = ref('--:--:--');
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
