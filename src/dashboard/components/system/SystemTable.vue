<template>
  <div class="card">
    <div class="action-bar">
      <button class="btn btn-primary" @click="$emit('create')"><i class="fa-solid fa-plus"></i> 新增系统</button>
      <button class="btn btn-danger" :disabled="selectedIds.size === 0" @click="$emit('bulkDelete', Array.from(selectedIds))">
        <i class="fa-solid fa-trash"></i> 删除
      </button>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" class="search-input" type="text" placeholder="搜索系统..." />
      </div>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:36px;"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
          <th>系统名称</th>
          <th>URL</th>
          <th style="width:60px;">环境</th>
          <th style="width:60px;">收藏</th>
          <th style="width:80px;">最近使用</th>
          <th style="width:60px;">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in filteredSystems" :key="s.id" :class="{ selected: selectedId === s.id }" @click="$emit('select', s.id)">
          <td @click.stop><input type="checkbox" :checked="selectedIds.has(s.id)" @change="toggleOne(s.id)" /></td>
          <td>
            <div class="sys-name">
              <div class="sys-icon" :style="{ background: s.iconColor || 'linear-gradient(135deg,#3b82f6,#2563eb)' }">
                <i :class="s.icon || 'fa-solid fa-globe'"></i>
              </div>
              {{ s.name }}
            </div>
          </td>
          <td><a :href="s.url" target="_blank" class="text-blue-600 hover:underline" @click.stop>{{ s.url }}</a></td>
          <td><EnvBadge :env="s.environment" /></td>
          <td><i :class="s.favorite ? 'fa-solid fa-star' : 'fa-regular fa-star'" :style="{ color: s.favorite ? '#f59e0b' : '#d1d5db', cursor: 'pointer' }" @click.stop="$emit('toggleFav', s.id)"></i></td>
          <td>{{ formatRelativeTime(s.updatedAt) }}</td>
          <td>
            <div class="row-actions">
              <div class="row-action" @click.stop="$emit('open', s)" title="打开"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
              <div class="row-action" @click.stop="$emit('delete', s.id)" title="删除"><i class="fa-solid fa-trash"></i></div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { System } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import EnvBadge from '../common/EnvBadge.vue';

const props = defineProps<{
  systems: System[];
  selectedId: string | null;
}>();

defineEmits<{
  create: [];
  select: [id: string];
  open: [system: System];
  delete: [id: string];
  toggleFav: [id: string];
  bulkDelete: [ids: string[]];
}>();

const search = ref('');
const selectedIds = ref<Set<string>>(new Set());

const filteredSystems = computed(() => {
  if (!search.value.trim()) return props.systems;
  const q = search.value.toLowerCase();
  return props.systems.filter(s => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
});

const allChecked = computed(() => filteredSystems.value.length > 0 && filteredSystems.value.every(s => selectedIds.value.has(s.id)));

function toggleAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    filteredSystems.value.forEach(s => selectedIds.value.add(s.id));
  } else {
    selectedIds.value.clear();
  }
}

function toggleOne(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id);
  else selectedIds.value.add(id);
}
</script>

<style scoped>
.card { background: white; border-radius: 8px; border: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.action-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: white; border-bottom: 1px solid var(--border-soft); }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-700); }
.btn-danger { background: white; color: #dc2626; border-color: #fecaca; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
.search-wrap { position: relative; margin-left: auto; }
.search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; }
.search-input { height: 30px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px 0 30px; font-size: 12px; background: white; outline: none; font-family: inherit; width: 240px; }
.data-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.data-table thead th { background: #f9fafb; color: var(--text-secondary); font-weight: 500; padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--border-soft); white-space: nowrap; }
.data-table tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border-soft); color: var(--text-primary); }
.data-table tbody tr { cursor: pointer; transition: background 0.12s; }
.data-table tbody tr:hover { background: #f9fafb; }
.data-table tbody tr.selected { background: var(--primary-50); }
.sys-name { display: flex; align-items: center; gap: 8px; }
.sys-icon { width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; flex-shrink: 0; }
.row-actions { display: flex; align-items: center; gap: 4px; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
.text-blue-600 { color: var(--primary); }
</style>
