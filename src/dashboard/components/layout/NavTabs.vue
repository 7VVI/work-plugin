<template>
  <div class="tabs-row">
    <nav ref="navEl" class="tabs-bar">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab"
        :class="{ active: isActive(tab.path) }"
        :data-path="tab.path"
        @click="onTabClick(tab.path)"
      >
        <i :class="tab.icon"></i>
        <span>{{ tab.label }}</span>
      </router-link>
      <span ref="inkEl" class="tab-ink"></span>
    </nav>
    <div class="tabs-meta">
      <span class="sub t3">{{ currentSub }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { subtitleFor, type DockStats } from '../../utils/dockPath';
import { useSystemStore } from '@shared/stores/systemStore';
import { useServerStore } from '@shared/stores/serverStore';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useConfigStore } from '@shared/stores/configStore';

const route = useRoute();
const tabs = [
  { path: '/systems', label: '系统', icon: 'fa-solid fa-layer-group' },
  { path: '/servers', label: '服务器', icon: 'fa-solid fa-server' },
  { path: '/middlewares', label: '中间件', icon: 'fa-solid fa-cubes' },
  { path: '/configs', label: '配置', icon: 'fa-solid fa-sliders' },
  { path: '/import-export', label: '导入 / 导出', icon: 'fa-solid fa-arrow-right-arrow-left' },
  { path: '/settings', label: '设置', icon: 'fa-solid fa-gear' },
];

const navEl = ref<HTMLElement | null>(null);
const inkEl = ref<HTMLElement | null>(null);

function isActive(path: string): boolean { return route.path === path; }

const systemStore = useSystemStore();
const serverStore = useServerStore();
const middlewareStore = useMiddlewareStore();
const configStore = useConfigStore();

const stats = computed<DockStats>(() => {
  const projects = configStore.list ?? [];
  const configs = projects.reduce((a, p) => a + p.configs.length, 0);
  const fields = projects.reduce((a, p) => a + p.configs.reduce((b, c) => b + c.fields.length, 0), 0);
  return {
    systems: systemStore.list?.length ?? 0,
    servers: serverStore.list?.length ?? 0,
    middlewares: middlewareStore.list?.length ?? 0,
    projects: projects.length,
    configs,
    fields,
  };
});

const currentSub = computed(() => subtitleFor(route.path, stats.value));

function moveInk() {
  if (!navEl.value || !inkEl.value) return;
  const active = navEl.value.querySelector<HTMLElement>('.tab.active');
  if (!active) return;
  inkEl.value.style.left = `${active.offsetLeft + 12}px`;
  inkEl.value.style.width = `${Math.max(active.offsetWidth - 24, 0)}px`;
}

function onTabClick(path: string) {
  try { localStorage.setItem('dock-v3-tab', path); } catch { /* ignore */ }
  nextTick(moveInk);
}

watch(() => route.path, () => nextTick(moveInk));

let ro: ResizeObserver | undefined;
onMounted(() => {
  nextTick(moveInk);
  if (navEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => moveInk());
    ro.observe(navEl.value);
  }
  window.addEventListener('resize', moveInk);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', moveInk);
  ro?.disconnect();
});
</script>

<style scoped>
.tabs-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 var(--page-pad);
}
.tabs-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0;
}
.tabs-bar::-webkit-scrollbar { display: none; }

.tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 14px;
  font-size: var(--text-sm); font-weight: var(--font-medium);
  color: var(--ink3); cursor: pointer;
  transition: color .18s; text-decoration: none; white-space: nowrap;
}
.tab:hover { color: var(--ink); }
.tab.active { color: var(--accent); }
.tab i { font-size: var(--text-xs); }

.tab-ink {
  position: absolute; bottom: -1px;
  height: 2px; border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 12px var(--glow), 0 0 4px var(--glow);
  transition: left .32s cubic-bezier(.3,1.1,.4,1), width .32s cubic-bezier(.3,1.1,.4,1);
  pointer-events: none;
}

.tabs-meta {
  display: none;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
  font-size: 10.5px;
}
.tabs-meta .sub { font-family: var(--font-mono); }
@media (min-width: 1024px) { .tabs-meta { display: inline-flex; } }
</style>
