<template>
  <div class="config-view">
    <div class="action-bar">
      <button class="btn-p" @click="startAddProject"><i class="fa-solid fa-plus"></i>新增项目</button>
      <div class="flex-1"></div>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" class="search-input" placeholder="搜索项目、配置…" />
      </div>
    </div>

    <div class="split-body">
      <!-- 项目列表 -->
      <div class="left-panel panel">
        <div class="left-head">
          <span class="left-head-title">项目</span>
          <button class="ibtn small" title="新增项目" @click="startAddProject"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="left-list">
          <template v-for="p in filteredProjects" :key="p.id">
            <div
              v-if="renamingProjectId !== p.id"
              class="proj-item group"
              :class="{ active: p.id === store.selectedProjectId }"
              @click="store.selectProject(p.id)"
            >
              <i class="fa-regular fa-folder proj-icon" :class="{ on: p.id === store.selectedProjectId }"></i>
              <span class="proj-name">{{ p.name }}</span>
              <span class="proj-count mono">{{ p.configs.length }}</span>
              <button class="ibtn tiny" title="重命名" @click.stop="startRenameProject(p)"><i class="fa-solid fa-pen"></i></button>
              <button class="ibtn tiny danger" title="删除" @click.stop="onDeleteProject(p.id)"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div v-else class="proj-item renaming">
              <input
                v-focus
                class="inp rename-inp"
                :value="renamingProjectName"
                @input="renamingProjectName = ($event.target as HTMLInputElement).value"
                @keyup.enter="commitRenameProject"
                @keyup.escape="cancelRenameProject"
                @blur="commitRenameProject"
              />
            </div>
          </template>
          <div v-if="addingProject" class="proj-item adding">
            <input
              v-focus
              class="inp rename-inp"
              v-model="newProjectName"
              placeholder="项目名称 · 回车创建"
              @keyup.enter="commitAddProject"
              @keyup.escape="cancelAddProject"
              @blur="commitAddProject"
            />
          </div>
          <div v-if="filteredProjects.length === 0 && !addingProject" class="empty-left">暂无项目</div>
        </div>
      </div>

      <!-- 配置详情 -->
      <div class="right-panel panel">
        <template v-if="store.selectedProject">
          <div class="right-head">
            <span class="head-icon"><i class="fa-regular fa-folder-open"></i></span>
            <span class="head-title">{{ store.selectedProject.name }}</span>
            <span class="save-hint" :class="{ show: showSave }"><i class="fa-solid fa-check"></i>已自动保存</span>
          </div>

          <div class="cfg-chips">
            <template v-for="c in store.selectedProject.configs" :key="c.id">
              <span
                v-if="renamingConfigId !== c.id"
                class="cfg-chip group"
                :class="{ active: c.id === store.selectedConfigId }"
                @click="store.selectConfig(c.id)"
              >
                {{ c.name }}
                <span class="cfg-count mono">{{ c.fields.length }}</span>
                <button class="ibtn micro" title="重命名" @click.stop="startRenameConfig(c)"><i class="fa-solid fa-pen"></i></button>
                <button class="ibtn micro danger" title="删除" @click.stop="onDeleteConfig(c.id)"><i class="fa-solid fa-xmark"></i></button>
              </span>
              <span v-else class="cfg-chip renaming">
                <input
                  v-focus
                  class="inp rename-inp"
                  :value="renamingConfigName"
                  @input="renamingConfigName = ($event.target as HTMLInputElement).value"
                  @keyup.enter="commitRenameConfig"
                  @keyup.escape="cancelRenameConfig"
                  @blur="commitRenameConfig"
                />
              </span>
            </template>
            <button v-if="!addingConfig" class="cfg-add" @click="startAddConfig"><i class="fa-solid fa-plus"></i>新增配置</button>
            <span v-else class="cfg-chip adding">
              <input
                v-focus
                class="inp rename-inp cfg-rename-inp"
                v-model="newConfigName"
                placeholder="配置名 · 回车"
                @keyup.enter="commitAddConfig"
                @keyup.escape="cancelAddConfig"
                @blur="commitAddConfig"
              />
            </span>
          </div>

          <div class="field-area">
            <template v-if="store.selectedConfig">
              <table class="field-table">
                <thead>
                  <tr>
                    <th>字段标识</th>
                    <th>字段名称</th>
                    <th>默认值</th>
                    <th class="ops-col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(f, i) in store.selectedConfig.fields" :key="i" class="field-row group">
                    <td><input class="finput mono" :value="f.key" @blur="onFieldBlur(i, 'key', $event)" @keydown="fieldEnter($event, $event.target)" /></td>
                    <td><input class="finput" :value="f.label" @blur="onFieldBlur(i, 'label', $event)" @keydown="fieldEnter($event, $event.target)" /></td>
                    <td><input class="finput mono" :value="f.value" @blur="onFieldBlur(i, 'value', $event)" @keydown="fieldEnter($event, $event.target)" /></td>
                    <td class="ops-col">
                      <div class="row-icons">
                        <button class="ibtn tiny" title="复制值" @click="onCopy(f.value)"><i class="fa-regular fa-copy"></i></button>
                        <button class="ibtn tiny danger" title="删除" @click="onDeleteField(i)"><i class="fa-regular fa-trash-can"></i></button>
                      </div>
                    </td>
                  </tr>
                  <tr class="field-row new-row">
                    <td><input ref="nfKeyRef" v-model="nfKey" class="finput mono" placeholder="+ 字段标识" @blur="onNfBlur" @keydown="newFieldEnter($event, nfLabelRef)" /></td>
                    <td><input ref="nfLabelRef" v-model="nfLabel" class="finput" placeholder="字段名称" @blur="onNfBlur" @keydown="newFieldEnter($event, nfValueRef)" /></td>
                    <td><input ref="nfValueRef" v-model="nfValue" class="finput mono" placeholder="默认值 · 回车保存" @blur="onNfBlur" @keydown="newFieldEnter($event, null)" /></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              <div class="field-hint"><i class="fa-regular fa-lightbulb"></i>末行输入后回车 / 失焦即自动保存 · 点击任意单元格直接修改，失焦自动保存</div>
            </template>
            <div v-else class="empty-config">
              <i class="fa-regular fa-file-lines"></i>
              <p>点击上方「新增配置」创建第一组字段</p>
            </div>
          </div>
        </template>
        <div v-else class="empty-right">
          <i class="fa-regular fa-folder-open"></i>
          <p>选择左侧项目，或点击「新增项目」开始</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useConfigStore } from '@shared/stores/configStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { ConfigDef } from '@shared/types/entities';

const store = useConfigStore();
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
const showSave = ref(false);
let saveTimer: number | undefined;
function showSaveHint() {
  showSave.value = true;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { showSave.value = false; }, 1400);
}

// v-focus：inline 输入挂载即聚焦并选中
const vFocus = { mounted: (el: HTMLInputElement) => { el.focus(); el.select(); } };

onMounted(async () => { await store.load(); });

const filteredProjects = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return store.list;
  return store.list.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.configs.some(c => c.name.toLowerCase().includes(q))
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

function startRenameProject(p: { id: string; name: string }) {
  renamingProjectId.value = p.id;
  renamingProjectName.value = p.name;
}
function cancelRenameProject() { renamingProjectId.value = null; renamingProjectName.value = ''; }
async function commitRenameProject() {
  const id = renamingProjectId.value;
  const name = renamingProjectName.value.trim();
  renamingProjectId.value = null;
  if (!id || !name) { renamingProjectName.value = ''; return; }
  const cur = store.list.find(p => p.id === id);
  if (cur && name !== cur.name) {
    await store.renameProject(id, name);
    toast.success('已重命名');
  }
  renamingProjectName.value = '';
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
function cancelRenameConfig() { renamingConfigId.value = null; renamingConfigName.value = ''; }
async function commitRenameConfig() {
  const id = renamingConfigId.value;
  const name = renamingConfigName.value.trim();
  renamingConfigId.value = null;
  const proj = store.selectedProject;
  if (!id || !name || !proj) { renamingConfigName.value = ''; return; }
  const cur = proj.configs.find(c => c.id === id);
  if (cur && name !== cur.name) {
    await store.renameConfig(proj.id, id, name);
    toast.success('已重命名');
  }
  renamingConfigName.value = '';
}
async function onDeleteConfig(id: string) {
  const proj = store.selectedProject;
  if (!proj) return;
  await store.deleteConfig(proj.id, id);
  toast.success('配置已删除');
}

/* ---------- 字段（自动保存） ---------- */
async function onFieldBlur(i: number, prop: 'key' | 'label' | 'value', e: Event) {
  const proj = store.selectedProject;
  const cfg = store.selectedConfig;
  if (!proj || !cfg) return;
  const val = (e.target as HTMLInputElement).value;
  const cur = cfg.fields[i];
  if (!cur || (cur as any)[prop] === val) return;
  const fields = cfg.fields.map(f => ({ ...f }));
  (fields[i] as any)[prop] = val;
  await store.setFields(proj.id, cfg.id, fields);
  showSaveHint();
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
  // 失焦时若焦点移到同行其它输入则不提交
  window.setTimeout(() => {
    const ae = document.activeElement;
    if (ae === nfKeyRef.value || ae === nfLabelRef.value || ae === nfValueRef.value) return;
    commitNewField(false);
  }, 0);
}
async function commitNewField(refocus: boolean) {
  const key = nfKey.value.trim();
  const proj = store.selectedProject;
  const cfg = store.selectedConfig;
  resetNf();
  if (!key || !proj || !cfg) return;
  const fields = [...cfg.fields, { key, label: nfLabel.value.trim(), value: nfValue.value }];
  await store.setFields(proj.id, cfg.id, fields);
  showSaveHint();
  if (refocus) nextTick(() => nfKeyRef.value?.focus());
}
async function onDeleteField(i: number) {
  const proj = store.selectedProject;
  const cfg = store.selectedConfig;
  if (!proj || !cfg) return;
  const fields = cfg.fields.filter((_, idx) => idx !== i);
  await store.setFields(proj.id, cfg.id, fields);
  showSaveHint();
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
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  gap: var(--gap-lg);
}

.action-bar {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  flex-shrink: 0;
}
.action-bar .flex-1 { flex: 1; }
.action-bar .search-wrap { width: 280px; }

.split-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--gap-lg);
  overflow: hidden;
}

/* 项目列表 */
.left-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--gap-sm);
}
.left-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px var(--gap-sm) 6px;
}
.left-head-title {
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: .14em;
  color: var(--ink3);
  text-transform: uppercase;
}
.left-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ibtn.small { width: 20px; height: 20px; border-radius: 6px; }
.ibtn.tiny { width: 20px; height: 20px; border-radius: 6px; }
.ibtn.tiny i { font-size: 9px; }
.ibtn.micro { width: 16px; height: 16px; border-radius: 5px; }
.ibtn.micro i { font-size: 8px; }

.proj-item {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--ink2);
  transition: var(--transition-fast);
}
.proj-item:hover { background: var(--panel2); color: var(--ink); }
.proj-item.active {
  background: rgba(46,107,240,.09);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(46,107,240,.25);
}
.proj-icon { font-size: var(--text-xs); color: var(--ink3); }
.proj-icon.on { color: var(--accent); }
.proj-name {
  flex: 1;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.proj-count { font-size: 10px; color: var(--ink3); }
.proj-item .ibtn { opacity: 0; transition: var(--transition-fast); }
.proj-item:hover .ibtn, .proj-item.active .ibtn { opacity: 1; }
.proj-item.renaming, .proj-item.adding { padding: 4px 6px; cursor: default; }
.rename-inp { padding: 6px 10px; font-size: 12px; }
.empty-left {
  padding: 28px 0;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--ink3);
}

/* 右侧详情 */
.right-panel {
  display: flex;
  flex-direction: column;
  min-height: 340px;
  overflow: hidden;
  padding: var(--gap-xl);
}
.empty-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  color: var(--ink3);
}
.empty-right i { font-size: 26px; }
.empty-right p { margin: 0; font-size: var(--text-sm); }

.right-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.head-icon {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: rgba(46,107,240,.09);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(46,107,240,.2);
  font-size: var(--text-xs);
}
.head-title { font-size: var(--text-md); font-weight: var(--font-semibold); color: var(--ink); }
.save-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
  font-size: 11px;
  font-weight: var(--font-medium);
  color: var(--ok);
  opacity: 0;
  transition: opacity .3s;
}
.save-hint.show { opacity: 1; }
.save-hint i { font-size: 9px; }

.cfg-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--gap-sm);
  margin-top: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.cfg-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--ink2);
  font-size: 12.5px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.cfg-chip:hover { color: var(--ink); border-color: var(--border-strong); }
.cfg-chip.active {
  border-color: rgba(46,107,240,.4);
  background: rgba(46,107,240,.08);
  color: var(--accent);
  font-weight: var(--font-medium);
}
.cfg-count { font-size: 10px; color: var(--ink3); }
.cfg-chip .ibtn { opacity: 0; transition: var(--transition-fast); }
.cfg-chip:hover .ibtn, .cfg-chip.active .ibtn { opacity: 1; }
.cfg-chip.renaming, .cfg-chip.adding { padding: 2px; cursor: default; }
.cfg-rename-inp { width: 128px; }
.cfg-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-strong);
  background: transparent;
  color: var(--ink3);
  font-size: 12px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.cfg-add:hover { border-color: var(--accent); color: var(--accent); }
.cfg-add i { font-size: 9px; }

.field-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-top: var(--gap-md);
}
.field-table { width: 100%; border-collapse: collapse; }
.field-table thead th {
  text-align: left;
  font-size: 10.5px;
  font-weight: var(--font-semibold);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--ink3);
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.field-table thead th:nth-child(2),
.field-table thead th:nth-child(3) { padding-left: var(--gap-md); padding-right: var(--gap-md); }
.field-table thead th.ops-col { width: 80px; text-align: right; }
.field-row { border-bottom: 1px solid var(--border); }
.field-row:hover { background: rgba(46,107,240,.035); }
.field-row td { padding: 4px 0; }
.field-row td:nth-child(2),
.field-row td:nth-child(3) { padding-left: var(--gap-md); padding-right: var(--gap-md); }
.field-row td.ops-col { text-align: right; }
.row-icons { display: flex; justify-content: flex-end; gap: 2px; opacity: 0; transition: var(--transition-fast); }
.field-row:hover .row-icons { opacity: 1; }
.field-hint {
  margin-top: var(--gap-sm);
  font-size: 11px;
  color: var(--ink3);
}
.field-hint i { margin-right: 4px; }

.empty-config {
  margin-top: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  color: var(--ink3);
}
.empty-config i { font-size: 26px; }
.empty-config p { margin: 0; font-size: var(--text-sm); }

:deep(.finput.mono) { font-family: var(--font-mono); }
</style>
