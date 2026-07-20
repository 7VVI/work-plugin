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
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:50px;">类型</th>
            <th>名称 / 版本</th>
            <th>连接地址</th>
            <th style="width:80px;">端口</th>
            <th style="width:120px;">账号</th>
            <th style="width:140px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in filtered" :key="m.id">
            <td>
              <div class="type-icon" :style="{ background: getMeta(m.type).color }">
                <i :class="'fa-solid ' + getMeta(m.type).icon"></i>
              </div>
            </td>
            <td>
              <div class="mw-name">{{ m.name }}</div>
              <div v-if="m.version" class="mw-version">v{{ m.version }}</div>
            </td>
            <td><span class="mono">{{ m.host }}</span></td>
            <td><span class="mono">{{ m.port }}</span></td>
            <td><span class="mono">{{ m.username || '—' }}</span></td>
            <td>
              <div class="row-actions">
                <button class="row-action" @click="store.copyConnectionString(m.id)" title="复制连接串"><i class="fa-solid fa-link"></i></button>
                <button class="row-action" @click="store.copyPassword(m.id)" title="复制密码"><i class="fa-solid fa-key"></i></button>
                <button class="row-action" @click="onEdit(m)" title="编辑"><i class="fa-solid fa-pen"></i></button>
                <button class="row-action" @click="onDelete(m.id)" title="删除"><i class="fa-solid fa-trash"></i></button>
              </div>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="6" class="empty-row">暂无中间件，点击"新增中间件"添加</td>
          </tr>
        </tbody>
      </table>
    </div>
    <MiddlewareForm :visible="formVisible" :middleware="editing" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { getMiddlewareMeta, type MiddlewareType } from '@shared/types/enums';
import type { Middleware } from '@shared/types/entities';
import MiddlewareForm from '../components/middleware/MiddlewareForm.vue';

const store = useMiddlewareStore();
const toast = useToastStore();
const dialog = useDialogStore();
const formVisible = ref(false);
const editing = ref<Middleware | null>(null);
const search = ref('');

onMounted(async () => { await store.load(); });

const filtered = computed(() => {
  if (!search.value.trim()) return store.list;
  const q = search.value.toLowerCase();
  return store.list.filter(m => m.name.toLowerCase().includes(q) || m.host.toLowerCase().includes(q));
});

function getMeta(type: string) { return getMiddlewareMeta(type as MiddlewareType); }
function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(m: Middleware) { editing.value = m; formVisible.value = true; }
async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该中间件？');
  if (!ok) return;
  await store.remove(id);
  toast.success('已删除');
}
async function onSaved() { formVisible.value = false; await store.load(); }
</script>

<style scoped>
.middleware-view { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
.action-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px var(--page-pad); gap: 12px; flex-shrink: 0;
}
.action-left, .action-right { display: flex; align-items: center; gap: 8px; }
.search-input { width: 280px; }

.table-wrap {
  flex: 1; min-height: 0; overflow: auto;
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin: 0 var(--page-pad) var(--page-pad);
}

.data-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.data-table thead th {
  background: var(--surface-secondary); color: var(--text-secondary);
  font-weight: 500; padding: 11px 14px; text-align: left;
  border-bottom: 1px solid var(--border-soft); white-space: nowrap;
  font-size: 12.5px; position: sticky; top: 0; z-index: 1;
}
.data-table tbody td {
  padding: 12px 14px; border-bottom: 1px solid var(--border-soft);
  color: var(--text-primary); vertical-align: middle;
}
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr { transition: background 0.12s; }
.data-table tbody tr:hover { background: var(--surface-secondary); }

.type-icon {
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 12px;
}
.mw-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.mw-version { font-size: 11.5px; color: var(--text-tertiary); margin-top: 2px; }
.mono { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 12.5px; color: var(--text-primary); }

.row-actions { display: flex; align-items: center; gap: 2px; }
.row-action {
  width: 28px; height: 28px; border-radius: 5px; border: none; background: transparent;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-tertiary); cursor: pointer; transition: var(--transition); font-size: 12px;
}
.row-action:hover { background: var(--border-soft); color: var(--text-primary); }

.empty-row { text-align: center; color: var(--text-tertiary); padding: 48px 0; font-size: 13px; }
.btn { height: 34px; padding: 0 14px; }
</style>
