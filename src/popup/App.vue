<template>
  <div class="popup-root">
    <div class="top-header">
      <div class="header-left">
        <span class="brand-logo">D</span>
        <span class="header-title">全部系统</span>
        <span class="header-count">{{ systemCount }}</span>
      </div>
      <div class="header-right">
        <button class="hdr-btn primary" @click="showAddForm = true">
          <i class="fa-solid fa-plus"></i> 新增
        </button>
        <button class="hdr-btn" @click="openDashboard">
          <i class="fa-solid fa-table-columns"></i> 面板
        </button>
      </div>
    </div>
    <SearchBox />
    <FavoriteGrid :key="`sys-${refreshKey}`" @count="systemCount = $event" />
    <QuickAdd v-if="showAddForm" @saved="onSaved" @close="showAddForm = false" />
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
const showAddForm = ref(false);
const systemCount = ref(0);

onMounted(async () => {
  await prefStore.load();
  document.documentElement.dataset.theme = prefStore.theme;
  await cryptoStore.checkStatus();
});

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
}

function onSaved() {
  refreshKey.value++;
  showAddForm.value = false;
}
</script>

<style scoped>
.popup-root {
  position: relative;
  width: 378px;
  height: 560px;
  overflow: hidden;
  background: rgba(255, 255, 255, .96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  animation: popOpen .34s cubic-bezier(.25, 1.35, .45, 1) both;
  transform-origin: top right;
}
@keyframes popOpen {
  from { opacity: 0; transform: translateY(-10px) scale(.9); }
}
[data-theme="dark"] .popup-root {
  background: rgba(12, 19, 34, .9);
}
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-md) var(--gap-md) var(--gap-sm);
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-logo {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: linear-gradient(135deg, var(--accent), #1D4ED8);
  color: #fff;
  font-weight: var(--font-bold);
  font-size: 12px;
  box-shadow: 0 4px 12px -4px var(--glow);
  flex-shrink: 0;
}
.header-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
.header-count {
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--surface-secondary);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  font-weight: var(--font-medium);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.hdr-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: var(--font-medium);
  cursor: pointer;
  font-family: inherit;
  transition: var(--transition-fast);
  border: 1px solid var(--border-strong);
  background: var(--bg-pure);
  color: var(--text-secondary);
}
.hdr-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--text-quaternary);
}
.hdr-btn.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  box-shadow: 0 3px 10px -3px var(--glow), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.hdr-btn.primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  filter: brightness(1.07);
  box-shadow: 0 6px 18px -4px var(--glow), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.hdr-btn i { font-size: 10px; }
</style>
