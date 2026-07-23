<template>
  <div class="config-view">
    <!-- 操作栏 -->
    <div class="action-bar">
      <button class="btn-p" @click="startAddProject">
        <i class="fa-solid fa-plus text-[11px]"></i>新增项目
      </button>
      <div class="flex-1"></div>
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] t3"></i>
        <input v-model="search" class="inp w-72 !pl-8" placeholder="搜索项目、配置…" />
      </div>
    </div>

    <div class="split-body">
      <!-- 左侧项目列表 -->
      <div class="w-60 flex-none">
        <div class="panel p-2">
          <div class="flex items-center justify-between px-2 pb-1.5 pt-1">
            <span class="text-[10px] font-semibold tracking-widest t3">项目</span>
            <button class="ibtn !h-5 !w-5" title="新增项目" @click="startAddProject">
              <i class="fa-solid fa-plus text-[10px]"></i>
            </button>
          </div>
          <VueDraggable
            v-model="filteredProjects"
            class="space-y-0.5"
            :animation="200"
            ghost-class="dragging"
            @end="onProjectDragEnd"
          >
            <div
              v-for="p in filteredProjects"
              :key="p.id"
              class="group flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 transition"
              :class="{ 't2': p.id !== store.selectedProjectId }"
              :style="p.id === store.selectedProjectId ? 'background:rgba(46,107,240,.09);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(46,107,240,.25)' : ''"
              @click="store.selectProject(p.id)"
            >
              <i class="fa-regular fa-folder text-xs" :style="{ color: p.id === store.selectedProjectId ? 'var(--accent)' : 'var(--ink3)' }"></i>
              <span class="flex-1 truncate text-[13px] font-medium">{{ p.name }}</span>
              <span class="mono text-[10px] t3">{{ store.configs.length }}</span>
              <button class="ibtn !h-5 !w-5 opacity-0 transition group-hover:opacity-100" title="重命名" @click.stop="startRenameProject(p)">
                <i class="fa-solid fa-pen text-[9px]"></i>
              </button>
              <button class="ibtn danger !h-5 !w-5 opacity-0 transition group-hover:opacity-100" title="删除" @click.stop="onDeleteProject(p.id)">
                <i class="fa-solid fa-xmark text-[10px]"></i>
              </button>
            </div>
          </VueDraggable>
          <div v-if="addingProject" class="px-1 py-1">
            <input
              v-model="newProjectName"
              class="inp !py-1.5 !text-xs"
              placeholder="项目名称 · 回车创建"
              @keyup.enter="commitAddProject"
              @keyup.escape="cancelAddProject"
              @blur="commitAddProject"
            />
          </div>
          <div v-if="filteredProjects.length === 0 && !addingProject" class="px-3 py-6 text-center text-xs t3">暂无项目</div>
        </div>
      </div>

      <!-- 右侧配置详情 -->
      <div class="panel min-h-[340px] flex-1 p-5">
        <template v-if="store.selectedProject">
          <div class="flex items-center gap-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-[10px]" style="background:rgba(46,107,240,.09);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(46,107,240,.2)">
              <i class="fa-regular fa-folder-open text-xs"></i>
            </span>
            <span class="text-[15px] font-semibold t1">{{ store.selectedProject.name }}</span>
            <span v-if="showSaveHint" class="ml-1 inline-flex items-center gap-1 text-[11px] font-medium" style="color:var(--ok)">
              <i class="fa-solid fa-check text-[9px]"></i>已自动保存
            </span>
            <div class="flex-1"></div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <VueDraggable
              v-model="store.configs"
              class="flex flex-wrap items-center gap-2"
              :animation="200"
              ghost-class="dragging"
              @end="onConfigDragEnd"
            >
              <span
                v-for="c in store.configs"
                :key="c.id"
                class="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border py-1.5 pl-3 pr-2 text-[12.5px] transition"
                :class="{ 'font-medium': c.id === store.selectedConfigId, 't2': c.id !== store.selectedConfigId }"
                :style="c.id === store.selectedConfigId ? 'border-color:rgba(46,107,240,.4);background:rgba(46,107,240,.08);color:var(--accent)' : 'border-color:var(--border);background:var(--panel)'"
                @click="store.selectConfig(c.id)"
              >
                {{ c.name }}
                <span class="mono text-[10px] t3">{{ c.fields.length }}</span>
                <button class="ibtn !h-4 !w-4 opacity-0 transition group-hover:opacity-100" title="重命名" @click.stop="startRenameConfig(c)">
                  <i class="fa-solid fa-pen text-[8px]"></i>
                </button>
                <button class="ibtn danger !h-4 !w-4 opacity-0 transition group-hover:opacity-100" title="删除" @click.stop="onDeleteConfig(c.id)">
                  <i class="fa-solid fa-xmark text-[9px]"></i>
                </button>
              </span>
            </VueDraggable>
            <button
              v-if="!addingConfig"
              class="inline-flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1.5 text-[12px] t3 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style="border-color:var(--border2)"
              @click="startAddConfig"
            >
              <i class="fa-solid fa-plus text-[9px]"></i>新增配置
            </button>
            <span v-else class="inline-flex items-center gap-1.5 rounded-lg border py-1.5 pl-3 pr-2 text-[12.5px]" style="border-color:var(--border);background:var(--panel)">
              <input
                v-model="newConfigName"
                class="inp !w-28 !py-0.5 !text-xs"
                placeholder="配置名 · 回车"
                @keyup.enter="commitAddConfig"
                @keyup.escape="cancelAddConfig"
                @blur="commitAddConfig"
              />
            </span>
          </div>

          <div v-if="store.selectedConfig" class="mt-4">
            <table class="w-full">
              <thead>
                <tr class="text-left text-[10.5px] font-semibold uppercase tracking-widest t3" style="border-bottom:1px solid var(--border)">
                  <th class="py-2 pr-4 font-semibold">字段标识</th>
                  <th class="px-4 py-2 font-semibold">字段名称</th>
                  <th class="px-4 py-2 font-semibold">默认值</th>
                  <th class="w-20 py-2 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(f, i) in store.selectedConfig.fields"
                  :key="i"
                  class="group"
                  style="border-bottom:1px solid var(--border)"
                >
                  <td class="py-1 pr-4">
                    <input class="finput mono" :value="f.key" @blur="onFieldBlur(i, 'key', $event)" @keydown="fieldEnter($event, $event.target)" />
                  </td>
                  <td class="px-4 py-1">
                    <input class="finput" :value="f.label" @blur="onFieldBlur(i, 'label', $event)" @keydown="fieldEnter($event, $event.target)" />
                  </td>
                  <td class="px-4 py-1">
                    <input class="finput mono" :value="f.value" @blur="onFieldBlur(i, 'value', $event)" @keydown="fieldEnter($event, $event.target)" />
                  </td>
                  <td class="py-1 text-right">
                    <div class="flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button class="ibtn !h-6 !w-6" title="复制值" @click="onCopy(f.value)">
                        <i class="fa-regular fa-copy text-[10px]"></i>
                      </button>
                      <button class="ibtn danger !h-6 !w-6" title="删除" @click="onDeleteField(i)">
                        <i class="fa-regular fa-trash-can text-[10px]"></i>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr style="border-bottom:1px solid var(--border)">
                  <td class="py-1 pr-4">
                    <input ref="nfKeyRef" v-model="nfKey" class="finput mono" placeholder="+ 字段标识" @blur="onNfBlur" @keydown="newFieldEnter($event, nfLabelRef)" />
                  </td>
                  <td class="px-4 py-1">
                    <input ref="nfLabelRef" v-model="nfLabel" class="finput" placeholder="字段名称" @blur="onNfBlur" @keydown="newFieldEnter($event, nfValueRef)" />
                  </td>
                  <td class="px-4 py-1">
                    <input ref="nfValueRef" v-model="nfValue" class="finput mono" placeholder="默认值 · 回车保存" @blur="onNfBlur" @keydown="newFieldEnter($event, null)" />
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <div class="mt-2 text-[11px] t3">
              <i class="fa-regular fa-lightbulb mr-1"></i>末行输入后回车 / 失焦即自动保存 · 点击任意单元格直接修改，失焦自动保存
            </div>
          </div>

          <div v-else class="mt-8 flex flex-col items-center justify-center py-10 t3">
            <i class="fa-regular fa-file-lines text-2xl"></i>
            <div class="mt-2 text-[13px]">点击上方「新增配置」创建第一组字段</div>
          </div>
        </template>

        <div v-else class="flex h-full min-h-[300px] flex-col items-center justify-center t3">
          <i class="fa-regular fa-folder-open text-2xl"></i>
          <div class="mt-2 text-[13px]">选择左侧项目，或点击「新增项目」开始</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useConfigStoreV3 } from '@shared/stores/configStoreV3';
import { useToastStore } from '@shared/stores/toastStore';
import type { ConfigProject, ConfigDef } from '@shared/types/entities';

const store = useConfigStoreV3();
const toast = useToastStore();

const search = ref('');

// 项目：inline 新建 / 重命名
const addingProject = ref(false);
const newProjectName = ref('');
const renamingProjectId = ref<string | null>(null);
const renamingProjectName = ref('');

// 配置：inline 新建 / 重命名
const addingConfig = ref(false);
const newConfigName = ref('');
const renamingConfigId = ref<string | null>(null);
const renamingConfigName = ref('');

// 新增字段行
const nfKey = ref('');
const nfLabel = ref('');
const nfValue = ref('');
const nfKeyRef = ref<HTMLInputElement | null>(null);
const nfLabelRef = ref<HTMLInputElement | null>(null);
const nfValueRef = ref<HTMLInputElement | null>(null);

// 自动保存提示
const showSaveHint = ref(false);
let saveTimer: number | undefined;
function showSave() {
  showSaveHint.value = true;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { showSaveHint.value = false; }, 1400);
}

onMounted(async () => { await store.loadProjects(); });

const filteredProjects = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return store.projects;
  return store.projects.filter(p =>
    p.name.toLowerCase().includes(q)
  );
});

// 切换项目 / 配置时重置 inline 编辑态
watch(() => store.selectedProjectId, resetInline);
watch(() => store.selectedConfigId, () => { resetNf(); });

function resetInline() {
  addingProject.value = false;
  newProjectName.value = '';
  renamingProjectId.value = null;
  addingConfig.value = false;
  newConfigName.value = '';
  renamingConfigId.value = null;
  resetNf();
}

function resetNf() {
  nfKey.value = '';
  nfLabel.value = '';
  nfValue.value = '';
}

/* ---------- 项目拖拽 ---------- */
async function onProjectDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
  const newList = [...filteredProjects.value];
  const [moved] = newList.splice(oldIndex, 1);
  newList.splice(newIndex, 0, moved);
  const orderedIds = newList.map(p => p.id);
  await store.reorderProjects(orderedIds);
  toast.success('项目排序已更新');
}

/* ---------- 配置拖拽 ---------- */
async function onConfigDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
  const newList = [...store.configs];
  const [moved] = newList.splice(oldIndex, 1);
  newList.splice(newIndex, 0, moved);
  const orderedIds = newList.map(c => c.id);
  if (store.selectedProjectId) {
    await store.reorderConfigs(store.selectedProjectId, orderedIds);
    toast.success('配置排序已更新');
  }
}

/* ---------- 项目 ---------- */
function startAddProject() {
  addingProject.value = true;
  newProjectName.value = '';
  nextTick(() => {});
}
async function commitAddProject() {
  if (!addingProject.value) return;
  const name = newProjectName.value.trim();
  addingProject.value = false;
  newProjectName.value = '';
  if (!name) return;
  await store.createProject(name);
  toast.success('项目已创建');
}
function cancelAddProject() { addingProject.value = false; newProjectName.value = ''; }

function startRenameProject(p: ConfigProject) {
  renamingProjectId.value = p.id;
  renamingProjectName.value = p.name;
}
async function onDeleteProject(id: string) {
  await store.deleteProject(id);
  toast.success('项目已删除');
}

/* ---------- 配置 ---------- */
function startAddConfig() {
  if (!store.selectedProject) { toast.error('请先创建一个项目'); return; }
  addingConfig.value = true;
  newConfigName.value = '';
}
async function commitAddConfig() {
  if (!addingConfig.value) return;
  const name = newConfigName.value.trim();
  addingConfig.value = false;
  newConfigName.value = '';
  if (!name || !store.selectedProject) return;
  await store.addConfig(store.selectedProject.id, name);
  toast.success('配置已创建');
}
function cancelAddConfig() { addingConfig.value = false; newConfigName.value = ''; }

function startRenameConfig(c: ConfigDef) {
  renamingConfigId.value = c.id;
  renamingConfigName.value = c.name;
}
async function onDeleteConfig(id: string) {
  await store.deleteConfig(id);
  toast.success('配置已删除');
}

/* ---------- 字段（自动保存） ---------- */
async function onFieldBlur(i: number, prop: 'key' | 'label' | 'value', e: Event) {
  const cfg = store.selectedConfig;
  if (!cfg) return;
  const val = (e.target as HTMLInputElement).value;
  const cur = cfg.fields[i];
  if (!cur || (cur as any)[prop] === val) return;
  const fields = cfg.fields.map(f => ({ ...f }));
  (fields[i] as any)[prop] = val;
  await store.setFields(cfg.id, fields);
  showSave();
}
function fieldEnter(e: KeyboardEvent, el: EventTarget | null) {
  if (e.key === 'Enter') {
    e.preventDefault();
    (el as HTMLInputElement | null)?.blur();
  }
}
function newFieldEnter(e: KeyboardEvent, next: HTMLInputElement | null) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (next) { next.focus(); return; }
  commitNewField(true);
}
function onNfBlur() {
  window.setTimeout(() => {
    const ae = document.activeElement;
    if (ae === nfKeyRef.value || ae === nfLabelRef.value || ae === nfValueRef.value) return;
    commitNewField(false);
  }, 0);
}
async function commitNewField(refocus: boolean) {
  const key = nfKey.value.trim();
  const cfg = store.selectedConfig;
  resetNf();
  if (!key || !cfg) return;
  const fields = [...cfg.fields, { key, label: nfLabel.value.trim(), value: nfValue.value }];
  await store.setFields(cfg.id, fields);
  showSave();
  if (refocus) nextTick(() => nfKeyRef.value?.focus());
}
async function onDeleteField(i: number) {
  const cfg = store.selectedConfig;
  if (!cfg) return;
  const fields = cfg.fields.filter((_, idx) => idx !== i);
  await store.setFields(cfg.id, fields);
  showSave();
}
async function onCopy(value?: string) {
  if (!value) return;
  await store.copyValue(value);
  toast.success('字段值已复制');
}
</script>

<style scoped>
.config-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px 24px calc(32px + 24px);
  gap: 16px;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.split-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  overflow: hidden;
}

.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}
</style>
