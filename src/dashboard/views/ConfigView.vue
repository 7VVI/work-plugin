<template>
  <div class="config-view">
    <div class="split-body">
      <!-- 左侧树形菜单 -->
      <div class="sidebar">
        <div class="sidebar-head">
          <span class="sidebar-title"><i class="fa-solid fa-sliders"></i> 配置中心</span>
          <button class="ibtn ibtn-mini" title="新增分组" @click="startAddProject">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <div class="tree-wrap">
          <VueDraggable
            :model-value="filteredProjects"
            class="tree-project-list"
            :animation="200"
            ghost-class="dragging"
            handle=".tree-project"
            :filter="'.tree-act, .tree-rename-inp'"
            :prevent-on-filter="false"
            :disabled="!!search.trim()"
            @end="onProjectDragEnd"
          >
            <div v-for="p in filteredProjects" :key="p.id" class="tree-group" :data-project-id="p.id">
              <!-- 分组节点 -->
              <div
                class="tree-node tree-project"
                :class="{ expanded: expandedSet.has(p.id) }"
                @click="toggleProject(p.id)"
              >
                <i class="fa-solid tree-arrow" :class="expandedSet.has(p.id) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                <i class="fa-solid fa-cubes tree-proj-icon" :class="{ active: p.id === store.selectedProjectId }"></i>
                <template v-if="renamingProjectId === p.id">
                  <input
                    v-model="renamingProjectName"
                    class="inp tree-rename-inp"
                    @click.stop
                    @keyup.enter="commitRenameProject(true)"
                    @keyup.escape="commitRenameProject(false)"
                    @blur="commitRenameProject(true)"
                  />
                </template>
                <template v-else>
                  <span class="tree-node-name" :class="{ active: p.id === store.selectedProjectId }">{{ p.name }}</span>
                  <span class="tree-count">{{ store.configCounts[p.id] ?? 0 }}</span>
                </template>
                <button class="ibtn ibtn-tiny tree-act" title="重命名" @click.stop="startRenameProject(p)">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="ibtn ibtn-tiny danger tree-act" title="删除" @click.stop="onDeleteProject(p.id)">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <!-- 展开的配置子节点 -->
              <Transition name="tree-expand">
                <div
                  v-if="expandedSet.has(p.id) && localConfigs[p.id]"
                  class="tree-children"
                  :data-project-id="p.id"
                >
                  <VueDraggable
                    v-model="localConfigs[p.id]"
                    class="tree-config-list"
                    :animation="200"
                    ghost-class="dragging"
                    group="configs"
                    draggable=".tree-config"
                    :disabled="selectedEnv !== 'all'"
                    @start="onConfigDragStart"
                    @end="onConfigDragEnd"
                  >
                    <div
                      v-for="c in localConfigs[p.id]"
                      v-show="isConfigVisible(c)"
                      :key="c.id"
                      class="tree-node tree-config"
                      :class="{ active: c.id === store.selectedConfigId }"
                      :data-config-id="c.id"
                      @click.stop="onSelectConfig(p.id, c.id)"
                    >
                      <template v-if="renamingConfigId === c.id">
                        <input
                          v-model="renamingConfigName"
                          class="inp tree-rename-cfg-inp"
                          @click.stop
                          @keyup.enter="commitRenameConfig(true)"
                          @keyup.escape="commitRenameConfig(false)"
                          @blur="commitRenameConfig(true)"
                        />
                      </template>
                      <template v-else>
                        <span class="tree-config-name" @dblclick.stop="startRenameConfig(c)" title="双击重命名">{{ c.name }}</span>
                        <span class="tree-count">{{ c.fields.length }}</span>
                        <button class="ibtn ibtn-tiny tree-copy-act" title="复制所有字段" @click.stop="onCopyConfig(c)">
                          <i class="fa-regular fa-copy"></i>
                        </button>
                        <button class="ibtn ibtn-tiny danger tree-copy-act" title="删除配置" @click.stop="onDeleteConfig(c.id)">
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                      </template>
                    </div>
                    <div v-if="localConfigs[p.id].length === 0" class="tree-config-empty t3">
                      拖入配置到该分组
                    </div>
                  </VueDraggable>
                </div>
              </Transition>
            </div>
          </VueDraggable>
          <div v-if="filteredProjects.length === 0" class="tree-empty t3">暂无分组</div>
        </div>
      </div>

      <!-- 右侧配置详情 -->
      <div class="main-panel">
        <template v-if="store.selectedConfig">
          <!-- 面包屑 -->
          <div class="breadcrumb">
            <span class="bc-item">配置中心</span>
            <i class="fa-solid fa-chevron-right bc-sep"></i>
            <span class="bc-item" v-if="store.selectedProject">{{ store.selectedProject.name }}</span>
            <i class="fa-solid fa-chevron-right bc-sep"></i>
            <span class="bc-item bc-current">{{ store.selectedConfig.name }}</span>
          </div>

          <!-- 环境标签 + 搜索 + 新增配置 -->
          <div class="toolbar">
            <div class="env-filter">
              <button class="env-btn" :class="{ active: selectedEnv === 'all' }" @click="selectedEnv = 'all'">全部</button>
              <button class="env-btn env-prod" :class="{ active: selectedEnv === 'production' }" @click="selectedEnv = 'production'">生产</button>
              <button class="env-btn env-dev" :class="{ active: selectedEnv === 'development' }" @click="selectedEnv = 'development'">开发</button>
              <button class="env-btn env-test" :class="{ active: selectedEnv === 'test' }" @click="selectedEnv = 'test'">测试</button>
              <button class="env-btn env-staging" :class="{ active: selectedEnv === 'staging' }" @click="selectedEnv = 'staging'">预发</button>
            </div>
            <div class="toolbar-right">
              <div class="search-field">
                <i class="fa-solid fa-magnifying-glass search-ico t3"></i>
                <input v-model="search" class="inp search-inp" placeholder="搜索配置项…" />
              </div>
              <button class="btn-p btn-add-cfg" @click="startAddConfig">
                <i class="fa-solid fa-plus"></i>新增配置
              </button>
            </div>
          </div>

          <!-- 当前配置环境选择 -->
          <div class="cfg-env-row">
            <span class="cfg-env-lbl t3">当前配置环境</span>
            <select class="inp env-select" :value="store.selectedConfig.environment || ''" @change="onChangeConfigEnv" title="配置所属环境">
              <option value="">未分类环境</option>
              <option value="production">生产</option>
              <option value="development">开发</option>
              <option value="test">测试</option>
              <option value="staging">预发布</option>
            </select>
            <span v-if="showSaveHint" class="save-hint">
              <i class="fa-solid fa-check"></i>已自动保存
            </span>
          </div>

          <!-- 字段表头 -->
          <div class="field-header">
            <span class="fh-key">字段标识</span>
            <span class="fh-label">字段名称</span>
            <span class="fh-value">默认值</span>
            <span class="fh-actions">操作</span>
          </div>

          <!-- 字段列表 -->
          <div class="field-list">
            <div
              v-for="(f, i) in filteredFields"
              :key="i"
              class="field-row"
            >
              <div class="fc-key">
                <input class="finput mono" :value="f.key" @blur="onFieldBlur(i, 'key', $event)" @keydown="fieldEnter($event, $event.target)" />
              </div>
              <div class="fc-label">
                <input class="finput" :value="f.label" @blur="onFieldBlur(i, 'label', $event)" @keydown="fieldEnter($event, $event.target)" />
              </div>
              <div class="fc-value">
                <input class="finput mono" :value="f.value" @blur="onFieldBlur(i, 'value', $event)" @keydown="fieldEnter($event, $event.target)" />
              </div>
              <div class="fc-actions">
                <button class="ibtn ibtn-sm" title="复制值" @click="onCopy(f.value)">
                  <i class="fa-regular fa-copy"></i>
                </button>
                <button class="ibtn ibtn-sm danger" title="删除" @click="onDeleteField(i)">
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
            <!-- 新增字段行 -->
            <div class="field-row field-row-new">
              <div class="fc-key">
                <input ref="nfKeyRef" v-model="nfKey" class="finput mono" placeholder="+ 字段标识" @blur="onNfBlur" @keydown="newFieldEnter($event, nfLabelRef)" />
              </div>
              <div class="fc-label">
                <input ref="nfLabelRef" v-model="nfLabel" class="finput" placeholder="字段名称" @blur="onNfBlur" @keydown="newFieldEnter($event, nfValueRef)" />
              </div>
              <div class="fc-value">
                <input ref="nfValueRef" v-model="nfValue" class="finput mono" placeholder="默认值 · 回车保存" @blur="onNfBlur" @keydown="newFieldEnter($event, null)" />
              </div>
              <div class="fc-actions"></div>
            </div>
          </div>
          <div class="field-hint t3">
            <i class="fa-regular fa-lightbulb"></i>末行输入后回车 / 失焦即自动保存 · 点击任意单元格直接修改，失焦自动保存
          </div>
        </template>

        <!-- 无选中配置时 -->
        <template v-else-if="store.selectedProject">
          <div class="breadcrumb">
            <span class="bc-item">配置中心</span>
            <i class="fa-solid fa-chevron-right bc-sep"></i>
            <span class="bc-item bc-current">{{ store.selectedProject.name }}</span>
          </div>
          <div class="toolbar">
            <div class="env-filter"></div>
            <div class="toolbar-right">
              <button class="btn-p btn-add-cfg" @click="startAddConfig">
                <i class="fa-solid fa-plus"></i>新增配置
              </button>
            </div>
          </div>
          <div class="empty-state">
            <i class="fa-regular fa-file-lines empty-icon"></i>
            <div class="empty-text t3">点击「新增配置」创建第一组字段</div>
          </div>
        </template>

        <template v-else>
          <div class="empty-state">
            <i class="fa-regular fa-folder-open empty-icon"></i>
            <div class="empty-text t3">选择左侧分组中的配置，或新增分组开始</div>
          </div>
        </template>
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

    <!-- 新增配置弹窗 -->
    <teleport to="body">
      <Transition name="cfg-modal">
        <div v-if="configModalOpen" class="proj-modal-overlay" @click.self="cancelConfigModal">
          <div class="proj-modal panel-solid" role="dialog" aria-modal="true">
            <div class="proj-modal-head">
              <h2>新增配置</h2>
              <button class="ibtn" type="button" @click="cancelConfigModal" aria-label="关闭">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div class="proj-modal-body">
              <label class="proj-lbl">配置名称</label>
              <input
                ref="configNameInput"
                v-model="configModalName"
                class="inp"
                placeholder="如：数据库配置"
                @keyup.enter="confirmConfigModal"
                @keyup.escape="cancelConfigModal"
              />
            </div>
            <div class="proj-modal-foot">
              <button class="btn-g" type="button" @click="cancelConfigModal">取消</button>
              <button class="btn-p" type="button" @click="confirmConfigModal">
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
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useConfigStoreV3 } from '@shared/stores/configStoreV3';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import type { ConfigProject, ConfigDef, Environment } from '@shared/types/entities';

const store = useConfigStoreV3();
const toast = useToastStore();
const dialog = useDialogStore();

const search = ref('');
const selectedEnv = ref<Environment | 'all'>('all');

// 树形展开状态
const expandedSet = ref<Set<string>>(new Set());

// 配置列表的本地镜像：拖拽时先更新本地顺序，松手后再持久化
const localConfigs = reactive<Record<string, ConfigDef[]>>({});
watch(
  () => store.projectConfigs,
  (map) => {
    for (const key of Object.keys(localConfigs)) {
      if (!(key in map)) delete localConfigs[key];
    }
    for (const [key, list] of Object.entries(map)) {
      localConfigs[key] = [...list];
    }
  },
  { immediate: true },
);

// 分组：弹窗新建 / 重命名
const projectModalOpen = ref(false);
const projectModalName = ref('');
const projectNameInput = ref<HTMLInputElement | null>(null);
const renamingProjectId = ref<string | null>(null);
const renamingProjectName = ref('');

// 配置：弹窗新建 / 重命名
const configModalOpen = ref(false);
const configModalName = ref('');
const configNameInput = ref<HTMLInputElement | null>(null);
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

onMounted(async () => {
  await store.loadProjects();
  // 默认展开选中项目
  if (store.selectedProjectId) {
    expandedSet.value.add(store.selectedProjectId);
  }
});

onBeforeUnmount(finishConfigDrag);

// 筛选分组（搜索）
const filteredProjects = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return store.projects;
  return store.projects.filter(p => p.name.toLowerCase().includes(q));
});

// 环境筛选只影响显示，列表本身始终保留完整配置以保证拖拽排序正确
function isConfigVisible(c: ConfigDef): boolean {
  return selectedEnv.value === 'all' || c.environment === selectedEnv.value;
}

// 当前选中配置的字段（搜索过滤）
const filteredFields = computed(() => {
  const cfg = store.selectedConfig;
  if (!cfg) return [];
  const q = search.value.trim().toLowerCase();
  if (!q) return cfg.fields;
  return cfg.fields.filter(f =>
    f.key.toLowerCase().includes(q) ||
    f.label.toLowerCase().includes(q) ||
    f.value.toLowerCase().includes(q)
  );
});

// 切换分组 / 配置时重置
watch(() => store.selectedConfigId, () => { resetNf(); });

function resetNf() {
  nfKey.value = '';
  nfLabel.value = '';
  nfValue.value = '';
}

/* ---------- 树形操作 ---------- */
let projectDragEndedAt = 0;

function toggleProject(id: string) {
  // 拖拽结束后浏览器仍可能触发 click，避免误折叠/展开
  if (Date.now() - projectDragEndedAt < 250) return;
  const s = new Set(expandedSet.value);
  if (s.has(id)) {
    s.delete(id);
  } else {
    s.add(id);
  }
  expandedSet.value = s;
  // 选中该项目
  store.selectProject(id);
}

function onSelectConfig(projectId: string, configId: string) {
  if (store.selectedProjectId !== projectId) {
    store.selectProject(projectId);
  }
  store.selectConfig(configId);
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
  const id = await store.createProject(name);
  // 展开新建的分组
  const s = new Set(expandedSet.value);
  s.add(id);
  expandedSet.value = s;
  toast.success('分组已创建');
}

function startRenameProject(p: ConfigProject) {
  renamingProjectId.value = p.id;
  renamingProjectName.value = p.name;
  nextTick(() => {
    const el = document.querySelector('.tree-rename-inp') as HTMLInputElement | null;
    el?.focus();
    el?.select();
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
    showSave();
  }
}
async function onDeleteProject(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该分组？其下所有配置将一并删除。');
  if (!ok) return;
  await store.deleteProject(id);
  const s = new Set(expandedSet.value);
  s.delete(id);
  expandedSet.value = s;
  toast.success('分组已删除');
}

/* ---------- 配置 ---------- */
function startAddConfig() {
  if (!store.selectedProject) { toast.error('请先创建一个分组'); return; }
  configModalOpen.value = true;
  configModalName.value = '';
  nextTick(() => configNameInput.value?.focus());
}
function cancelConfigModal() {
  configModalOpen.value = false;
  configModalName.value = '';
}
async function confirmConfigModal() {
  const name = configModalName.value.trim();
  if (!name || !store.selectedProject) { toast.error('请填写配置名称'); return; }
  configModalOpen.value = false;
  configModalName.value = '';
  const env = selectedEnv.value === 'all' ? undefined : selectedEnv.value;
  await store.addConfig(store.selectedProject.id, name, env);
  toast.success('配置已创建');
}

async function onDeleteConfig(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该配置？');
  if (!ok) return;
  await store.deleteConfig(id);
  toast.success('配置已删除');
}

function startRenameConfig(c: ConfigDef) {
  renamingConfigId.value = c.id;
  renamingConfigName.value = c.name;
  nextTick(() => {
    const el = document.querySelector('.tree-rename-cfg-inp') as HTMLInputElement | null;
    el?.focus();
    el?.select();
  });
}
async function commitRenameConfig(save: boolean) {
  const id = renamingConfigId.value;
  if (!id) return;
  const name = renamingConfigName.value.trim();
  renamingConfigId.value = null;
  renamingConfigName.value = '';
  if (!save || !name) return;
  const cfgs = store.configs;
  const c = cfgs.find(x => x.id === id);
  if (c && c.name !== name) {
    await store.renameConfig(id, name);
    showSave();
  }
}

async function onProjectDragEnd(event: any) {
  projectDragEndedAt = Date.now();
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || oldIndex === undefined || newIndex === undefined) return;
  // 搜索过滤时列表不完整，不能据此重排
  if (search.value.trim()) return;

  const list = [...filteredProjects.value];
  const [moved] = list.splice(oldIndex, 1);
  if (!moved) return;
  list.splice(newIndex, 0, moved);
  await store.reorderProjects(list.map(p => p.id));
  toast.success('分组排序已更新');
}

let draggingConfig = false;
let expandTimer: number | undefined;
let pendingExpandProjectId: string | null = null;

function cancelPendingExpand() {
  if (expandTimer) {
    window.clearTimeout(expandTimer);
    expandTimer = undefined;
  }
  pendingExpandProjectId = null;
}

function handleConfigDragOver(e: DragEvent | MouseEvent) {
  if (!draggingConfig) return;
  // mousemove 用于非原生拖拽兜底，避免鼠标已松开后仍触发展开
  if (e.type === 'mousemove' && (e as MouseEvent).buttons === 0) return;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  const group = target?.closest('.tree-group') as HTMLElement | null;
  const projectId = group?.dataset.projectId;
  if (!projectId || expandedSet.value.has(projectId)) {
    cancelPendingExpand();
    return;
  }

  if (pendingExpandProjectId === projectId) return;
  cancelPendingExpand();
  pendingExpandProjectId = projectId;
  expandTimer = window.setTimeout(() => {
    expandTimer = undefined;
    if (!draggingConfig || pendingExpandProjectId !== projectId) return;
    const s = new Set(expandedSet.value);
    s.add(projectId);
    expandedSet.value = s;
    pendingExpandProjectId = null;
  }, 250);
}

function finishConfigDrag() {
  draggingConfig = false;
  cancelPendingExpand();
  document.removeEventListener('dragover', handleConfigDragOver, true);
  document.removeEventListener('mousemove', handleConfigDragOver, true);
  document.removeEventListener('mouseup', finishConfigDrag, true);
  document.removeEventListener('dragend', finishConfigDrag, true);
}

function onConfigDragStart() {
  if (draggingConfig) return;
  draggingConfig = true;
  // 只展开鼠标停留的折叠分组，避免一开始就展开全部分组造成列表跳动
  document.addEventListener('dragover', handleConfigDragOver, true);
  document.addEventListener('mousemove', handleConfigDragOver, true);
  document.addEventListener('mouseup', finishConfigDrag, true);
  document.addEventListener('dragend', finishConfigDrag, true);
}

async function onConfigDragEnd(event: any) {
  finishConfigDrag();
  const { oldIndex, newIndex, from, to, item } = event;
  if (newIndex === undefined) return;

  // VueDraggable 的根节点是 .tree-config-list，其父节点上记录了所属分组
  const sourceProjectId = (from as HTMLElement | undefined)?.parentElement?.dataset.projectId;
  const targetProjectId = (to as HTMLElement | undefined)?.parentElement?.dataset.projectId;
  const configId = (item as HTMLElement | undefined)?.dataset.configId;
  if (!sourceProjectId || !targetProjectId || !configId) return;

  if (sourceProjectId === targetProjectId) {
    if (oldIndex === newIndex) return;
    const orderedIds = (localConfigs[sourceProjectId] ?? []).map(c => c.id);
    await store.reorderConfigs(sourceProjectId, orderedIds);
    toast.success('配置排序已更新');
    return;
  }

  const targetList = localConfigs[targetProjectId] ?? [];
  const targetIndex = targetList.findIndex(c => c.id === configId);
  await store.moveConfig(configId, targetProjectId, targetIndex < 0 ? targetList.length : targetIndex);
  const targetName = store.projects.find(p => p.id === targetProjectId)?.name ?? '分组';
  toast.success(`配置已移动到「${targetName}」`);
}

async function onChangeConfigEnv(e: Event) {
  const cfg = store.selectedConfig;
  if (!cfg) return;
  const value = (e.target as HTMLSelectElement).value;
  const env = (value || undefined) as Environment | undefined;
  await store.setConfigEnvironment(cfg.id, env);
  showSave();
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

async function onCopyConfig(c: ConfigDef) {
  if (!c.fields.length) { toast.error('该配置暂无字段'); return; }
  const text = c.fields.map(f => `${f.key}: ${f.value}`).join('\n');
  await store.copyValue(text);
  toast.success(`已复制「${c.name}」的 ${c.fields.length} 个字段`);
}
</script>

<style scoped>
.config-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
}

/* 分栏 */
.split-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: var(--gap-lg);
  overflow: hidden;
}

/* ===== 左侧树形侧栏 ===== */
.sidebar {
  width: 260px;
  flex: none;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--panel);
  overflow: hidden;
}
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sidebar-title {
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 8px;
}
.sidebar-title i {
  font-size: 13px;
  color: var(--accent);
}

.tree-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
}

/* 树节点 */
.tree-project-list {
  display: flex;
  flex-direction: column;
}
.tree-group {
  margin-bottom: 2px;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 7px 14px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
  color: var(--ink2);
  border-radius: 0;
  position: relative;
}
.tree-node:hover {
  background: var(--panel2);
}
.tree-arrow {
  width: 12px;
  font-size: 9px;
  color: var(--ink3);
  flex-shrink: 0;
  transition: transform 0.15s ease;
}
.tree-proj-icon {
  font-size: 12px;
  color: var(--ink3);
  flex-shrink: 0;
}
.tree-proj-icon.active {
  color: var(--accent);
}
.tree-node-name {
  flex: 1;
  font-size: 13px;
  font-weight: var(--font-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-node-name.active {
  color: var(--accent);
  font-weight: var(--font-semibold);
}
.tree-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink3);
  background: var(--panel2);
  padding: 1px 6px;
  border-radius: 8px;
  min-width: 18px;
  text-align: center;
  flex-shrink: 0;
}
.tree-rename-inp {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  font-size: 13px;
}
.tree-act {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.tree-node:hover .tree-act { opacity: 1; }
.ibtn-tiny { width: 18px; height: 18px; }
.ibtn-tiny i { font-size: 9px; }
.ibtn-mini { width: 22px; height: 22px; }
.ibtn-mini i { font-size: 10px; }

/* 配置子节点 */
.tree-children {
  overflow: hidden;
}
.tree-config-list {
  display: flex;
  flex-direction: column;
}
.tree-config {
  padding: 6px 12px 6px 44px;
  font-size: 13px;
  gap: 8px;
}
.tree-config.active {
  background: rgba(46, 107, 240, .08);
  color: var(--accent);
}
.tree-config.active .tree-config-name {
  color: var(--accent);
  font-weight: var(--font-medium);
}
.tree-config-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-rename-cfg-inp {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 8px;
  font-size: 12.5px;
}
.tree-copy-act {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.tree-config:hover .tree-copy-act { opacity: 1; }
.tree-config-empty {
  margin: 2px 10px;
  padding: 6px 12px;
  font-size: 11px;
  text-align: center;
  color: var(--ink3);
  border: 1px dashed var(--border);
  border-radius: 6px;
}

/* 拖拽 */
.dragging {
  opacity: 0.5;
  background: rgba(46, 107, 240, .12) !important;
}

/* 展开收起动画 */
.tree-expand-enter-active { transition: max-height 0.2s ease, opacity 0.2s ease; }
.tree-expand-leave-active { transition: max-height 0.15s ease, opacity 0.15s ease; }
.tree-expand-enter-from,
.tree-expand-leave-to { max-height: 0; opacity: 0; }
.tree-expand-enter-to,
.tree-expand-leave-from { max-height: 600px; opacity: 1; }

.tree-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 12px;
}

/* ===== 右侧主面板 ===== */
.main-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  overflow-y: auto;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--panel);
}

/* 面包屑 */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.bc-item {
  font-size: 13px;
  color: var(--ink3);
}
.bc-current {
  color: var(--ink);
  font-weight: var(--font-medium);
}
.bc-sep {
  font-size: 8px;
  color: var(--ink3);
}

/* 工具栏：环境标签 + 搜索 + 按钮 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.env-filter {
  display: flex;
  align-items: center;
  gap: 4px;
}
.env-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: var(--font-medium);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--ink2);
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}
.env-btn:hover {
  border-color: var(--border-strong);
  color: var(--ink);
}
.env-btn.active {
  color: #fff;
  border-color: transparent;
  background: var(--ink2);
  box-shadow: 0 0 6px currentColor;
}
.env-btn.env-prod.active { background: var(--env-prod-fg); }
.env-btn.env-dev.active { background: var(--env-dev-fg); }
.env-btn.env-test.active { background: var(--env-test-fg); }
.env-btn.env-staging.active { background: var(--env-staging-fg); }
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.search-field {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.search-ico {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  pointer-events: none;
}
.search-inp {
  width: 200px;
  padding-left: 30px;
  height: 32px;
  font-size: 12.5px;
}
.btn-add-cfg {
  white-space: nowrap;
  gap: 5px;
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
}
.btn-add-cfg i { font-size: 10px; }

/* 配置环境行 */
.cfg-env-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-shrink: 0;
}
.cfg-env-lbl {
  font-size: 11px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.04em;
}
.env-select {
  width: auto;
  height: 28px;
  padding: 0 28px 0 10px;
  font-size: 12px;
}
.save-hint {
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: var(--font-medium);
  color: var(--ok);
}
.save-hint i { font-size: 9px; }

/* 字段表头 */
.field-header {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.field-header span {
  font-size: 11px;
  font-weight: var(--font-semibold);
  color: var(--ink3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.fh-key { flex: 2; padding-right: 12px; }
.fh-label { flex: 2; padding: 0 12px; }
.fh-value { flex: 3; padding: 0 12px; }
.fh-actions { width: 72px; text-align: right; flex-shrink: 0; }

/* 字段行 */
.field-list {
  flex: 1;
  min-height: 0;
}
.field-row {
  display: flex;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}
.field-row:hover .fc-actions button { opacity: 1; }
.fc-key { flex: 2; padding-right: 12px; }
.fc-label { flex: 2; padding: 0 12px; }
.fc-value { flex: 3; padding: 0 12px; }
.fc-actions {
  width: 72px;
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
.fc-actions button { opacity: 0; transition: opacity 0.12s ease; }
.ibtn-sm { width: 24px; height: 24px; }
.ibtn-sm i { font-size: 10px; }

.field-hint {
  margin-top: 10px;
  font-size: 11px;
  flex-shrink: 0;
}
.field-hint i { margin-right: 4px; }

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}
.empty-icon { font-size: 28px; color: var(--ink3); }
.empty-text { margin-top: 10px; font-size: 13px; }

/* ===== 弹窗 ===== */
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
