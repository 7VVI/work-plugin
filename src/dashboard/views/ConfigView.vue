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
      <div class="left-panel panel">
        <div
          v-for="g in filtered"
          :key="g.id"
          class="left-item"
          :class="{ active: selectedId === g.id }"
          @click="selectGroup(g.id)"
        >
          <i :class="groupIcon(g.name)"></i>
          <span class="item-name">{{ g.name }}</span>
          <span class="item-count">{{ g.items.length }}</span>
          <i class="fa-solid fa-times del-btn" @click.stop="onDelete(g.id)" title="删除"></i>
        </div>
        <div v-if="filtered.length === 0" class="empty-left">
          <i class="fa-solid fa-folder-open"></i>
          <p>{{ search ? '未找到匹配' : '暂无配置' }}</p>
        </div>
      </div>

      <div class="right-panel panel">
        <template v-if="selected">
          <div class="right-header">
            <div class="title-wrap">
              <i :class="groupIcon(selected.name)"></i>
              <span class="title">{{ selected.name }}</span>
              <span class="count">{{ selected.items.length }} 项</span>
            </div>
            <i class="fa-solid fa-pen rename-btn" @click="onRename(selected)" title="重命名"></i>
          </div>

          <div class="right-body">
            <div class="field-list">
              <div class="field-item header-row">
                <div>字段标识</div>
                <div>字段名称</div>
                <div>默认值</div>
                <div class="text-right">操作</div>
              </div>
              <template v-for="(item, idx) in selected.items" :key="idx">
                <!-- 编辑态 -->
                <div v-if="editingIdx === idx" class="field-item edit-row">
                  <input v-model="editItem.key" class="finput mono" placeholder="如：api_key" @keyup.enter="confirmEdit" @keyup.escape="cancelEdit" />
                  <input v-model="editItem.label" class="finput" placeholder="如：API 密钥" @keyup.enter="confirmEdit" @keyup.escape="cancelEdit" />
                  <input v-model="editItem.defaultValue" class="finput mono" placeholder="默认值" @keyup.enter="confirmEdit" @keyup.escape="cancelEdit" />
                  <div class="field-icons">
                    <div class="row-action confirm" @click="confirmEdit" title="确认"><i class="fa-solid fa-check"></i></div>
                    <div class="row-action danger" @click="cancelEdit" title="取消"><i class="fa-solid fa-xmark"></i></div>
                  </div>
                </div>
                <!-- 显示态 -->
                <div v-else class="field-item" @dblclick="startEdit(idx)">
                  <div class="mono field-key">{{ item.key || '—' }}</div>
                  <div>{{ item.label || '—' }}</div>
                  <div class="mono field-value">{{ item.defaultValue || '—' }}</div>
                  <div class="field-icons">
                    <div class="row-action" v-if="item.defaultValue" @click="onCopy(item.defaultValue)" title="复制默认值"><i class="fa-solid fa-copy"></i></div>
                    <div class="row-action" @click="startEdit(idx)" title="编辑"><i class="fa-solid fa-pen"></i></div>
                    <div class="row-action danger" @click="onRemoveItem(idx)" title="删除"><i class="fa-solid fa-trash"></i></div>
                  </div>
                </div>
              </template>
              <div v-if="selected.items.length === 0 && !adding" class="empty-row">暂无字段，点击下方"添加字段"添加</div>
              <div v-if="adding" class="field-item edit-row">
                <input ref="addKeyRef" v-model="newItem.key" class="finput mono" placeholder="如：api_key" @keyup.enter="confirmAdd" @keyup.escape="cancelAdd" />
                <input v-model="newItem.label" class="finput" placeholder="如：API 密钥" @keyup.enter="confirmAdd" @keyup.escape="cancelAdd" />
                <input v-model="newItem.defaultValue" class="finput mono" placeholder="默认值" @keyup.enter="confirmAdd" @keyup.escape="cancelAdd" />
                <div class="field-icons">
                  <div class="row-action confirm" @click="confirmAdd" title="确认"><i class="fa-solid fa-check"></i></div>
                  <div class="row-action danger" @click="cancelAdd" title="取消"><i class="fa-solid fa-xmark"></i></div>
                </div>
              </div>
            </div>
            <button v-if="!adding" class="add-item-btn" @click="startAdd">
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
import { ref, computed, watch, onMounted, nextTick } from 'vue';
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
const editingIdx = ref<number | null>(null);
const editItem = ref<ConfigItem>({ key: '', label: '', defaultValue: '' });
const adding = ref(false);
const newItem = ref<ConfigItem>({ key: '', label: '', defaultValue: '' });
const addKeyRef = ref<HTMLInputElement | null>(null);

const configIcons = [
  'fa-solid fa-gear',
  'fa-solid fa-database',
  'fa-solid fa-envelope',
  'fa-solid fa-globe',
  'fa-solid fa-key',
  'fa-solid fa-palette',
  'fa-solid fa-bolt',
  'fa-solid fa-layer-group',
  'fa-solid fa-code',
  'fa-solid fa-shield-halved',
  'fa-solid fa-cloud',
  'fa-solid fa-terminal',
];

function groupIcon(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return configIcons[Math.abs(hash) % configIcons.length];
}

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

watch(selected, () => {
  editingIdx.value = null;
  adding.value = false;
});

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

function currentItems(): ConfigItem[] {
  return (selected.value?.items ?? []).map(it => ({
    key: it.key || '',
    label: it.label || '',
    defaultValue: it.defaultValue || '',
  }));
}

function startEdit(idx: number) {
  const it = selected.value?.items[idx];
  if (!it) return;
  adding.value = false;
  editItem.value = { key: it.key || '', label: it.label || '', defaultValue: it.defaultValue || '' };
  editingIdx.value = idx;
}

function cancelEdit() {
  editingIdx.value = null;
}

async function confirmEdit() {
  if (!selected.value || editingIdx.value === null) return;
  if (!editItem.value.key?.trim() && !editItem.value.label?.trim()) return;
  const items = currentItems();
  items[editingIdx.value] = {
    key: (editItem.value.key || '').trim(),
    label: (editItem.value.label || '').trim(),
    defaultValue: editItem.value.defaultValue || '',
  };
  await store.setItems(selected.value.id, items);
  editingIdx.value = null;
  toast.success('已保存');
}

function startAdd() {
  editingIdx.value = null;
  newItem.value = { key: '', label: '', defaultValue: '' };
  adding.value = true;
  nextTick(() => addKeyRef.value?.focus());
}

function cancelAdd() {
  adding.value = false;
  newItem.value = { key: '', label: '', defaultValue: '' };
}

async function confirmAdd() {
  if (!selected.value) return;
  if (!newItem.value.key?.trim() && !newItem.value.label?.trim()) { cancelAdd(); return; }
  const items = currentItems();
  items.push({
    key: (newItem.value.key || '').trim(),
    label: (newItem.value.label || '').trim(),
    defaultValue: newItem.value.defaultValue || '',
  });
  await store.setItems(selected.value.id, items);
  cancelAdd();
  toast.success('已添加');
}

async function onRemoveItem(idx: number) {
  if (!selected.value) return;
  await store.removeItem(selected.value.id, idx);
  if (editingIdx.value === idx) editingIdx.value = null;
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
  overflow-y: auto;
  padding: var(--gap-sm);
}
.left-item {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: 10px var(--gap-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--ink2);
  transition: var(--transition-fast);
  margin-bottom: 2px;
}
.left-item:hover { background: var(--surface-hover); color: var(--ink); }
.left-item.active {
  background: var(--primary-50);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--glow);
}
.left-item.active:hover {
  background: var(--primary-50);
  color: var(--accent);
}
.left-item > i:first-child {
  font-size: var(--text-sm);
  color: var(--text-quaternary);
  width: 18px;
  text-align: center;
}
.left-item.active > i:first-child { color: var(--primary); }
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

/* 字段列表 */
.field-list {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.field-item {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1.5fr 120px;
  align-items: center;
  padding: 0 14px;
  height: 40px;
  font-size: var(--text-sm);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-soft);
  gap: var(--gap-sm);
}
.field-item:last-child { border-bottom: none; }
.field-item.header-row {
  background: var(--surface-secondary);
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  height: 36px;
  letter-spacing: 0.3px;
}
.field-item.edit-row {
  background: var(--primary-50);
  height: auto;
  padding: 8px 14px;
}
.field-item:not(.header-row):not(.edit-row) { cursor: default; }
.field-item:not(.header-row):not(.edit-row):hover { background: var(--surface-hover); }
.mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
.field-key, .field-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.text-right { text-align: right; }
.field-icons {
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-end;
}
.row-action {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-quaternary);
  cursor: pointer;
  font-size: 11px;
  transition: var(--transition-fast);
  background: transparent;
}
.row-action:hover { background: var(--primary-50); color: var(--primary); }
.row-action.danger:hover { background: var(--danger-light); color: var(--danger); }
.row-action.confirm { color: var(--success); }
.row-action.confirm:hover { background: var(--success-light); }
.empty-row {
  padding: 24px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}
/* 字段行内编辑输入：复用 tokens 的 .finput（透明底/聚焦描边） */
.field-item input { min-width: 0; }
.finput.mono { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink); }
.right-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--gap-lg) var(--gap-xl);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.add-item-btn {
  margin-top: var(--gap-sm);
  font-size: var(--text-sm);
  color: var(--primary);
  background: none;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  padding: 8px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  width: 100%;
  font-weight: var(--font-medium);
  font-family: inherit;
  transition: var(--transition-fast);
}
.add-item-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-50);
}

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
