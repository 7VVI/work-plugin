<template>
  <div class="tag-view">
    <div class="action-bar">
      <button class="btn btn-primary" @click="onCreate"><i class="fa-solid fa-plus"></i> 新增标签</button>
    </div>
    <div class="tag-grid">
      <div v-for="t in store.list" :key="t.id" class="tag-card">
        <TagPill :name="t.name" :color="t.color" />
        <div class="tag-actions">
          <input v-model="editColors[t.id]" type="color" @change="onColorChange(t.id)" :title="'颜色'" />
          <div class="row-action" @click="onRename(t)"><i class="fa-solid fa-pen"></i></div>
          <div class="row-action" @click="onDelete(t.id)"><i class="fa-solid fa-trash"></i></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useTagStore } from '@shared/stores/tagStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import type { Tag } from '@shared/types/entities';
import TagPill from '../components/common/TagPill.vue';

const store = useTagStore();
const toast = useToastStore();
const dialog = useDialogStore();
const editColors = reactive<Record<string, string>>({});

onMounted(async () => {
  await store.load();
  store.list.forEach(t => { editColors[t.id] = t.color || '#3b82f6'; });
});

async function onCreate() {
  const name = await dialog.prompt('新增标签', '标签名称');
  if (!name?.trim()) return;
  await store.create(name.trim(), '#3b82f6');
  toast.success('标签已创建');
}

async function onRename(tag: Tag) {
  const name = await dialog.prompt('重命名', '', tag.name);
  if (name && name.trim() && name !== tag.name) {
    await store.update(tag.id, { name: name.trim() });
    toast.success('已重命名');
  }
}

async function onColorChange(id: string) {
  await store.update(id, { color: editColors[id] });
}

async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该标签？关联的标签关系也会删除。');
  if (!ok) return;
  await store.remove(id);
  toast.success('已删除');
}
</script>

<style scoped>
.tag-view { padding: 14px var(--page-pad); display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; gap: 14px; }
.action-bar { flex-shrink: 0; }
.btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; background: var(--primary); color: white; border: 1px solid transparent; font-family: inherit; transition: var(--transition); }
.btn:hover { background: var(--primary-hover); }
.tag-grid {
  flex: 1; min-height: 0; overflow-y: auto;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px; align-content: start;
}
.tag-card {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: 14px;
  display: flex; align-items: center; justify-content: space-between;
  transition: var(--transition);
}
.tag-card:hover { border-color: var(--text-tertiary); box-shadow: var(--shadow-sm); }
.tag-actions { display: flex; align-items: center; gap: 4px; }
.tag-actions input[type="color"] {
  width: 28px; height: 28px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); cursor: pointer; padding: 2px; background: var(--card-bg);
}
.row-action {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-tertiary); cursor: pointer; font-size: 11px;
  background: transparent; border: none; transition: var(--transition);
}
.row-action:hover { background: var(--border-soft); color: var(--text-primary); }
.row-action:last-child:hover { color: var(--danger); }
</style>
