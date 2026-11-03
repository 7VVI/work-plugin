<template>
  <div class="server-view">
    <GroupSidebar entity-type="server" label="服务器" :records="store.list" v-model="selectedGroupId" />
    <div class="server-content">
      <!-- 操作栏 - v3 风格 -->
      <div class="action-bar">
        <button class="btn-p" @click="onCreate">
          <i class="fa-solid fa-plus"></i>新增服务器
        </button>
        <!-- 环境筛选 -->
        <div class="env-filter">
          <button class="env-btn" :class="{ active: selectedEnv === 'all' }" @click="selectedEnv = 'all'">全部</button>
          <button class="env-btn env-prod" :class="{ active: selectedEnv === 'production' }" @click="selectedEnv = 'production'">生产</button>
          <button class="env-btn env-dev" :class="{ active: selectedEnv === 'development' }" @click="selectedEnv = 'development'">开发</button>
          <button class="env-btn env-test" :class="{ active: selectedEnv === 'test' }" @click="selectedEnv = 'test'">测试</button>
          <button class="env-btn env-staging" :class="{ active: selectedEnv === 'staging' }" @click="selectedEnv = 'staging'">预发</button>
        </div>
        <div class="flex-spacer"></div>
        <!-- 视图切换 -->
        <div class="view-toggle">
          <button class="view-btn" :class="{ active: viewMode === 'table' }" title="列表视图" @click="viewMode = 'table'">
            <i class="fa-solid fa-list"></i>
          </button>
          <button class="view-btn" :class="{ active: viewMode === 'card' }" title="卡片视图" @click="viewMode = 'card'">
            <i class="fa-solid fa-table-cells-large"></i>
          </button>
        </div>
        <div class="search-field">
          <i class="fa-solid fa-magnifying-glass search-ico t3"></i>
          <input v-model="search" class="inp search-inp" placeholder="搜索服务器名称、IP…" />
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-if="viewMode === 'table'" class="server-list panel">
        <table class="server-table">
          <thead class="table-head">
            <tr>
              <th class="col-server">服务器</th>
              <th class="col-env">环境</th>
              <th class="col-user">账号</th>
              <th class="col-purpose">用途</th>
              <th class="col-updated">最近更新</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <VueDraggable
            v-model="filteredServers"
            tag="tbody"
            :animation="200"
            ghost-class="dragging"
            handle=".drag-handle"
            @end="onDragEnd"
          >
            <tr v-for="s in filteredServers" :key="s.id" class="row-group" @click="onSelect(s.id)">
              <td class="col-server">
                <div class="name-cell">
                  <span class="server-icon"><i class="fa-solid fa-server"></i></span>
                  <span class="name-text">
                    <span class="server-name t1">{{ s.name }}</span>
                    <span class="server-addr t3">{{ s.ip }}:{{ s.sshPort || 22 }}</span>
                  </span>
                </div>
              </td>
              <td class="col-env"><EnvBadge :env="s.environment" /></td>
              <td class="col-user">
                <span class="acct-cell mono t2"><i class="fa-regular fa-user t3"></i>{{ s.username || '—' }}</span>
              </td>
              <td class="col-purpose"><span class="purpose-cell t2">{{ s.purpose || '—' }}</span></td>
              <td class="col-updated t3">{{ formatRelativeTime(s.updatedAt) }}</td>
              <td class="col-actions">
                <div class="row-actions-fade">
                  <button class="ibtn" title="连接" @click.stop="terminalServer = s">
                    <i class="fa-solid fa-terminal"></i>
                  </button>
                  <button class="ibtn" title="复制 SSH 连接信息" @click.stop="onCopySsh(s)">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                  <button class="ibtn danger" title="删除" @click.stop="onDelete(s.id)">
                    <i class="fa-regular fa-trash-can"></i>
                  </button>
                  <i class="fa-solid fa-grip-vertical drag-handle" title="拖动排序" @click.stop></i>
                </div>
              </td>
            </tr>
            <tr v-if="filteredServers.length === 0">
              <td colspan="6" class="empty-row">
                <i class="fa-solid fa-server empty-icon t3"></i>
                <div class="empty-text t3">{{ search ? '未找到匹配的服务器' : '暂无服务器，点击"新增服务器"添加' }}</div>
              </td>
            </tr>
          </VueDraggable>
        </table>
      </div>

      <!-- 卡片视图 -->
      <VueDraggable
        v-else
        v-model="filteredServers"
        class="server-grid"
        :animation="200"
        ghost-class="dragging"
        @end="onDragEnd"
      >
        <ServerCard
          v-for="s in filteredServers"
          :key="s.id"
          :server="s"
          @select="onSelect(s.id)"
          @delete="onDelete(s.id)"
          @connect="terminalServer = s"
        />
        <button
          v-if="filteredServers.length > 0"
          class="add-tile"
          @click="onCreate"
        >
          <i class="fa-solid fa-plus add-tile-icon"></i>
          <span class="add-tile-title">添加服务器</span>
          <span class="add-tile-sub">快速创建新的服务器连接</span>
        </button>
        <div v-if="filteredServers.length === 0 && !store.loading" class="empty-state">
          <i class="fa-solid fa-server empty-icon t3"></i>
          <div class="empty-text t3">暂无服务器，点击"新增服务器"添加</div>
        </div>
      </VueDraggable>
    </div>

    <ServerForm :visible="formVisible" :server="editing" :default-group-id="defaultGroupId" @close="formVisible = false" @saved="onSaved" />
    <ServerTerminal v-if="terminalServer" :server="terminalServer" @close="terminalServer = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useServerStore } from '@shared/stores/serverStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { Server, Environment } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import { serverService } from '@shared/services/serverService';
import ServerCard from '../components/server/ServerCard.vue';
import ServerForm from '../components/server/ServerForm.vue';
import EnvBadge from '../components/common/EnvBadge.vue';
import GroupSidebar from '../components/common/GroupSidebar.vue';
import { UNGROUPED_GROUP_ID, matchesGroupFilter } from '@shared/utils/groupFilter';

const ServerTerminal = defineAsyncComponent(() => import('../components/server/ServerTerminal.vue'));

const store = useServerStore();
const dialog = useDialogStore();
const toast = useToastStore();
const formVisible = ref(false);
const editing = ref<Server | null>(null);
const terminalServer = ref<Server | null>(null);
const search = ref('');
const selectedGroupId = ref<string>('all');
const defaultGroupId = computed(() => (
  selectedGroupId.value === 'all' || selectedGroupId.value === UNGROUPED_GROUP_ID
    ? ''
    : selectedGroupId.value
));
const selectedEnv = ref<Environment | 'all'>('all');
const VIEW_KEY = 'dock-v3-server-view';
const viewMode = ref<'table' | 'card'>(
  (typeof localStorage !== 'undefined' && localStorage.getItem(VIEW_KEY) === 'table') ? 'table' : 'card',
);
watch(viewMode, (value) => {
  try { localStorage.setItem(VIEW_KEY, value); } catch { /* ignore */ }
});

onMounted(async () => { await store.load(); });

const filteredServers = computed(() => {
  let result = store.list.filter(s => matchesGroupFilter(s.groupId, selectedGroupId.value));
  if (selectedEnv.value !== 'all') {
    result = result.filter(s => s.environment === selectedEnv.value);
  }
  if (!search.value.trim()) return result;
  const q = search.value.toLowerCase();
  return result.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.ip.toLowerCase().includes(q)
  );
});

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(s: Server) { editing.value = s; formVisible.value = true; }
function onSelect(id: string) { onEdit(store.list.find(s => s.id === id)!); }
async function onSaved() { formVisible.value = false; await store.load(); }

async function onCopySsh(s: Server) {
  try {
    await serverService.copySshCommand(s.id);
    toast.success('连接信息已复制');
  } catch {
    toast.error('复制失败');
  }
}

async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该服务器？');
  if (!ok) return;
  await store.remove(id);
  toast.success('已删除');
}

async function onDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
  const newList = [...filteredServers.value];
  const [moved] = newList.splice(oldIndex, 1);
  newList.splice(newIndex, 0, moved);
  const orderedIds = newList.map(s => s.id);
  await store.reorder(orderedIds);
  await store.load();
  toast.success('排序已更新');
}
</script>

<style scoped>
.server-view {
  display: flex;
  flex-direction: row;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  gap: var(--gap-lg);
}
.server-content {
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

/* 视图切换 */
.view-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg2);
}
.view-toggle .view-btn {
  width: 30px;
  height: 26px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink3);
  cursor: pointer;
  transition: 0.15s;
  border: none;
  background: transparent;
}
.view-toggle .view-btn:hover { color: var(--ink); }
.view-toggle .view-btn.active {
  background: var(--panel);
  color: var(--accent);
  box-shadow: 0 0 0 1px var(--border), 0 2px 8px -2px rgba(15, 23, 38, 0.1);
}

/* 环境筛选 */
.env-filter {
  display: flex;
  align-items: center;
  gap: 4px;
}
.env-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: var(--font-medium);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--ink2);
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}
.env-btn:hover {
  border-color: var(--border-strong);
  color: var(--ink);
}
.env-btn.active {
  color: #fff;
  border-color: transparent;
  background: var(--ink2);
  box-shadow: 0 0 6px currentColor;
}
.env-btn.env-prod.active { background: var(--env-prod-fg); }
.env-btn.env-dev.active { background: var(--env-dev-fg); }
.env-btn.env-test.active { background: var(--env-test-fg); }
.env-btn.env-staging.active { background: var(--env-staging-fg); }

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

/* 列表视图 */
.server-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
}
.server-table {
  width: 100%;
  border-collapse: collapse;
}
.table-head {
  border-bottom: 1px solid var(--border);
  background: var(--panel2);
}
.table-head th {
  text-align: left;
  padding: 10px 16px;
  font-size: 10.5px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink3);
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--panel2);
}
.col-server { min-width: 260px; }
.col-env { width: 96px; }
.col-user { width: 120px; }
.col-purpose { width: 160px; }
.col-updated { width: 112px; white-space: nowrap; }
.col-actions { width: 150px; text-align: right !important; padding-right: 16px !important; }
.server-table tbody td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  font-size: var(--text-sm);
  color: var(--ink);
}
.row-group { cursor: pointer; transition: background 0.15s ease; }
.row-group:hover { background: var(--surface-hover); }
.row-group:last-child td { border-bottom: none; }
.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.server-icon {
  width: 32px;
  height: 32px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  background: #F59E0B;
  box-shadow: 0 4px 12px -4px rgba(245, 158, 11, 0.55);
}
.name-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}
.server-name {
  font-size: 13.5px;
  font-weight: var(--font-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.server-addr {
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.acct-cell {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-xs);
}
.purpose-cell {
  display: block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-xs);
}
.row-actions-fade {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}
.row-group:hover .row-actions-fade { opacity: 1; }
.drag-handle {
  cursor: move;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: 2px;
  border-radius: var(--radius-sm);
  color: var(--ink3);
  font-size: 12px;
  transition: background 0.15s ease, color 0.15s ease;
}
.drag-handle:hover { background: var(--panel2); color: var(--ink); }
.empty-row {
  text-align: center;
  padding: 64px 16px !important;
  border-bottom: none !important;
}

/* 服务器网格 */
.server-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-content: start;
  /* 行高按内容撑开，禁止卡片被压缩/拉伸 */
  grid-auto-rows: max-content;
}
@media (min-width: 640px) {
  .server-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1280px) {
  .server-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1536px) {
  .server-grid { grid-template-columns: repeat(4, 1fr); }
}

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
.add-tile-sub { font-size: 11px; }

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
