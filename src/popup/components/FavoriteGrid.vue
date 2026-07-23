<template>
  <div class="section">
    <div class="sys-list">
      <div
        v-for="s in systems"
        :key="s.id"
        class="popup-item"
        @click="onOpen(s)"
        :title="s.url"
      >
        <div
          class="popup-icon"
          :style="{ background: s.iconColor || 'linear-gradient(135deg,#4F7CFF,#3D6DF7)', boxShadow: `0 4px 12px -3px ${iconShadow(s)}` }"
        >
          <i :class="s.icon || 'fa-solid fa-globe'"></i>
        </div>
        <div class="sys-text">
          <div class="sys-name">
            <span class="sys-name-text">{{ s.name }}</span>
            <i v-if="s.favorite" class="fa-solid fa-star star" title="收藏"></i>
          </div>
          <div class="sys-url">{{ s.url }}</div>
        </div>
        <div class="item-tail">
          <EnvBadge :env="s.environment" />
          <button class="row-open" title="打开" @click.stop="onOpen(s)">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </button>
        </div>
      </div>
      <div v-if="systems.length === 0" class="empty">暂无系统，点击右上角“新增”添加</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { systemRepo } from '@shared/db/repositories/systemRepo';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import type { System } from '@shared/types/entities';
import EnvBadge from '../../dashboard/components/common/EnvBadge.vue';

const emit = defineEmits<{ count: [n: number] }>();

const systems = ref<System[]>([]);

onMounted(async () => {
  const all = await systemRepo.all();
  systems.value = all.sort((a, b) => a.sort - b.sort || b.updatedAt - a.updatedAt);
  emit('count', systems.value.length);
});

async function onOpen(s: System) {
  await recentRepo.touch('system', s.id);
  chrome.tabs.create({ url: s.url });
  window.close();
}

/** Extract a solid color from a system's iconColor (or hash the name) for the glow shadow. */
function iconShadow(s: System): string {
  const raw = s.iconColor || s.color;
  if (raw) {
    const m = raw.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    if (m) {
      const hex = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},.45)`;
    }
  }
  // hash fallback → stable palette
  const palette = ['rgba(79,124,255,.4)', 'rgba(52,211,153,.4)', 'rgba(251,191,36,.4)', 'rgba(167,139,250,.4)', 'rgba(244,114,182,.4)'];
  let h = 0;
  for (const ch of s.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
</script>

<style scoped>
.section { padding: 0 var(--gap-md) var(--gap-sm); flex: 1; min-height: 0; display: flex; flex-direction: column; }

.sys-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.popup-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  padding: 9px 12px;
  cursor: pointer;
  transition: background .12s;
  border: 1px solid transparent;
}
.popup-item:hover {
  background: var(--panel2);
}
.popup-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  flex-shrink: 0;
}
.sys-text { flex: 1; min-width: 0; }
.sys-name {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: 1.3;
}
.sys-name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sys-name .star {
  font-size: 10px;
  color: var(--warning);
  flex-shrink: 0;
  filter: drop-shadow(0 0 4px rgba(245, 158, 11, .4));
}
.sys-url {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
  font-family: var(--font-mono);
}
.item-tail {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.row-open {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: var(--transition-fast);
}
.popup-item:hover .row-open { opacity: 1; }
.row-open:hover { background: var(--primary-50); color: var(--accent); }
.row-open i { font-size: 11px; }
.empty {
  padding: 24px var(--gap-md);
  text-align: center;
  font-size: var(--text-xs);
  color: var(--text-quaternary);
}
</style>
