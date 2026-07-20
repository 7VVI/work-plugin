<template>
  <div class="card">
    <div class="action-bar">
      <button class="btn btn-primary" @click="$emit('create')"><i class="fa-solid fa-plus"></i> 新增中间件</button>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" class="search-input" placeholder="搜索中间件..." />
      </div>
    </div>
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>名称 / 版本</th>
            <th>连接地址</th>
            <th>端口</th>
            <th>账号</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in filtered" :key="m.id">
            <td>
              <div class="sys-name">
                <div class="sys-icon" :style="{ background: getMeta(m.type).color }"><i :class="'fa-solid ' + getMeta(m.type).icon"></i></div>
              </div>
            </td>
            <td><div class="font-medium">{{ m.name }} <span class="version">{{ m.version }}</span></div></td>
            <td>{{ m.host }}</td>
            <td>{{ m.port }}</td>
            <td>{{ m.username || '-' }}</td>
            <td>
              <div class="row-actions">
                <div class="row-action" @click="$emit('copyConn', m.id)" title="复制连接串"><i class="fa-solid fa-link"></i></div>
                <div class="row-action" @click="$emit('copyPwd', m.id)" title="复制密码"><i class="fa-solid fa-key"></i></div>
                <div class="row-action" @click="$emit('edit', m)" title="编辑"><i class="fa-solid fa-pen"></i></div>
                <div class="row-action" @click="$emit('delete', m.id)" title="删除"><i class="fa-solid fa-trash"></i></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Middleware } from '@shared/types/entities';
import { getMiddlewareMeta, type MiddlewareType } from '@shared/types/enums';

const props = defineProps<{ middlewares: Middleware[] }>();
defineEmits<{ create: []; edit: [m: Middleware]; delete: [id: string]; copyConn: [id: string]; copyPwd: [id: string] }>();

const search = ref('');
const filtered = computed(() => {
  if (!search.value.trim()) return props.middlewares;
  const q = search.value.toLowerCase();
  return props.middlewares.filter(m => m.name.toLowerCase().includes(q) || m.host.toLowerCase().includes(q));
});
function getMeta(type: string) { return getMiddlewareMeta(type as MiddlewareType); }
</script>

<style scoped>
.card { background: white; border-radius: 8px; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; height: 100%; min-height: 0; }
.action-bar { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border-soft); flex-shrink: 0; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.search-wrap { position: relative; margin-left: auto; }
.search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; }
.search-input { height: 30px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px 0 30px; font-size: 12px; width: 240px; outline: none; font-family: inherit; }
.table-scroll { flex: 1; min-height: 0; overflow: auto; }
.data-table { width: 100%; font-size: 12px; border-collapse: collapse; }
.data-table th { background: #f9fafb; padding: 9px 12px; text-align: left; font-weight: 500; color: var(--text-secondary); border-bottom: 1px solid var(--border-soft); position: sticky; top: 0; z-index: 1; }
.data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-soft); color: var(--text-primary); }
.sys-name { display: flex; align-items: center; }
.sys-icon { width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; }
.version { color: var(--text-tertiary); font-size: 11px; margin-left: 4px; }
.row-actions { display: flex; gap: 4px; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
</style>
