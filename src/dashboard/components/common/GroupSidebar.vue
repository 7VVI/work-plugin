<template>
  <aside class="group-sidebar">
    <div class="panel group-panel">
      <div class="group-head">
        <span class="group-title t3">分组</span>
        <button class="ibtn ibtn-mini" title="新建分组" @click="openCreate">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>

      <div class="group-list">
        <!-- 全部（虚拟默认项） -->
        <div class="group-item" :class="{ active: modelValue === 'all' }" @click="select('all')">
          <span class="group-dot all-dot"></span>
          <span class="group-name">全部{{ label }}</span>
          <span class="group-count t3">{{ records.length }}</span>
        </div>

        <!-- 自定义分组 -->
        <div
          v-for="g in store.groups"
          :key="g.id"
          class="group-item"
          :class="{ active: modelValue === g.id }"
          @click="select(g.id)"
        >
          <span class="group-dot" :style="{ background: g.color }"></span>
          <template v-if="renamingId === g.id">
            <input
              ref="renamingInput"
              v-model="renamingName"
              class="inp group-rename-inp"
              @click.stop
              @keyup.enter="commitRename(true)"
              @keyup.escape="commitRename(false)"
              @blur="commitRename(true)"
            />
          </template>
          <template v-else>
            <span class="group-name" @dblclick.stop="startRename(g)" title="双击重命名">{{ g.name }}</span>
            <span class="group-count t3">{{ countOf(g.id) }}</span>
            <button class="ibtn ibtn-mini group-act" title="重命名" @click.stop="startRename(g)">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="ibtn ibtn-mini danger group-act" title="删除分组" @click.stop="onDelete(g)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- 新建分组弹窗 -->
    <teleport to="body">
      <Transition name="grp-modal">
        <div v-if="createOpen" class="grp-overlay" @click.self="createOpen = false">
          <div class="grp-panel panel-solid" role="dialog" aria-modal="true">
            <div class="grp-head">
              <h2>新建分组</h2>
              <button class="ibtn" type="button" @click="createOpen = false" aria-label="关闭">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div class="grp-body">
              <label class="grp-lbl">分组名称</label>
              <input
                ref="createInput"
                v-model="createName"
                class="inp"
                placeholder="如：生产环境"
                @keyup.enter="confirmCreate"
                @keyup.escape="createOpen = false"
              />
              <label class="grp-lbl grp-mt">颜色</label>
              <div class="grp-colors">
                <button
                  v-for="c in COLORS"
                  :key="c"
                  type="button"
                  class="grp-color"
                  :class="{ on: createColor === c }"
                  :style="{ background: c }"
                  :title="c"
                  @click="createColor = c"
                ></button>
              </div>
            </div>
            <div class="grp-foot">
              <button class="btn-g" type="button" @click="createOpen = false">取消</button>
              <button class="btn-p" type="button" @click="confirmCreate">
                <i class="fa-solid fa-check"></i>创建
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </teleport>
  </aside>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { useGroupStore } from '@shared/stores/groupStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { Group, EntityType } from '@shared/types/entities';

const props = defineProps<{
  entityType: EntityType;
  label: string;
  records: { groupId?: string }[];
  modelValue: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [v: string] }>();

const store = useGroupStore();
const dialog = useDialogStore();
const toast = useToastStore();

const COLORS = ['#2E6BF0', '#10B981', '#7C3AED', '#0891B2', '#F59E0B', '#EC4899', '#EF4444', '#64748B'];

onMounted(() => store.load(props.entityType));

function select(id: string) {
  emit('update:modelValue', id);
}
function countOf(id: string) {
  return props.records.filter(r => r.groupId === id).length;
}

/* ---------- 新建分组 ---------- */
const createOpen = ref(false);
const createName = ref('');
const createColor = ref(COLORS[0]);
const createInput = ref<HTMLInputElement | null>(null);

function openCreate() {
  createName.value = '';
  createColor.value = COLORS[store.groups.length % COLORS.length];
  createOpen.value = true;
  nextTick(() => createInput.value?.focus());
}

async function confirmCreate() {
  const name = createName.value.trim();
  if (!name) { toast.error('请填写分组名称'); return; }
  createOpen.value = false;
  await store.create(name, createColor.value);
  toast.success('分组已创建');
}

/* ---------- 重命名 ---------- */
const renamingId = ref<string | null>(null);
const renamingName = ref('');
const renamingInput = ref<HTMLInputElement | null>(null);

function startRename(g: Group) {
  renamingId.value = g.id;
  renamingName.value = g.name;
  nextTick(() => {
    renamingInput.value?.focus();
    renamingInput.value?.select();
  });
}

async function commitRename(save: boolean) {
  const id = renamingId.value;
  if (!id) return;
  const name = renamingName.value.trim();
  renamingId.value = null;
  renamingName.value = '';
  if (!save || !name) return;
  const g = store.groups.find(x => x.id === id);
  if (g && g.name !== name) {
    await store.rename(id, name);
    toast.success('分组已重命名');
  }
}

/* ---------- 删除 ---------- */
async function onDelete(g: Group) {
  const ok = await dialog.confirm(
    '删除分组',
    `确认删除分组「${g.name}」？该分组下的记录不会被删除，会变为未分组。`,
  );
  if (!ok) return;
  await store.remove(g.id);
  if (props.modelValue === g.id) emit('update:modelValue', 'all');
  toast.success('分组已删除');
}
</script>

<style scoped>
.group-sidebar { width: 240px; flex: none; min-height: 0; display: flex; }

.group-panel {
  padding: 8px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 6px;
  flex-shrink: 0;
}
.group-title {
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.16em;
}
.ibtn-mini { width: 20px; height: 20px; }
.ibtn-mini i { font-size: 10px; }

.group-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.group-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  color: var(--ink2);
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.group-item:hover { background: var(--panel2); }
.group-item.active {
  background: rgba(46, 107, 240, .09);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(46, 107, 240, .25);
}
.group-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  background: var(--ink3);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .06);
}
.group-item.active .group-dot { box-shadow: 0 0 6px currentColor; }
.all-dot {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
}
.group-name {
  flex: 1;
  font-size: 13px;
  font-weight: var(--font-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.group-count {
  font-family: var(--font-mono);
  font-size: 10px;
}
.group-act {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.group-item:hover .group-act { opacity: 1; }

.group-rename-inp {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  font-size: 13px;
}

/* ================= 新建分组弹窗 ================= */
.grp-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 38, 0.35);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}
.grp-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 380px;
  overflow: hidden;
  border-radius: var(--radius-2xl);
  box-shadow: 0 24px 70px -16px var(--shadow-pop), 0 0 40px -16px var(--glow);
}
.grp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
}
.grp-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: var(--font-semibold);
  color: var(--ink);
}
.grp-body {
  padding: 4px 20px 16px;
}
.grp-lbl {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: var(--font-medium);
  color: var(--ink2);
}
.grp-mt { margin-top: 14px; }
.grp-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.grp-color {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.grp-color:hover { transform: scale(1.08); }
.grp-color.on {
  border-color: var(--solid);
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px currentColor;
  transform: scale(1.08);
}
.grp-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
.grp-foot .btn-p i { font-size: 11px; }

/* 弹窗过渡 */
.grp-modal-enter-active { transition: opacity 0.18s ease; }
.grp-modal-leave-active { transition: opacity 0.16s ease; }
.grp-modal-enter-active .grp-panel {
  transition: transform 0.3s cubic-bezier(0.3, 1.3, 0.45, 1), opacity 0.3s ease;
}
.grp-modal-leave-active .grp-panel {
  transition: transform 0.16s ease, opacity 0.16s ease;
}
.grp-modal-enter-from,
.grp-modal-leave-to { opacity: 0; }
.grp-modal-enter-from .grp-panel { transform: translateY(16px) scale(0.95); }
.grp-modal-leave-to .grp-panel { transform: translateY(8px) scale(0.97); }
</style>
