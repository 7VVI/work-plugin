<template>
  <div class="section">
    <div class="section-header"><span>收藏</span></div>
    <div class="fav-grid">
      <div v-for="s in favorites" :key="s.id" class="fav-item" @click="onOpen(s)">
        <div class="fav-icon" :style="{ background: s.iconColor || 'linear-gradient(135deg,#3b82f6,#2563eb)' }">
          <i :class="s.icon || 'fa-solid fa-globe'"></i>
        </div>
        <div class="fav-name">{{ s.name }}</div>
      </div>
      <div v-if="favorites.length === 0" class="empty">暂无收藏</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { systemRepo } from '@shared/db/repositories/systemRepo';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import type { System } from '@shared/types/entities';

const favorites = ref<System[]>([]);

onMounted(async () => {
  const all = await systemRepo.all();
  favorites.value = all.filter(s => s.favorite).slice(0, 8);
});

async function onOpen(s: System) {
  await recentRepo.touch('system', s.id);
  chrome.tabs.create({ url: s.url });
  window.close();
}
</script>

<style scoped>
.section { padding: 0 12px 12px; }
.section-header { font-size: 11px; font-weight: 600; color: var(--text-secondary); padding: 8px 0 4px; text-transform: uppercase; }
.fav-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.fav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; cursor: pointer; }
.fav-item:hover { background: var(--border-soft); }
.fav-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; }
.fav-name { font-size: 10px; color: var(--text-primary); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.empty { grid-column: 1 / -1; padding: 12px; text-align: center; font-size: 11px; color: var(--text-tertiary); }
</style>
