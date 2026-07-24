<template>
  <div class="middleware-view">
    <GroupSidebar entity-type="middleware" label="中间件" :records="store.list" v-model="selectedGroupId" />
    <div class="mw-content">
      <!-- 操作栏 - v3 风格 -->
      <div class="action-bar">
        <button class="btn-p" @click="onCreate">
          <i class="fa-solid fa-plus"></i>新增中间件
        </button>
        <div class="flex-spacer"></div>
        <div class="search-field">
          <i class="fa-solid fa-magnifying-glass search-ico t3"></i>
          <input v-model="search" class="inp search-inp" placeholder="搜索中间件名称、Host…" />
        </div>
      </div>

      <!-- 中间件网格 - v3 风格 -->
      <VueDraggable
        v-model="filtered"
        class="mw-grid"
        :animation="200"
        ghost-class="dragging"
        @end="onDragEnd"
      >
        <div v-for="m in filtered" :key="m.id" class="panel stat-card mw-card" @click="onEdit(m)">
          <!-- 图标 + 环境 -->
          <div class="card-top">
            <span class="card-icon" :style="iconStyle(m)">
              <i :class="mwMeta(m.type).icon"></i>
            </span>
            <div class="card-top-right">
              <EnvBadge :env="mwEnv(m)" />
              <div class="card-actions">
                <button class="ibtn ibtn-sm" title="编辑 / 查看详情" @click.stop="onEdit(m)">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="ibtn ibtn-sm danger" title="删除" @click.stop="onDelete(m.id)">
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- 名称 + 类型 -->
          <div class="card-title-row">
            <span class="card-name t1">{{ m.name }}</span>
            <span class="type-badge t2">{{ m.type }}{{ m.version ? ' ' + m.version : '' }}</span>
          </div>

          <!-- 地址 -->
          <div class="card-addr t3">{{ m.host }}:{{ m.port }}{{ m.database ? ' / ' + m.database : '' }}</div>

          <!-- 详情 -->
          <dl class="card-dl">
            <div class="dl-row">
              <dt class="t3"><i class="fa-regular fa-user"></i>账号</dt>
              <dd class="mono t2">{{ m.username || '—' }}</dd>
            </div>
            <div class="dl-row">
              <dt class="t3"><i class="fa-regular fa-clock"></i>最后更新</dt>
              <dd class="t2">{{ formatRelativeTime(m.updatedAt) }}</dd>
            </div>
          </dl>

          <!-- 复制按钮 -->
          <button class="btn-g card-btn-full" @click.stop="onCopyDetails(m)">
            <i class="fa-regular fa-copy"></i>复制连接信息
          </button>
        </div>

        <button v-if="filtered.length > 0" class="add-tile" @click="onCreate">
          <i class="fa-solid fa-plus add-tile-icon"></i>
          <span class="add-tile-title">添加中间件</span>
          <span class="add-tile-sub mono">Redis · MySQL · MongoDB · ES</span>
        </button>

        <div v-if="filtered.length === 0" class="empty-state">
          <i class="fa-solid fa-layer-group empty-icon t3"></i>
          <div class="empty-text t3">暂无中间件，点击"新增中间件"添加</div>
        </div>
      </VueDraggable>
    </div>

    <MiddlewareForm :visible="formVisible" :middleware="editing" :default-group-id="selectedGroupId === 'all' ? '' : selectedGroupId" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import type { Middleware, Environment } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import MiddlewareForm from '../components/middleware/MiddlewareForm.vue';
import EnvBadge from '../components/common/EnvBadge.vue';
import GroupSidebar from '../components/common/GroupSidebar.vue';

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

function mwEnv(m: Middleware): Environment {
  const env = (m.extra as Record<string, unknown> | undefined)?.environment;
  return (env as Environment) || 'development';
}

function iconStyle(m: Middleware) {
  const c = mwMeta(m.type).color;
  return { background: c, boxShadow: `0 5px 14px -4px ${c}` };
}

const store = useMiddlewareStore();
const toast = useToastStore();
const dialog = useDialogStore();
const formVisible = ref(false);
const editing = ref<Middleware | null>(null);
const search = ref('');
const selectedGroupId = ref<string>('all');

onMounted(async () => { await store.load(); });

const filtered = computed(() => {
  let result = store.list;
  if (selectedGroupId.value !== 'all') {
    result = result.filter(m => m.groupId === selectedGroupId.value);
  }
  if (!search.value.trim()) return result;
  const q = search.value.toLowerCase();
  return result.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.host.toLowerCase().includes(q) ||
    m.type.toLowerCase().includes(q)
  );
});

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(m: Middleware) { editing.value = m; formVisible.value = true; }

async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该中间件？');
  if (!ok) return;
  await store.remove(id);
  toast.success('已删除');
}

async function onSaved() {
  formVisible.value = false;
  await store.load();
}

async function onCopyDetails(m: Middleware) {
  try {
    await store.copyDetails(m.id);
    toast.success('连接信息已复制');
  } catch {
    toast.error('复制失败');
  }
}

async function onDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
  const newList = [...filtered.value];
  const [moved] = newList.splice(oldIndex, 1);
  newList.splice(newIndex, 0, moved);
  const orderedIds = newList.map(m => m.id);
  await store.reorder(orderedIds);
  await store.load();
  toast.success('排序已更新');
}
</script>

<style scoped>
.middleware-view {
  display: flex;
  flex-direction: row;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  gap: var(--gap-lg);
}
.mw-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

/* 操作栏 */
.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.flex-spacer { flex: 1; min-width: 0; }
.btn-p i { font-size: 11px; }

/* 搜索框 */
.search-field {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.search-ico {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  pointer-events: none;
}
.search-inp {
  width: 288px;
  padding-left: 32px;
}

/* 中间件网格 */
.mw-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-content: start;
}
@media (min-width: 640px) {
  .mw-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1280px) {
  .mw-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1536px) {
  .mw-grid { grid-template-columns: repeat(4, 1fr); }
}

/* 中间件卡片（v3 p-4） */
.mw-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}
.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.card-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #fff;
  font-size: var(--text-base);
}
.card-top-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.card-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.mw-card:hover .card-actions { opacity: 1; }
.ibtn-sm { width: 24px; height: 24px; }
.ibtn-sm i { font-size: 11px; }

/* 名称 + 类型 */
.card-title-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-name {
  font-size: 14px;
  font-weight: var(--font-semibold);
}
.type-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  border-radius: 4px;
  padding: 1px 4px;
  background: var(--panel2);
  border: 1px solid var(--border);
}

/* 地址 */
.card-addr {
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 详情列表 */
.card-dl {
  margin-top: 12px;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--text-xs);
  border-top: 1px solid var(--border);
}
.dl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dl-row dt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dl-row dt i {
  width: 12px;
  text-align: center;
}

/* 复制按钮 */
.card-btn-full {
  margin-top: 12px;
  width: 100%;
  justify-content: center;
  padding: 6px 14px;
  font-size: var(--text-xs);
}
.card-btn-full i { font-size: 10px; }

/* 添加占位卡 */
.add-tile {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 14px;
  border: 2px dashed var(--border2);
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
  font-family: inherit;
}
.add-tile:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.add-tile-icon { font-size: 18px; }
.add-tile-title { font-size: 13px; font-weight: var(--font-medium); }
.add-tile-sub { font-size: 10.5px; }

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  padding: 64px 0;
  text-align: center;
}
.empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }
.empty-text { font-size: 13px; }

/* 拖拽 */
.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}
</style>
