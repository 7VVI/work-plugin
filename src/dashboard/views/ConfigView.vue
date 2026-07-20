<template>
  <div class="config-view">
    <div class="action-bar">
      <button class="btn btn-primary" @click="onCreate"><i class="fa-solid fa-plus"></i> 新增配置</button>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" class="search-input" placeholder="搜索配置..." />
      </div>
    </div>

    <div class="split-body">
      <div class="left-panel">
        <div
          v-for="g in filtered"
          :key="g.id"
          class="left-item"
          :class="{ active: selectedId === g.id }"
          @click="selectGroup(g.id)"
        >
          <i class="fa-solid fa-folder"></i>
          <span class="item-name">{{ g.name }}</span>
          <span class="item-count">{{ g.items.length }}</span>
          <i class="fa-solid fa-times del-btn" @click.stop="onDelete(g.id)" title="删除"></i>
        </div>
        <div v-if="filtered.length === 0" class="empty-left">
          <i class="fa-solid fa-folder-open"></i>
          <p>{{ search ? '未找到匹配' : '暂无配置' }}</p>
        </div>
      </div>

      <div class="right-panel">
        <template v-if="selected">
          <div class="right-header">
            <div class="title-wrap">
              <i class="fa-solid fa-folder"></i>
              <span class="title">{{ selected.name }}</span>
              <span class="count">{{ selected.items.length }} 项</span>
            </div>
            <i class="fa-solid fa-pen rename-btn" @click="onRename(selected)" title="重命名"></i>
          </div>

          <div class="right-body">
            <div class="table-head">
              <div class="col-key">字段标识</div>
              <div class="col-label">字段名称</div>
              <div class="col-default">默认值</div>
              <div class="col-actions">操作</div>
            </div>
            <div class="table-body">
              <div v-for="(item, idx) in editItems" :key="idx" class="table-row">
                <input
                  v-model="item.key"
                  class="cell cell-key"
                  placeholder="如：api_key"
                  @blur="saveItem(idx)"
                  @keyup.enter="saveItem(idx)"
                />
                <input
                  v-model="item.label"
                  class="cell cell-label"
                  placeholder="如：API 密钥"
                  @blur="saveItem(idx)"
                  @keyup.enter="saveItem(idx)"
                />
                <input
                  v-model="item.defaultValue"
                  class="cell cell-default"
                  placeholder="—"
                  @blur="saveItem(idx)"
                  @keyup.enter="saveItem(idx)"
                />
                <div class="col-actions cell-actions">
                  <i class="fa-solid fa-copy" v-if="item.defaultValue" @click="onCopy(item.defaultValue)" title="复制默认值"></i>
                  <i class="fa-solid fa-trash" @click="onRemoveItem(idx)" title="删除"></i>
                </div>
              </div>
              <div v-if="selected.items.length === 0" class="empty-right">
                <i class="fa-solid fa-keyboard"></i>
                <p>点击下方"添加字段"开始记录</p>
              </div>
            </div>
            <button class="add-item-btn" @click="onAddItem">
              <i class="fa-solid fa-plus"></i> 添加字段
            </button>
          </div>
        </template>
        <div v-else class="no-selection">
          <i class="fa-solid fa-hand-pointer"></i>
          <p>请选择左侧配置，或点击"新增配置"</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useConfigStore } from '@shared/stores/configStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { configService } from '@shared/services/configService';
import type { ConfigGroup, ConfigItem } from '@shared/types/entities';

const store = useConfigStore();
const toast = useToastStore();
const dialog = useDialogStore();

const search = ref('');
const selectedId = ref<string | null>(null);
const editItems = ref<ConfigItem[]>([]);

onMounted(async () => { await store.load(); });

const filtered = computed(() => {
  if (!search.value.trim()) return store.list;
  const q = search.value.toLowerCase();
  return store.list.filter(g =>
    g.name.toLowerCase().includes(q) ||
    g.items.some(it =>
      (it.key || '').toLowerCase().includes(q) ||
      (it.label || '').toLowerCase().includes(q) ||
      (it.value || '').toLowerCase().includes(q)
    )
  );
});

const selected = computed(() => store.list.find(g => g.id === selectedId.value));

watch(selected, (g) => {
  if (g) editItems.value = g.items.map(it => ({ ...it }));
  else editItems.value = [];
}, { immediate: true });

function selectGroup(id: string) {
  selectedId.value = id;
}

async function onCreate() {
  const name = await dialog.prompt('新增配置', '如：域名映射、开发邮箱、短信配置');
  if (!name?.trim()) return;
  const id = await store.create(name.trim());
  selectedId.value = id;
  toast.success('配置已创建');
}

async function onRename(g: ConfigGroup) {
  const name = await dialog.prompt('重命名', '', g.name);
  if (!name?.trim() || name === g.name) return;
  await store.rename(g.id, name.trim());
  toast.success('已重命名');
}

async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该配置及其所有字段？');
  if (!ok) return;
  if (selectedId.value === id) selectedId.value = null;
  await store.remove(id);
  toast.success('已删除');
}

function onAddItem() {
  if (!selected.value) return;
  editItems.value.push({ key: '', label: '', defaultValue: '' });
  persistItems();
}

async function saveItem(_idx: number) {
  if (!selected.value) return;
  await persistItems();
}

async function persistItems() {
  if (!selected.value) return;
  const items = editItems.value.map(it => ({
    key: it.key || '',
    label: it.label || '',
    defaultValue: it.defaultValue || '',
  }));
  await store.setItems(selected.value.id, items);
}

async function onRemoveItem(idx: number) {
  if (!selected.value) return;
  editItems.value.splice(idx, 1);
  await store.removeItem(selected.value.id, idx);
  toast.success('已删除');
}

async function onCopy(value: string) {
  if (!value) return;
  await configService.copyValue(value);
  toast.success('已复制');
}
</script>

<style scoped>
.config-view {
  padding: var(--gap-lg) var(--page-pad) var(--page-pad);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: var(--gap-lg);
}

.action-bar {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  flex-shrink: 0;
}
.action-bar .search-wrap { width: 280px; margin-left: auto; }

.split-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--gap-lg);
  overflow: hidden;
}

.left-panel {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow-y: auto;
  padding: var(--gap-sm);
  box-shadow: var(--shadow-sm);
}
.left-item {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: 10px var(--gap-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  transition: var(--transition-fast);
  margin-bottom: 2px;
}
.left-item:hover { background: var(--surface-hover); color: var(--text-primary); }
.left-item.active {
  background: var(--primary-50);
  color: var(--primary);
}
.left-item > i.fa-folder {
  font-size: var(--text-sm);
  color: var(--text-quaternary);
}
.left-item.active > i.fa-folder { color: var(--primary); }
.item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--font-medium);
}
.item-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--surface-secondary);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-weight: var(--font-medium);
}
.left-item.active .item-count {
  background: var(--bg-pure);
  color: var(--primary);
}
.del-btn {
  font-size: 11px;
  color: var(--text-quaternary);
  padding: 4px;
  opacity: 0;
  transition: var(--transition-fast);
  border-radius: var(--radius-xs);
}
.del-btn:hover { color: var(--danger); background: var(--danger-light); }
.left-item:hover .del-btn { opacity: 1; }
.left-item.active .del-btn { color: var(--primary); opacity: 0.6; }

.empty-left {
  text-align: center;
  padding: 48px var(--gap-md);
  color: var(--text-tertiary);
}
.empty-left i { font-size: 28px; margin-bottom: var(--gap-sm); color: var(--text-quaternary); }
.empty-left p { font-size: var(--text-sm); margin: 0; }

.right-panel {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-lg) var(--gap-xl);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.title-wrap { display: flex; align-items: center; gap: var(--gap-md); }
.title-wrap > i {
  color: var(--primary);
  font-size: var(--text-base);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--primary-50);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
.count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--surface-secondary);
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  font-weight: var(--font-medium);
}
.rename-btn {
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--gap-sm);
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  transition: var(--transition-fast);
  border: none;
  background: transparent;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rename-btn:hover {
  color: var(--primary);
  background: var(--primary-50);
}
.right-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--gap-lg) var(--gap-xl);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.table-head {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1.5fr 80px;
  gap: var(--gap-sm);
  padding: var(--gap-sm) var(--gap-md);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  margin-bottom: var(--gap-xs);
  letter-spacing: 0.3px;
}
.table-body { display: flex; flex-direction: column; gap: var(--gap-sm); }
.table-row {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1.5fr 80px;
  gap: var(--gap-sm);
  align-items: center;
}
.cell {
  height: 36px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 0 var(--gap-md);
  font-size: var(--text-sm);
  outline: none;
  font-family: inherit;
  background: var(--bg-pure);
  transition: var(--transition-fast);
  color: var(--text-primary);
}
.cell::placeholder { color: var(--text-quaternary); }
.cell:hover { border-color: var(--text-quaternary); }
.cell:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}
.cell-key {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.cell-default {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
.cell-actions { display: flex; gap: var(--gap-xs); justify-content: center; }
.cell-actions i {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 11px;
  transition: var(--transition-fast);
}
.cell-actions i:hover {
  background: var(--primary-50);
  color: var(--primary);
}
.cell-actions i:last-child:hover {
  background: var(--danger-light);
  color: var(--danger);
}

.add-item-btn {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  height: 36px;
  padding: 0 var(--gap-lg);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-strong);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  font-family: inherit;
  margin-top: var(--gap-sm);
  transition: var(--transition-fast);
}
.add-item-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-50);
}

.empty-right {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
}
.empty-right i {
  font-size: 28px;
  margin-bottom: var(--gap-sm);
  color: var(--text-quaternary);
}
.empty-right p { font-size: var(--text-sm); margin: 0; }

.no-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  gap: var(--gap-md);
}
.no-selection i {
  font-size: 40px;
  color: var(--text-quaternary);
}
.no-selection p { font-size: var(--text-sm); margin: 0; }
</style>
