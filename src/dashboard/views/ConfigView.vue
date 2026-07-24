<template>
  <div class="config-view">
    <!-- 操作栏 -->
    <div class="action-bar">
      <button class="btn-p" @click="startAddProject">
        <i class="fa-solid fa-plus"></i>新增分组
      </button>
      <div class="flex-spacer"></div>
      <div class="search-field">
        <i class="fa-solid fa-magnifying-glass search-ico t3"></i>
        <input v-model="search" class="inp search-inp" placeholder="搜索分组、配置…" />
      </div>
    </div>

    <div class="split-body">
      <!-- 左侧分组列表 -->
      <div class="sidebar">
        <div class="panel proj-panel">
          <div class="proj-panel-head">
            <span class="proj-panel-title t3">分组</span>
            <button class="ibtn ibtn-mini" title="新增分组" @click="startAddProject">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
          <VueDraggable
            v-model="filteredProjects"
            class="proj-list"
            :animation="200"
            ghost-class="dragging"
            :filter="'input'"
            :prevent-on-filter="false"
            @end="onProjectDragEnd"
          >
            <div
              v-for="p in filteredProjects"
              :key="p.id"
              class="proj-item"
              :class="{ active: p.id === store.selectedProjectId }"
              @click="store.selectProject(p.id)"
            >
              <i class="fa-regular fa-folder proj-folder" :style="{ color: p.id === store.selectedProjectId ? 'var(--accent)' : 'var(--ink3)' }"></i>
              <template v-if="renamingProjectId === p.id">
                <input
                  ref="renamingProjectInput"
                  v-model="renamingProjectName"
                  class="inp proj-rename-inp"
                  @click.stop
                  @keyup.enter="commitRenameProject(true)"
                  @keyup.escape="commitRenameProject(false)"
                  @blur="commitRenameProject(true)"
                />
              </template>
              <template v-else>
                <span class="proj-name" @dblclick.stop="startRenameProject(p)" title="双击重命名">{{ p.name }}</span>
                <span class="proj-count t3">{{ store.configs.length }}</span>
                <button class="ibtn ibtn-mini proj-act" title="重命名" @click.stop="startRenameProject(p)">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="ibtn ibtn-mini danger proj-act" title="删除" @click.stop="onDeleteProject(p.id)">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </template>
            </div>
          </VueDraggable>
          <div v-if="filteredProjects.length === 0" class="proj-empty t3">暂无分组</div>
        </div>
      </div>

      <!-- 右侧配置详情 -->
      <div class="panel config-detail">
        <template v-if="store.selectedProject">
          <div class="detail-head">
            <span class="detail-icon"><i class="fa-regular fa-folder-open"></i></span>
            <span class="detail-title t1">{{ store.selectedProject.name }}</span>
            <span v-if="showSaveHint" class="save-hint">
              <i class="fa-solid fa-check"></i>已自动保存
            </span>
            <div class="flex-spacer"></div>
          </div>

          <div class="cfg-chips">
            <VueDraggable
              v-model="store.configs"
              class="cfg-chips-drag"
              :animation="200"
              ghost-class="dragging"
              :filter="'input'"
              :prevent-on-filter="false"
              @end="onConfigDragEnd"
            >
              <span
                v-for="c in store.configs"
                :key="c.id"
                class="cfg-chip"
                :class="{ active: c.id === store.selectedConfigId }"
                @click="store.selectConfig(c.id)"
              >
                <template v-if="renamingConfigId === c.id">
                  <input
                    ref="renamingConfigInput"
                    v-model="renamingConfigName"
                    class="inp cfg-rename-inp"
                    @click.stop
                    @keyup.enter="commitRenameConfig(true)"
                    @keyup.escape="commitRenameConfig(false)"
                    @blur="commitRenameConfig(true)"
                  />
                </template>
                <template v-else>
                  <span class="cfg-chip-name" @dblclick.stop="startRenameConfig(c)" title="双击重命名">{{ c.name }}</span>
                  <span class="cfg-chip-count t3">{{ c.fields.length }}</span>
                  <button class="ibtn ibtn-tiny cfg-chip-act" title="重命名" @click.stop="startRenameConfig(c)">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="ibtn ibtn-tiny danger cfg-chip-act" title="删除" @click.stop="onDeleteConfig(c.id)">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </template>
              </span>
            </VueDraggable>
            <button
              v-if="!addingConfig"
              class="cfg-add-chip"
              @click="startAddConfig"
            >
              <i class="fa-solid fa-plus"></i>新增配置
            </button>
            <span v-else class="cfg-chip-add-wrap">
              <input
                v-model="newConfigName"
                class="inp cfg-chip-add-inp"
                placeholder="配置名 · 回车"
                @keyup.enter="commitAddConfig"
                @keyup.escape="cancelAddConfig"
                @blur="commitAddConfig"
              />
            </span>
          </div>

          <div v-if="store.selectedConfig" class="field-table-wrap">
            <table class="field-table">
              <thead>
                <tr class="field-head t3">
                  <th class="fh-key">字段标识</th>
                  <th class="fh-label">字段名称</th>
                  <th class="fh-value">默认值</th>
                  <th class="fh-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(f, i) in store.selectedConfig.fields"
                  :key="i"
                  class="field-row"
                >
                  <td class="fc-key">
                    <input class="finput mono" :value="f.key" @blur="onFieldBlur(i, 'key', $event)" @keydown="fieldEnter($event, $event.target)" />
                  </td>
                  <td class="fc-label">
                    <input class="finput" :value="f.label" @blur="onFieldBlur(i, 'label', $event)" @keydown="fieldEnter($event, $event.target)" />
                  </td>
                  <td class="fc-value">
                    <input class="finput mono" :value="f.value" @blur="onFieldBlur(i, 'value', $event)" @keydown="fieldEnter($event, $event.target)" />
                  </td>
                  <td class="fc-actions">
                    <div class="field-actions">
                      <button class="ibtn ibtn-sm" title="复制值" @click="onCopy(f.value)">
                        <i class="fa-regular fa-copy"></i>
                      </button>
                      <button class="ibtn ibtn-sm danger" title="删除" @click="onDeleteField(i)">
                        <i class="fa-regular fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr class="field-row">
                  <td class="fc-key">
                    <input ref="nfKeyRef" v-model="nfKey" class="finput mono" placeholder="+ 字段标识" @blur="onNfBlur" @keydown="newFieldEnter($event, nfLabelRef)" />
                  </td>
                  <td class="fc-label">
                    <input ref="nfLabelRef" v-model="nfLabel" class="finput" placeholder="字段名称" @blur="onNfBlur" @keydown="newFieldEnter($event, nfValueRef)" />
                  </td>
                  <td class="fc-value">
                    <input ref="nfValueRef" v-model="nfValue" class="finput mono" placeholder="默认值 · 回车保存" @blur="onNfBlur" @keydown="newFieldEnter($event, null)" />
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <div class="field-hint t3">
              <i class="fa-regular fa-lightbulb"></i>末行输入后回车 / 失焦即自动保存 · 点击任意单元格直接修改，失焦自动保存
            </div>
          </div>

          <div v-else class="no-config t3">
            <i class="fa-regular fa-file-lines no-config-icon"></i>
            <div class="no-config-text">点击上方「新增配置」创建第一组字段</div>
          </div>
        </template>

        <div v-else class="no-project t3">
          <i class="fa-regular fa-folder-open no-project-icon"></i>
          <div class="no-project-text">选择左侧分组，或点击「新增分组」开始</div>
        </div>
      </div>
    </div>

    <!-- 新增分组弹窗 -->
    <teleport to="body">
      <Transition name="cfg-modal">
        <div v-if="projectModalOpen" class="proj-modal-overlay" @click.self="cancelProjectModal">
          <div class="proj-modal panel-solid" role="dialog" aria-modal="true">
            <div class="proj-modal-head">
              <h2>新增分组</h2>
              <button class="ibtn" type="button" @click="cancelProjectModal" aria-label="关闭">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div class="proj-modal-body">
              <label class="proj-lbl">分组名称</label>
              <input
                ref="projectNameInput"
                v-model="projectModalName"
                class="inp"
                placeholder="如：cors国内"
                @keyup.enter="confirmProjectModal"
                @keyup.escape="cancelProjectModal"
              />
            </div>
            <div class="proj-modal-foot">
              <button class="btn-g" type="button" @click="cancelProjectModal">取消</button>
              <button class="btn-p" type="button" @click="confirmProjectModal">
                <i class="fa-solid fa-check"></i>创建
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </teleport>
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

// 分组：弹窗新建 / 重命名
const projectModalOpen = ref(false);
const projectModalName = ref('');
const projectNameInput = ref<HTMLInputElement | null>(null);
const renamingProjectId = ref<string | null>(null);
const renamingProjectName = ref('');
const renamingProjectInput = ref<HTMLInputElement | null>(null);

// 配置：inline 新建 / 重命名
const addingConfig = ref(false);
const newConfigName = ref('');
const renamingConfigId = ref<string | null>(null);
const renamingConfigName = ref('');
const renamingConfigInput = ref<HTMLInputElement | null>(null);

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

// 切换分组 / 配置时重置 inline 编辑态
watch(() => store.selectedProjectId, resetInline);
watch(() => store.selectedConfigId, () => { resetNf(); });

function resetInline() {
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

/* ---------- 分组拖拽 ---------- */
async function onProjectDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
  const newList = [...filteredProjects.value];
  const [moved] = newList.splice(oldIndex, 1);
  newList.splice(newIndex, 0, moved);
  const orderedIds = newList.map(p => p.id);
  await store.reorderProjects(orderedIds);
  toast.success('分组排序已更新');
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

/* ---------- 分组 ---------- */
function startAddProject() {
  projectModalOpen.value = true;
  projectModalName.value = '';
  nextTick(() => projectNameInput.value?.focus());
}
function cancelProjectModal() {
  projectModalOpen.value = false;
  projectModalName.value = '';
}
async function confirmProjectModal() {
  const name = projectModalName.value.trim();
  if (!name) { toast.error('请填写分组名称'); return; }
  projectModalOpen.value = false;
  projectModalName.value = '';
  await store.createProject(name);
  toast.success('分组已创建');
}

function startRenameProject(p: ConfigProject) {
  renamingProjectId.value = p.id;
  renamingProjectName.value = p.name;
  nextTick(() => {
    renamingProjectInput.value?.focus();
    renamingProjectInput.value?.select();
  });
}
async function commitRenameProject(save: boolean) {
  const id = renamingProjectId.value;
  if (!id) return;
  const name = renamingProjectName.value.trim();
  renamingProjectId.value = null;
  renamingProjectName.value = '';
  if (!save || !name) return;
  const p = store.projects.find(x => x.id === id);
  if (p && p.name !== name) {
    await store.renameProject(id, name);
    toast.success('分组已重命名');
  }
}
async function onDeleteProject(id: string) {
  await store.deleteProject(id);
  toast.success('分组已删除');
}

/* ---------- 配置 ---------- */
function startAddConfig() {
  if (!store.selectedProject) { toast.error('请先创建一个分组'); return; }
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
  nextTick(() => {
    renamingConfigInput.value?.focus();
    renamingConfigInput.value?.select();
  });
}
async function commitRenameConfig(save: boolean) {
  const id = renamingConfigId.value;
  if (!id) return;
  const name = renamingConfigName.value.trim();
  renamingConfigId.value = null;
  renamingConfigName.value = '';
  if (!save || !name) return;
  const c = store.configs.find(x => x.id === id);
  if (c && c.name !== name) {
    await store.renameConfig(id, name);
    toast.success('配置已重命名');
  }
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
let committingField = false;
async function commitNewField(refocus: boolean) {
  if (committingField) return;
  const cfg = store.selectedConfig;
  if (!cfg) { resetNf(); return; }
  // 先读取三列的值，再清空，避免 resetNf() 把 label/value 清掉导致只存到 key
  const key = nfKey.value.trim();
  const label = nfLabel.value.trim();
  const value = nfValue.value;
  if (!key) { resetNf(); return; }
  committingField = true;
  resetNf();
  try {
    const fields = [...cfg.fields, { key, label, value }];
    await store.setFields(cfg.id, fields);
    showSave();
    if (refocus) nextTick(() => nfKeyRef.value?.focus());
  } finally {
    committingField = false;
  }
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
  overflow: hidden;
  padding: 20px 24px calc(var(--statusbar-h) + 24px);
  gap: 16px;
}

/* 操作栏 */
.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.flex-spacer { flex: 1; min-width: 0; }
.btn-p i { font-size: 11px; }

.search-field {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.search-ico {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  pointer-events: none;
}
.search-inp {
  width: 288px;
  padding-left: 32px;
}

/* 分栏主体（v3 flex gap-4，左 w-60 右 flex-1） */
.split-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
  overflow: hidden;
}
.sidebar { width: 240px; flex: none; min-height: 0; display: flex; }

/* 分组面板 —— 与右侧详情面板等高、铺满内容区，超出在面板内滚动 */
.proj-panel {
  padding: 8px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.proj-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 6px;
  flex-shrink: 0;
}
.proj-panel-title {
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.16em;
}
.ibtn-mini { width: 20px; height: 20px; }
.ibtn-mini i { font-size: 10px; }

.proj-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.proj-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  color: var(--ink2);
}
.proj-item:hover { background: var(--panel2); }
.proj-item.active {
  background: rgba(46, 107, 240, .09);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(46, 107, 240, .25);
}
.proj-folder { font-size: var(--text-xs); flex-shrink: 0; }
.proj-name {
  flex: 1;
  font-size: 13px;
  font-weight: var(--font-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.proj-rename-inp {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  font-size: 13px;
}
.proj-count {
  font-family: var(--font-mono);
  font-size: 10px;
}
.proj-act {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.proj-item:hover .proj-act { opacity: 1; }

.proj-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: var(--text-xs);
}

/* 配置详情面板（v3 panel min-h-[340px] flex-1 p-5） */
.config-detail {
  flex: 1;
  min-height: 340px;
  padding: 20px;
  overflow: auto;
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.detail-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(46, 107, 240, .09);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(46, 107, 240, .2);
}
.detail-icon i { font-size: var(--text-xs); }
.detail-title {
  font-size: 15px;
  font-weight: var(--font-semibold);
}
.save-hint {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: var(--font-medium);
  color: var(--ok);
}
.save-hint i { font-size: 9px; }

/* 配置 chips */
.cfg-chips {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.cfg-chips-drag {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.cfg-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  padding: 6px 8px 6px 12px;
  font-size: 12.5px;
  color: var(--ink2);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.cfg-chip:hover { border-color: var(--border-strong); }
.cfg-chip.active {
  font-weight: var(--font-medium);
  color: var(--accent);
  background: rgba(46, 107, 240, .08);
  border-color: rgba(46, 107, 240, .4);
}
.cfg-chip-count {
  font-family: var(--font-mono);
  font-size: 10px;
}
.cfg-chip-act { opacity: 0; transition: opacity 0.15s ease; }
.cfg-chip:hover .cfg-chip-act { opacity: 1; }
.ibtn-tiny { width: 16px; height: 16px; }
.ibtn-tiny i { font-size: 8px; }

.cfg-add-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  border: 1px dashed var(--border2);
  background: transparent;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--ink3);
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.cfg-add-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.cfg-add-chip i { font-size: 9px; }
.cfg-chip-add-wrap {
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  padding: 6px 8px 6px 12px;
  font-size: 12.5px;
}
.cfg-chip-add-inp {
  width: 112px;
  padding: 2px 12px;
  font-size: var(--text-xs);
}
.cfg-rename-inp {
  width: 110px;
  height: 24px;
  padding: 0 8px;
  font-size: 12.5px;
}

/* 字段表 */
.field-table-wrap { margin-top: 16px; }
.field-table {
  width: 100%;
  border-collapse: collapse;
}
.field-head {
  border-bottom: 1px solid var(--border);
}
.field-head th {
  text-align: left;
  padding: 8px 0;
  font-size: 10.5px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.fh-key { padding-right: 16px; }
.fh-label { padding: 8px 16px; }
.fh-value { padding: 8px 16px; }
.fh-actions { width: 80px; padding: 8px 0; text-align: right; }

.field-row { border-bottom: 1px solid var(--border); }
.fc-key { padding-right: 16px; }
.fc-label { padding: 4px 16px; }
.fc-value { padding: 4px 16px; }
.fc-actions { padding: 4px 0; text-align: right; }

.field-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.field-row:hover .field-actions { opacity: 1; }
.ibtn-sm { width: 24px; height: 24px; }
.ibtn-sm i { font-size: 10px; }

.field-hint {
  margin-top: 8px;
  font-size: 11px;
}
.field-hint i { margin-right: 4px; }

/* 无配置 / 无分组 */
.no-config {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}
.no-config-icon { font-size: 24px; }
.no-config-text { margin-top: 8px; font-size: 13px; }

.no-project {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.no-project-icon { font-size: 24px; }
.no-project-text { margin-top: 8px; font-size: 13px; }

/* 拖拽 */
.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}

/* ================= 新增分组弹窗 ================= */
.proj-modal-overlay {
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
.proj-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  border-radius: var(--radius-2xl);
  box-shadow: 0 24px 70px -16px var(--shadow-pop), 0 0 40px -16px var(--glow);
}
.proj-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
}
.proj-modal-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: var(--font-semibold);
  color: var(--ink);
}
.proj-modal-body {
  padding: 4px 20px 16px;
}
.proj-lbl {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: var(--font-medium);
  color: var(--ink2);
}
.proj-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
.proj-modal-foot .btn-p i { font-size: 11px; }

/* 弹窗过渡 */
.cfg-modal-enter-active { transition: opacity 0.18s ease; }
.cfg-modal-leave-active { transition: opacity 0.16s ease; }
.cfg-modal-enter-active .proj-modal {
  transition: transform 0.3s cubic-bezier(0.3, 1.3, 0.45, 1), opacity 0.3s ease;
}
.cfg-modal-leave-active .proj-modal {
  transition: transform 0.16s ease, opacity 0.16s ease;
}
.cfg-modal-enter-from,
.cfg-modal-leave-to { opacity: 0; }
.cfg-modal-enter-from .proj-modal { transform: translateY(16px) scale(0.95); }
.cfg-modal-leave-to .proj-modal { transform: translateY(8px) scale(0.97); }
</style>
