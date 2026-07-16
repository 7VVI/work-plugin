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
import type { Tag } from '@shared/types/entities';
import TagPill from '../components/common/TagPill.vue';

const store = useTagStore();
const toast = useToastStore();
const editColors = reactive<Record<string, string>>({});

onMounted(async () => {
  await store.load();
  store.list.forEach(t => { editColors[t.id] = t.color || '#3b82f6'; });
});

async function onCreate() {
  const name = prompt('标签名称');
  if (!name) return;
  await store.create(name, '#3b82f6');
  toast.success('标签已创建');
}

async function onRename(tag: Tag) {
  const name = prompt('新名称', tag.name);
  if (name && name !== tag.name) {
    await store.update(tag.id, { name });
    toast.success('已重命名');
  }
}

async function onColorChange(id: string) {
  await store.update(id, { color: editColors[id] });
}

async function onDelete(id: string) {
  if (!confirm('确认删除该标签？关联的标签关系也会删除。')) return;
  await store.remove(id);
  toast.success('已删除');
}
</script>

<style scoped>
.tag-view { padding: 12px; }
.action-bar { margin-bottom: 12px; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; background: var(--primary); color: white; border: none; font-family: inherit; }
.tag-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.tag-card { background: white; border: 1px solid var(--border); border-radius: 6px; padding: 10px; display: flex; align-items: center; justify-content: space-between; }
.tag-actions { display: flex; align-items: center; gap: 4px; }
.tag-actions input[type="color"] { width: 24px; height: 24px; border: none; border-radius: 4px; cursor: pointer; padding: 0; background: none; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
</style>
