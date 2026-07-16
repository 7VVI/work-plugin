<template>
  <div class="quick-actions">
    <button class="qa-btn" @click="openDashboard('systems')">
      <i class="fa-solid fa-plus"></i>
      <span>新增</span>
    </button>
    <button class="qa-btn" @click="openDashboard()">
      <i class="fa-solid fa-table-columns"></i>
      <span>面板</span>
    </button>
  </div>
</template>

<script setup lang="ts">
function openDashboard(hash?: string) {
  const url = hash ? `dashboard.html#${hash}` : 'dashboard.html';
  chrome.tabs.create({ url: chrome.runtime.getURL(url) });
  window.close();
}
</script>

<style scoped>
.quick-actions { display: flex; gap: 8px; padding: 0 12px 12px; }
.qa-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 36px; background: var(--primary-50); border: 1px solid var(--primary-100); color: var(--primary-700); border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; }
.qa-btn:hover { background: var(--primary-100); }
</style>
