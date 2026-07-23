<template>
  <div class="section">
    <div ref="listRef" class="sys-list">
      <template v-if="flatList.length">
        <div v-if="starred.length" class="group-label">常用</div>
        <div
          v-for="s in starred"
          :key="s.id"
          class="popup-item"
          :class="{ active: activeId === s.id }"
          @click="onOpen(s)"
          @mouseenter="activeId = s.id"
          :title="s.url"
        >
          <div class="popup-icon" :style="{ background: iconBg(s), boxShadow: `0 4px 12px -3px ${iconShadow(s)}` }">
            <i :class="s.icon || 'fa-solid fa-globe'"></i>
          </div>
          <div class="sys-text">
            <div class="sys-name">
              <span class="sys-name-text">{{ s.name }}</span>
              <i class="fa-solid fa-star star" title="收藏"></i>
            </div>
            <div class="sys-url">{{ s.url }}</div>
          </div>
          <div class="item-tail">
            <EnvBadge :env="s.environment" />
            <div class="item-actions">
              <button class="row-act" title="复制账号" @click.stop="onCopyAccount(s)"><i class="fa-regular fa-copy"></i></button>
              <button class="row-act" title="打开" @click.stop="onOpen(s)"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
            </div>
          </div>
        </div>

        <div v-if="rest.length" class="group-label">全部系统</div>
        <div
          v-for="s in rest"
          :key="s.id"
          class="popup-item"
          :class="{ active: activeId === s.id }"
          @click="onOpen(s)"
          @mouseenter="activeId = s.id"
          :title="s.url"
        >
          <div class="popup-icon" :style="{ background: iconBg(s), boxShadow: `0 4px 12px -3px ${iconShadow(s)}` }">
            <i :class="s.icon || 'fa-solid fa-globe'"></i>
          </div>
          <div class="sys-text">
            <div class="sys-name">
              <span class="sys-name-text">{{ s.name }}</span>
            </div>
            <div class="sys-url">{{ s.url }}</div>
          </div>
          <div class="item-tail">
            <EnvBadge :env="s.environment" />
            <div class="item-actions">
              <button class="row-act" title="复制账号" @click.stop="onCopyAccount(s)"><i class="fa-regular fa-copy"></i></button>
              <button class="row-act" title="打开" @click.stop="onOpen(s)"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="empty">
        <i class="fa-regular fa-folder-open"></i>
        <div class="empty-text">{{ hasQuery ? '未找到匹配的系统' : '暂无系统，点击右上角“新增”添加' }}</div>
        <button v-if="hasQuery" class="clear-btn" @click="clearQuery">清除搜索</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { systemRepo } from '@shared/db/repositories/systemRepo';
import { accountRepo } from '@shared/db/repositories/accountRepo';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import { useSearchStore } from '@shared/stores/searchStore';
import { storeToRefs } from 'pinia';
import { useToastStore } from '@shared/stores/toastStore';
import { copyToClipboard } from '@shared/utils/clipboard';
import type { System } from '@shared/types/entities';
import EnvBadge from '../../dashboard/components/common/EnvBadge.vue';

const emit = defineEmits<{ count: [n: number] }>();
const searchStore = useSearchStore();
const toast = useToastStore();
const { query } = storeToRefs(searchStore);

const systems = ref<System[]>([]);
const activeId = ref<string | null>(null);
const listRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  const all = await systemRepo.all();
  systems.value = all.sort((a, b) => a.sort - b.sort || b.updatedAt - a.updatedAt);
  if (systems.value.length) activeId.value = systems.value[0].id;
  emit('count', systems.value.length);
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});

const hasQuery = computed(() => query.value.trim().length > 0);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return systems.value;
  return systems.value.filter(s => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
});
const starred = computed(() => filtered.value.filter(s => s.favorite));
const rest = computed(() => filtered.value.filter(s => !s.favorite));
const flatList = computed(() => [...starred.value, ...rest.value]);

watch(flatList, (list) => {
  if (!list.some(s => s.id === activeId.value)) {
    activeId.value = list[0]?.id ?? null;
  }
});

async function onOpen(s: System) {
  await recentRepo.touch('system', s.id);
  chrome.tabs.create({ url: s.url });
  window.close();
}

async function onCopyAccount(s: System) {
  const accounts = await accountRepo.bySystemId(s.id);
  const acc = accounts.find(a => a.isDefault) ?? accounts[0];
  if (acc?.username) {
    copyToClipboard(acc.username);
    toast.success(`账号「${acc.username}」已复制`);
  } else {
    toast.info('该系统暂无账号');
  }
}

function clearQuery() {
  searchStore.clear();
}

function onKeydown(e: KeyboardEvent) {
  const list = flatList.value;
  if (!list.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const i = list.findIndex(s => s.id === activeId.value);
    activeId.value = list[Math.min(i + 1, list.length - 1)].id;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const i = list.findIndex(s => s.id === activeId.value);
    activeId.value = list[Math.max(i - 1, 0)].id;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const cur = list.find(s => s.id === activeId.value);
    if (cur) onOpen(cur);
  } else if (e.key === 'Escape') {
    searchStore.clear();
  }
}

function iconBg(s: System): string {
  return s.iconColor || s.color || 'linear-gradient(135deg, var(--accent), var(--accent2))';
}
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
  const palette = ['rgba(46,107,240,.4)', 'rgba(8,145,178,.4)', 'rgba(5,150,105,.4)', 'rgba(180,83,9,.4)', 'rgba(124,58,237,.4)'];
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
.group-label {
  padding: var(--gap-sm) var(--gap-sm) 2px;
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.18em;
  color: var(--text-tertiary);
}
.popup-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  padding: 9px 12px;
  cursor: pointer;
  transition: background .12s, border-color .12s, box-shadow .12s;
  border: 1px solid transparent;
}
.popup-item:hover { background: var(--panel2); }
.popup-item.active {
  background: var(--primary-50);
  border-color: rgba(46, 107, 240, .3);
  box-shadow: 0 2px 12px -4px var(--glow);
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
  gap: var(--gap-sm);
  flex-shrink: 0;
}
.item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: var(--transition-fast);
}
.popup-item:hover .item-actions,
.popup-item.active .item-actions { opacity: 1; }
.row-act {
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
  transition: var(--transition-fast);
}
.row-act:hover { background: var(--bg-pure); color: var(--accent); }
.row-act i { font-size: 11px; }

.empty {
  padding: 40px var(--gap-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-sm);
  color: var(--text-quaternary);
}
.empty i { font-size: 26px; }
.empty-text { font-size: var(--text-xs); }
.clear-btn {
  margin-top: var(--gap-xs);
  background: none;
  border: none;
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
}
.clear-btn:hover { filter: brightness(1.1); }
</style>
