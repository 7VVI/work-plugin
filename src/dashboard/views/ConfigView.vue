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
.config-view { padding: 14px var(--page-pad); display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; gap: 14px; }

.action-bar { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: var(--transition); }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-hover); }
.search-wrap { position: relative; margin-left: auto; }
.search-wrap i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 12px; }
.search-input { height: 34px; width: 260px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 12px 0 34px; font-size: 13px; outline: none; font-family: inherit; background: var(--card-bg); transition: var(--transition); color: var(--text-primary); }
.search-input::placeholder { color: var(--text-tertiary); }
.search-input:focus { border-color: var(--text-primary); box-shadow: var(--shadow-focus); }

.split-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 260px 1fr; gap: 14px; overflow: hidden; }

.left-panel { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-md); overflow-y: auto; padding: 6px; }
.left-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; color: var(--text-primary); transition: var(--transition); margin-bottom: 2px; }
.left-item:hover { background: var(--surface-secondary); }
.left-item.active { background: var(--primary); color: #fff; }
.left-item > i.fa-folder { font-size: 13px; color: var(--text-tertiary); }
.left-item.active > i.fa-folder { color: #fff; }
.item-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.item-count { font-size: 11px; color: var(--text-tertiary); background: var(--border-soft); padding: 1px 8px; border-radius: 10px; }
.left-item.active .item-count { background: rgba(255,255,255,0.18); color: rgba(255,255,255,0.9); }
.del-btn { font-size: 11px; color: var(--text-tertiary); padding: 2px; opacity: 0; transition: opacity 0.15s; }
.del-btn:hover { color: var(--danger); }
.left-item:hover .del-btn { opacity: 1; }
.left-item.active .del-btn { color: rgba(255,255,255,0.7); opacity: 1; }
.empty-left { text-align: center; padding: 40px 16px; color: var(--text-tertiary); }
.empty-left i { font-size: 28px; margin-bottom: 8px; }
.empty-left p { font-size: 12px; margin: 0; }

.right-panel { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-md); display: flex; flex-direction: column; overflow: hidden; }
.right-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-soft); flex-shrink: 0; }
.title-wrap { display: flex; align-items: center; gap: 10px; }
.title-wrap i { color: var(--text-secondary); font-size: 14px; }
.title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.count { font-size: 11px; color: var(--text-secondary); background: var(--border-soft); padding: 2px 10px; border-radius: 10px; }
.rename-btn { color: var(--text-tertiary); cursor: pointer; padding: 6px; font-size: 13px; border-radius: var(--radius-sm); transition: var(--transition); border: none; background: transparent; }
.rename-btn:hover { color: var(--text-primary); background: var(--border-soft); }
.right-body { flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }

.table-head { display: grid; grid-template-columns: 1.2fr 1.5fr 1.5fr 70px; gap: 8px; padding: 8px 10px; background: var(--surface-secondary); border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
.table-body { display: flex; flex-direction: column; gap: 6px; }
.table-row { display: grid; grid-template-columns: 1.2fr 1.5fr 1.5fr 70px; gap: 8px; align-items: center; }
.cell { height: 34px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 10px; font-size: 12px; outline: none; font-family: inherit; background: var(--card-bg); transition: var(--transition); color: var(--text-primary); }
.cell::placeholder { color: var(--text-tertiary); }
.cell:focus { border-color: var(--text-primary); box-shadow: var(--shadow-focus); }
.cell-key { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 11px; }
.cell-default { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 11px; color: var(--text-secondary); }
.cell-actions { display: flex; gap: 4px; justify-content: center; }
.cell-actions i { width: 26px; height: 26px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; transition: var(--transition); }
.cell-actions i:hover { background: var(--border-soft); color: var(--primary); }
.cell-actions i:last-child:hover { color: var(--danger); }

.add-item-btn { align-self: flex-start; display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: var(--radius-sm); border: 1px dashed var(--border); background: transparent; color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; margin-top: 4px; transition: var(--transition); }
.add-item-btn:hover { border-color: var(--text-primary); color: var(--text-primary); background: var(--surface-secondary); }
.empty-right { text-align: center; padding: 32px; color: var(--text-tertiary); }
.empty-right i { font-size: 28px; margin-bottom: 8px; }
.empty-right p { font-size: 12px; margin: 0; }

.no-selection { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-tertiary); }
.no-selection i { font-size: 40px; margin-bottom: 12px; }
.no-selection p { font-size: 13px; }
</style>
