<template>
  <div class="middleware-view">
    <div class="action-bar">
      <div class="action-left">
        <button class="btn btn-dark" @click="onCreate"><i class="fa-solid fa-plus"></i> 新增中间件</button>
      </div>
      <div class="action-right">
        <div class="search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input v-model="search" class="search-input" placeholder="搜索名称、Host..." />
        </div>
      </div>
    </div>

    <div class="mw-grid">
      <div v-for="m in filtered" :key="m.id" class="mw-card stat-card">
        <div class="card-head">
          <span class="chip type-chip">{{ typeLabel(m.type) }}</span>
          <div class="head-actions">
            <button class="row-action edit" @click="onEdit(m)" title="编辑"><i class="fa-solid fa-pen"></i></button>
            <button class="row-action danger" @click="onDelete(m.id)" title="删除"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>

        <div class="card-identity">
          <div
            class="mw-icon"
            :style="{ background: mwMeta(m.type).color, boxShadow: '0 5px 14px -4px ' + mwMeta(m.type).color }"
          >
            <i :class="mwMeta(m.type).icon"></i>
          </div>
          <div class="identity-text">
            <div class="mw-name">{{ m.name }}</div>
            <div class="mw-addr mono t3">{{ m.host }}:{{ m.port }}</div>
          </div>
        </div>

        <div class="tag-row">
          <EnvBadge :env="mwEnv(m)" size="sm" />
          <span v-if="m.version" class="chip">v{{ m.version }}</span>
          <span v-if="m.database" class="chip">{{ m.database }}</span>
        </div>

        <dl class="detail">
          <div class="detail-row">
            <dt><i class="fa-solid fa-user"></i><span>账号</span></dt>
            <dd>{{ m.username || '—' }}</dd>
          </div>
          <div class="detail-row">
            <dt><i class="fa-regular fa-clock"></i><span>最后更新</span></dt>
            <dd>{{ formatRelativeTime(m.updatedAt) }}</dd>
          </div>
        </dl>

        <div class="card-actions">
          <button
            class="btn btn-default copy-btn"
            :class="{ copied: copiedFlags[m.id] === 'addr' }"
            @click="onCopyAddr(m)"
          >
            <i :class="copiedFlags[m.id] === 'addr' ? 'fa-solid fa-check' : 'fa-solid fa-link'"></i>
            <span>{{ copiedFlags[m.id] === 'addr' ? '已复制' : '复制连接地址' }}</span>
          </button>
        </div>
      </div>

      <button v-if="filtered.length > 0" class="add-card" @click="onCreate">
        <i class="fa-solid fa-plus"></i>
        <span>添加中间件</span>
        <span class="hint">Redis · MySQL · MongoDB · ES</span>
      </button>

      <div v-if="filtered.length === 0" class="empty-state">
        <i class="fa-solid fa-layer-group"></i>
        <p>暂无中间件，点击“新增中间件”添加</p>
      </div>
    </div>

    <MiddlewareForm :visible="formVisible" :middleware="editing" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { getMiddlewareMeta, type MiddlewareType } from '@shared/types/enums';
import type { Middleware, Environment } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import MiddlewareForm from '../components/middleware/MiddlewareForm.vue';
import EnvBadge from '../components/common/EnvBadge.vue';

// v3 per-type colored icon tiles. Keys match MiddlewareType values (lowercase).
// Colors per task brief; types not listed fall back to the accent-blue cube.
const MW_TYPES: Record<string, { icon: string; color: string }> = {
  redis: { icon: 'fa-solid fa-bolt', color: '#DC382D' },
  mysql: { icon: 'fa-solid fa-database', color: '#00758F' },
  postgresql: { icon: 'fa-solid fa-database', color: '#336791' },
  mongodb: { icon: 'fa-solid fa-leaf', color: '#47A248' },
  elasticsearch: { icon: 'fa-solid fa-magnifying-glass', color: '#B7791F' },
  rabbitmq: { icon: 'fa-solid fa-message', color: '#FF6600' },
  kafka: { icon: 'fa-solid fa-stream', color: '#4B5563' },
  nginx: { icon: 'fa-solid fa-server', color: '#009639' },
  minio: { icon: 'fa-solid fa-cube', color: '#C72E49' },
};
function mwMeta(type: string) {
  return MW_TYPES[type] || { icon: 'fa-solid fa-cube', color: '#2E6BF0' };
}
function typeLabel(type: string) {
  return getMiddlewareMeta(type as MiddlewareType).label;
}
function mwEnv(m: Middleware): Environment {
  const env = (m.extra as Record<string, unknown> | undefined)?.environment;
  return (env as Environment) || 'development';
}

const store = useMiddlewareStore();
const toast = useToastStore();
const dialog = useDialogStore();
const formVisible = ref(false);
const editing = ref<Middleware | null>(null);
const search = ref('');
const copiedFlags = reactive<Record<string, 'addr'>>({});

onMounted(async () => { await store.load(); });

const filtered = computed(() => {
  if (!search.value.trim()) return store.list;
  const q = search.value.toLowerCase();
  return store.list.filter(m => m.name.toLowerCase().includes(q) || m.host.toLowerCase().includes(q));
});

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(m: Middleware) { editing.value = m; formVisible.value = true; }
async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该中间件？');
  if (!ok) return;
  await store.remove(id);
  toast.success('已删除');
}
async function onSaved() { formVisible.value = false; await store.load(); }

async function onCopyAddr(m: Middleware) {
  try {
    await store.copyConnectionString(m.id);
    toast.success('连接地址已复制');
    copiedFlags[m.id] = 'addr';
    setTimeout(() => { if (copiedFlags[m.id] === 'addr') delete copiedFlags[m.id]; }, 1200);
  } catch {
    toast.error('复制失败');
  }
}
</script>

<style scoped>
.middleware-view { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-lg) var(--page-pad);
  gap: var(--gap-lg);
  flex-shrink: 0;
}
.action-left, .action-right { display: flex; align-items: center; gap: var(--gap-md); }
.action-right .search-wrap { width: 320px; }

.mw-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--gap-lg);
  padding: 0 var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  position: relative;
}
@media (min-width: 640px) { .mw-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1280px) { .mw-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1536px) { .mw-grid { grid-template-columns: repeat(4, 1fr); } }

.mw-card {
  padding: var(--gap-lg);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 22px;
  gap: var(--gap-sm);
}
.type-chip {
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-size: 10px;
}
.head-actions { display: flex; align-items: center; gap: var(--gap-xs); }
.card-head .row-action {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: 11px;
}
.card-head .row-action.edit:hover { background: var(--primary-50); color: var(--accent); }
.card-head .row-action.danger:hover { background: rgba(220, 38, 38, .08); color: var(--danger); }

.card-identity {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
}
.mw-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--text-base);
  flex-shrink: 0;
}
.identity-text { min-width: 0; flex: 1; }
.mw-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--ink);
  line-height: var(--leading-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mw-addr {
  font-size: var(--text-xs);
  margin-top: 4px;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  flex-wrap: wrap;
}

.detail {
  margin: 0;
  padding: var(--gap-md) 0;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}
.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
}
.detail-row dt {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  color: var(--ink3);
  font-weight: normal;
}
.detail-row dt i {
  font-size: 11px;
  color: var(--ink3);
  width: 14px;
  text-align: center;
}
.detail-row dd {
  margin: 0;
  color: var(--ink);
  font-weight: var(--font-medium);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}
.copy-btn {
  flex: 1;
  height: 34px;
  padding: 0 var(--gap-sm);
  font-size: var(--text-sm);
}
.copy-btn.copied {
  border-color: var(--ok);
  color: var(--ok);
  background: var(--panel2);
}

/* 末位虚线添加卡（复用 Task 11 .add-card 模式） */
.add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 220px;
  width: 100%;
  border-radius: var(--radius-xl);
  border: 2px dashed var(--border-strong);
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  transition: var(--transition-fast);
  font-family: inherit;
  padding: var(--gap-xl);
}
.add-card i { font-size: 20px; }
.add-card > span:not(.hint) { font-size: var(--text-sm); font-weight: var(--font-medium); }
.add-card:hover { border-color: var(--accent); color: var(--accent); }
.add-card .hint { font-size: 11px; }

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}
.empty-state i {
  font-size: 36px;
  margin-bottom: var(--gap-md);
  color: var(--text-quaternary);
}
.empty-state p { font-size: var(--text-sm); margin: 0; }
</style>
