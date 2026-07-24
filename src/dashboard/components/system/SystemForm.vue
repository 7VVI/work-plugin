<template>
  <teleport to="body">
    <Transition name="sys-modal">
      <div v-if="visible" class="sys-overlay" @click.self="$emit('close')">
        <div class="sys-panel panel-solid" role="dialog" aria-modal="true">
          <!-- Header -->
          <div class="sys-header">
            <h2>{{ system ? '编辑系统' : '新增系统' }}</h2>
            <button class="ibtn" @click="$emit('close')" aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <!-- Tabs (v3 .mtab) -->
          <div class="mtab-strip">
            <button class="mtab" :class="{ active: tab === 'basic' }" @click="tab = 'basic'">基本信息</button>
            <button class="mtab" :class="{ active: tab === 'accounts' }" @click="tab = 'accounts'">
              账号密码 <span class="acct-count">({{ acctRows.length }})</span>
            </button>
            <button class="mtab" :class="{ active: tab === 'remark' }" @click="tab = 'remark'">备注信息</button>
          </div>

          <!-- Body -->
          <div class="sys-body">
            <!-- ========== 基本信息 ========== -->
            <div v-show="tab === 'basic'" class="panel-space">
              <div class="field">
                <label class="lbl">系统名称 <i class="fa-solid fa-asterisk req-mark"></i></label>
                <input v-model="form.name" class="inp" type="text" placeholder="如：内部OA系统" />
              </div>

              <div class="field">
                <label class="lbl">系统地址 <i class="fa-solid fa-asterisk req-mark"></i></label>
                <div class="url-wrap">
                  <input v-model="form.url" class="inp mono url-input" type="text" placeholder="https://example.com" />
                  <button class="ibtn url-btn" title="从剪贴板粘贴" @click="pasteUrl"><i class="fa-regular fa-clipboard"></i></button>
                </div>
              </div>

              <div class="grid-2">
                <div class="field">
                  <label class="lbl">环境分类</label>
                  <select v-model="form.environment" class="inp">
                    <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
                  </select>
                </div>
                <div class="field">
                  <label class="lbl">颜色</label>
                  <div class="color-bar">
                    <input
                      type="color"
                      :value="currentColor"
                      class="color-input"
                      @input="pickColor(($event.target as HTMLInputElement).value)"
                    />
                    <span class="color-swatch" :style="{ background: currentColor }"></span>
                    <span class="color-value mono">{{ currentColor.toUpperCase() }}</span>
                  </div>
                </div>
              </div>

              <div class="field">
                <label class="lbl">分组</label>
                <select v-model="form.groupId" class="inp">
                  <option value="">未分组</option>
                  <option v-for="g in groupStore.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
              </div>

              <div class="field">
                <label class="lbl">图标</label>
                <div class="icon-grid">
                  <button
                    v-for="ic in QUICK_ICONS"
                    :key="ic"
                    class="ibtn icon-opt"
                    :class="{ on: ic === currentIcon }"
                    :style="iconOptStyle(ic)"
                    :title="ic.replace('fa-solid ', '')"
                    type="button"
                    @click="pickIcon(ic)"
                  >
                    <i :class="ic"></i>
                  </button>
                </div>
              </div>

              <div class="field">
                <label class="lbl">标签</label>
                <div class="tag-inp" @click.self="focusTagInput">
                  <span v-for="(t, i) in tags" :key="t + i" class="chip tag-chip">
                    {{ t }}
                    <button class="tag-x" type="button" :title="`移除 ${t}`" @click="removeTag(i)">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </span>
                  <input
                    ref="tagInputEl"
                    v-model="tagInput"
                    class="tag-input"
                    type="text"
                    placeholder="输入标签后回车添加…"
                    @keydown.enter.prevent="addTag"
                    @blur="addTag"
                  />
                </div>
              </div>
            </div>

            <!-- ========== 账号密码 ========== -->
            <div v-show="tab === 'accounts'" class="acct-panel">
              <div class="acct-head">
                <span>角色</span>
                <span>用户名</span>
                <span>密码</span>
              </div>
              <div class="acct-rows">
                <div v-for="row in acctRows" :key="row.uid" class="acct-row">
                  <input v-model="row.role" class="inp acct-inp" placeholder="角色" />
                  <input v-model="row.username" class="inp acct-inp" placeholder="用户名" />
                  <div class="pwd-cell">
                    <input
                      v-model="row.password"
                      :type="row.show ? 'text' : 'password'"
                      class="inp acct-inp pwd-input"
                      placeholder="密码"
                    />
                    <button class="ibtn pwd-toggle" type="button" :title="row.show ? '隐藏' : '显示'" @click="row.show = !row.show">
                      <i :class="row.show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
                    </button>
                  </div>
                </div>
              </div>
              <button class="btn-g dashed" type="button" @click="addAccountRow()">
                <i class="fa-solid fa-plus"></i>添加账号
              </button>
            </div>

            <!-- ========== 备注 ========== -->
            <div v-show="tab === 'remark'">
              <textarea v-model="form.remark" rows="9" class="inp remark-area" placeholder="记录系统的使用说明、部署位置、负责人…"></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="sys-footer">
            <button class="btn-g" type="button" @click="$emit('close')">取消</button>
            <button class="btn-p" type="button" @click="save"><i class="fa-solid fa-check"></i>保存</button>
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { System, SystemInput } from '@shared/types/entities';
import { ENVIRONMENTS } from '@shared/types/enums';
import { useAccountStore } from '@shared/stores/accountStore';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useGroupStore } from '@shared/stores/groupStore';
import { systemService } from '@shared/services/systemService';
import { tagService } from '@shared/services/tagService';
import { accountService } from '@shared/services/accountService';
import { isValidUrl } from '@shared/utils/url';

// ---- external contract (preserved) ----
const props = defineProps<{ visible: boolean; system: System | null; systemId: string; defaultGroupId?: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const accountStore = useAccountStore();
const systemStore = useSystemStore();
const toast = useToastStore();
const groupStore = useGroupStore();

// ---- v3 verbatim constants ----
const QUICK_ICONS = [
  'fa-solid fa-globe', 'fa-solid fa-server', 'fa-solid fa-database', 'fa-solid fa-cloud',
  'fa-solid fa-map-location-dot', 'fa-solid fa-truck-fast', 'fa-solid fa-chart-line', 'fa-solid fa-warehouse',
  'fa-solid fa-mobile-screen', 'fa-solid fa-desktop', 'fa-solid fa-gear', 'fa-solid fa-shield-halved',
  'fa-solid fa-cart-shopping', 'fa-solid fa-book', 'fa-solid fa-comments', 'fa-solid fa-calendar-check',
  'fa-solid fa-diagram-project', 'fa-solid fa-gauge-high',
];

interface AcctRow {
  uid: string;
  id?: string; // present when row mirrors a persisted account (edit mode)
  role: string;
  username: string;
  password: string;
  show: boolean;
}

const tab = ref<'basic' | 'accounts' | 'remark'>('basic');
const form = ref<SystemInput>(blankForm());
const tags = ref<string[]>([]);
const tagInput = ref('');
const tagInputEl = ref<HTMLInputElement | null>(null);
const acctRows = ref<AcctRow[]>([]);

function blankForm(): SystemInput {
  return {
    name: '',
    url: '',
    environment: 'production',
    icon: 'fa-solid fa-globe',
    iconColor: '#2E6BF0',
    favorite: false,
    sort: 0,
    groupId: '',
    remark: '',
  };
}

const currentColor = computed(() => form.value.iconColor || '#2E6BF0');
const currentIcon = computed(() => form.value.icon || 'fa-solid fa-globe');

// ---------- pickers ----------
function pickColor(c: string) {
  form.value.iconColor = c;
}
function pickIcon(ic: string) {
  form.value.icon = ic;
}
function iconOptStyle(ic: string) {
  if (ic !== currentIcon.value) return { borderColor: 'var(--border)' } as Record<string, string>;
  const color = currentColor.value;
  return {
    borderColor: 'transparent',
    color: '#fff',
    background: color,
    boxShadow: `0 3px 10px -3px ${color}`,
  } as Record<string, string>;
}

// ---------- tag chips ----------
function focusTagInput() {
  tagInputEl.value?.focus();
}
function addTag() {
  const v = tagInput.value.trim();
  if (v && !tags.value.includes(v)) tags.value.push(v);
  tagInput.value = '';
}
function removeTag(i: number) {
  tags.value.splice(i, 1);
}

// ---------- url paste ----------
async function pasteUrl() {
  try {
    const t = await navigator.clipboard.readText();
    if (t) {
      form.value.url = t.trim();
      toast.info('已粘贴链接');
    }
  } catch {
    toast.error('无法读取剪贴板');
  }
}

// ---------- account rows ----------
function newUid() {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function addAccountRow(role = '', username = '', password = '', id?: string) {
  acctRows.value.push({ uid: newUid(), id, role, username, password, show: false });
}

// ---------- load on open ----------
watch(
  () => props.visible,
  async (v) => {
    if (!v) return;
    if (groupStore.currentType !== 'system') await groupStore.load('system');
    tab.value = 'basic';
    tagInput.value = '';
    acctRows.value = [];
    if (props.system) {
      form.value = {
        ...props.system,
        icon: props.system.icon || 'fa-solid fa-globe',
        iconColor: props.system.iconColor || props.system.color || '#2E6BF0',
        groupId: props.system.groupId ?? '',
      };
      // tags (v3 stores names; backend resolves names ↔ ids)
      try {
        const tagIds = await systemService.getTags(props.system.id);
        if (tagIds.length) {
          const all = await tagService.all();
          const idToName = new Map(all.map(t => [t.id, t.name]));
          tags.value = tagIds
            .map(id => idToName.get(id))
            .filter((n): n is string => !!n);
        } else {
          tags.value = [];
        }
      } catch {
        tags.value = [];
      }
      // accounts → editable rows
      await accountStore.loadBySystem(props.system.id);
      for (const acc of accountStore.list) {
        let plain = '';
        if (!acc.password.__encrypted) {
          plain = acc.password.value;
        } else {
          try {
            const { plainPassword } = await accountService.getDecrypted(acc.id);
            plain = plainPassword;
          } catch {
            plain = '';
          }
        }
        addAccountRow(acc.role, acc.username, plain, acc.id);
      }
    } else {
      form.value = blankForm();
      form.value.groupId = props.defaultGroupId || '';
      tags.value = [];
    }
  },
  { immediate: true },
);

// ---------- save (logic preserved) ----------
async function save() {
  if (!form.value.name.trim()) {
    toast.error('请填写系统名称');
    tab.value = 'basic';
    return;
  }
  if (!form.value.url.trim()) {
    toast.error('请填写系统地址');
    tab.value = 'basic';
    return;
  }
  let url = form.value.url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
    form.value.url = url;
  }
  if (!isValidUrl(url)) {
    toast.error('系统地址格式不正确');
    tab.value = 'basic';
    return;
  }

  const tagNames = [...tags.value];
  const rows = acctRows.value.filter(
    a => a.role.trim() && a.username.trim() && a.password.trim(),
  );

  try {
    if (props.system) {
      await systemStore.update(props.system.id, form.value);
      await systemStore.setTags(props.system.id, tagNames);
      // diff account rows: delete removed existing, create new
      const initialIds = accountStore.list.map(a => a.id);
      const keptIds = new Set(rows.map(r => r.id).filter((id): id is string => !!id));
      for (const id of initialIds) {
        if (!keptIds.has(id)) await accountStore.remove(id, props.system.id);
      }
      for (const r of rows) {
        if (!r.id) {
          await accountStore.create({
            systemId: props.system.id,
            role: r.role.trim(),
            username: r.username.trim(),
            password: r.password,
            isDefault: false,
          });
        }
      }
      toast.success('系统已更新');
    } else {
      const id = await systemStore.create(form.value);
      await systemStore.setTags(id, tagNames);
      for (const r of rows) {
        await accountStore.create({
          systemId: id,
          role: r.role.trim(),
          username: r.username.trim(),
          password: r.password,
          isDefault: false,
        });
      }
      toast.success(`系统已添加${rows.length > 0 ? `（含 ${rows.length} 个账号）` : ''}`);
    }
    emit('saved');
  } catch (e) {
    toast.error((e as Error).message || '保存失败');
  }
}
</script>

<style scoped>
/* ================= 弹窗外壳（v3 panel-solid + 弹簧动画） ================= */
.sys-overlay {
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
.sys-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 512px;
  max-height: 88vh;
  overflow: hidden;
  border-radius: var(--radius-2xl);
  box-shadow: 0 24px 70px -16px rgba(15, 23, 38, 0.3), 0 0 40px -16px var(--glow);
}

.sys-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 4px;
  flex-shrink: 0;
}
.sys-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: var(--font-semibold);
  color: var(--ink);
}

/* tab strip — full-width, bottom border */
.mtab-strip {
  display: flex;
  padding: 0 8px;
  margin-top: 4px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.acct-count {
  margin-left: 2px;
  font-size: 12px;
  color: var(--ink3);
}

.sys-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
}

.sys-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* v3 .inp / .btn-p / .btn-g / .btn-d 已提升为全局类（见 tokens.css）。
   此处仅保留弹窗自身布局/选择器/Tab 相关的局部样式。 */

/* ================= 基本信息面板 ================= */
.panel-space { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; }
.lbl {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: var(--font-medium);
  color: var(--ink2);
}
.req-mark { color: var(--danger); font-size: 7px; }

.url-wrap { position: relative; }
.url-input { padding-right: 36px; }
.url-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
}
.url-btn i { font-size: 12px; }

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* color bar picker (input[type=color] + swatch + hex) */
.color-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: var(--transition);
}
.color-bar:hover { border-color: var(--border-strong); }
.color-input {
  width: 32px;
  height: 26px;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
}
.color-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-input::-webkit-color-swatch { border: 1px solid var(--border-strong); border-radius: 6px; }
.color-input::-moz-color-swatch { border: 1px solid var(--border-strong); border-radius: 6px; }
.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  flex-shrink: 0;
}
.color-value {
  font-size: 12px;
  color: var(--ink2);
  letter-spacing: 0.03em;
}

/* icon grid */
.icon-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.icon-opt {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid var(--border);
  transition: 0.15s;
}
.icon-opt i { font-size: 12px; }

/* tag chip input — styled like .inp */
.tag-inp {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 6px 12px;
  cursor: text;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: var(--transition);
}
.tag-inp:hover { border-color: var(--border-strong); }
.tag-inp:focus-within { border-color: var(--accent); box-shadow: var(--shadow-focus); }
.tag-chip { padding: 2px 7px; font-size: 11.5px; }
.tag-x {
  margin-left: 2px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--ink3);
  cursor: pointer;
  line-height: 1;
}
.tag-x:hover { color: var(--ink); }
.tag-x i { font-size: 9px; }
.tag-input {
  flex: 1;
  min-width: 120px;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  color: var(--ink);
  outline: none;
  font-family: inherit;
}
.tag-input::placeholder { color: var(--ink3); }

/* ================= 账号面板 ================= */
.acct-panel { display: flex; flex-direction: column; }
.acct-head {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1.2fr;
  gap: 8px;
  padding: 0 4px;
  margin-bottom: 8px;
  font-size: 10.5px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink3);
}
.acct-rows { display: flex; flex-direction: column; gap: 8px; }
.acct-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1.2fr;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel2);
}
.acct-inp {
  background: transparent;
  border-color: transparent;
  padding: 6px 8px;
  font-size: 12px;
  height: auto;
}
.acct-inp:focus { box-shadow: none; border-color: var(--accent); }
.pwd-cell { position: relative; }
.pwd-input { padding-right: 28px; }
.pwd-toggle {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
}
.pwd-toggle i { font-size: 10px; }

.dashed {
  margin-top: 12px;
  width: 100%;
  justify-content: center;
  border-style: dashed;
}

/* ================= 备注 ================= */
.remark-area {
  height: auto;
  resize: none;
  line-height: var(--leading-normal);
}

/* ================= 过渡（v3 弹簧） ================= */
.sys-modal-enter-active { transition: opacity 0.18s ease; }
.sys-modal-leave-active { transition: opacity 0.16s ease; }
.sys-modal-enter-active .sys-panel {
  transition: transform 0.3s cubic-bezier(0.3, 1.3, 0.45, 1), opacity 0.3s ease;
}
.sys-modal-leave-active .sys-panel {
  transition: transform 0.16s ease, opacity 0.16s ease;
}
.sys-modal-enter-from, .sys-modal-leave-to { opacity: 0; }
.sys-modal-enter-from .sys-panel { transform: translateY(16px) scale(0.95); opacity: 0; }
.sys-modal-leave-to .sys-panel { transform: translateY(8px) scale(0.97); opacity: 0; }
</style>
