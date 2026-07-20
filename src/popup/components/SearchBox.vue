<template>
  <div class="search-box">
    <i class="fa-solid fa-magnifying-glass search-icon"></i>
    <input
      ref="inputRef"
      v-model="query"
      type="text"
      placeholder="搜索系统/URL/标签/账号..."
      @input="onInput"
      @keyup.enter="onEnter"
      @keydown.down.prevent="onArrowDown"
      @keydown.up.prevent="onArrowUp"
    />
    <span class="shortcut">{{ shortcutKey }}</span>
  </div>
  <div v-if="results.length > 0" class="results">
    <div
      v-for="(r, i) in results"
      :key="r.id"
      class="result-item"
      :class="{ active: i === activeIndex }"
      @click="onSelect(r)"
      @mouseenter="activeIndex = i"
    >
      <div class="result-icon" :style="{ background: getColor(r.type) }">
        <i :class="getIcon(r.type)"></i>
      </div>
      <div class="result-text">
        <div class="result-title">{{ r.title }}</div>
        <div class="result-subtitle">{{ r.subtitle }}</div>
      </div>
      <div class="result-type">{{ typeLabel(r.type) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useSearchStore } from '@shared/stores/searchStore';
import { storeToRefs } from 'pinia';
import { systemService } from '@shared/services/systemService';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import type { SearchResult } from '@shared/services/searchService';

const searchStore = useSearchStore();
const { results } = storeToRefs(searchStore);

const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const activeIndex = ref(0);
const shortcutKey = navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K';

onMounted(() => {
  inputRef.value?.focus();
});

watch(results, () => { activeIndex.value = 0; });

function onInput() {
  searchStore.search(query.value);
}

async function onEnter() {
  if (results.value.length > 0) {
    await onSelect(results.value[activeIndex.value]);
  }
}

function onArrowDown() {
  if (activeIndex.value < results.value.length - 1) activeIndex.value++;
}

function onArrowUp() {
  if (activeIndex.value > 0) activeIndex.value--;
}

async function onSelect(r: SearchResult) {
  if (r.type === 'system') {
    const system = await systemService.byId(r.id);
    if (system) {
      await recentRepo.touch('system', system.id);
      chrome.tabs.create({ url: system.url });
      window.close();
    }
  }
}

function getColor(type: string) {
  const colors: Record<string, string> = {
    system: 'linear-gradient(135deg,#4F7CFF,#3D6DF7)',
    server: 'linear-gradient(135deg,#34D399,#10B981)',
    middleware: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
  };
  return colors[type] || colors.system;
}

function getIcon(type: string) {
  const icons: Record<string, string> = {
    system: 'fa-solid fa-briefcase',
    server: 'fa-solid fa-server',
    middleware: 'fa-solid fa-cubes',
  };
  return icons[type] || icons.system;
}

function typeLabel(type: string) {
  const labels: Record<string, string> = { system: '系统', server: '服务器', middleware: '中间件' };
  return labels[type] || type;
}
</script>

<style scoped>
.search-box {
  position: relative;
  padding: var(--gap-md);
}
.search-icon {
  position: absolute;
  left: 26px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-quaternary);
  font-size: var(--text-sm);
  pointer-events: none;
}
.search-box input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 0 56px 0 40px;
  font-size: var(--text-sm);
  outline: none;
  font-family: inherit;
  background: var(--bg-pure);
  color: var(--text-primary);
  transition: var(--transition-fast);
}
.search-box input::placeholder { color: var(--text-quaternary); }
.search-box input:hover { border-color: var(--text-quaternary); }
.search-box input:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}
.search-box:focus-within .search-icon { color: var(--primary); }

.shortcut {
  position: absolute;
  right: 26px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  color: var(--text-tertiary);
  border: 1px solid var(--border);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-secondary);
  font-weight: var(--font-medium);
  letter-spacing: 0.5px;
}

.results {
  max-height: 320px;
  overflow-y: auto;
  padding: 0 var(--gap-sm);
}
.result-item {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding: var(--gap-sm) var(--gap-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}
.result-item:hover, .result-item.active {
  background: var(--primary-50);
}
.result-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  flex-shrink: 0;
}
.result-text { flex: 1; min-width: 0; }
.result-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.result-subtitle {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.result-type {
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--surface-secondary);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-weight: var(--font-medium);
}
</style>
