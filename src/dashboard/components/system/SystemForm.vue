<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>{{ system ? '编辑系统' : '新增系统' }}</h3>
          <div class="icon-btn" @click="$emit('close')"><i class="fa-solid fa-xmark"></i></div>
        </div>
        <div class="detail-tabs">
          <div class="detail-tab" :class="{ active: tab === 'basic' }" @click="tab = 'basic'">基本信息</div>
          <div class="detail-tab" :class="{ active: tab === 'accounts' }" @click="tab = 'accounts'">账号密码 ({{ accounts.length }})</div>
          <div class="detail-tab" :class="{ active: tab === 'remark' }" @click="tab = 'remark'">备注信息</div>
        </div>
        <div class="modal-body">
          <template v-if="tab === 'basic'">
            <div class="form-row">
              <div class="form-label">系统名称 <span class="req">*</span></div>
              <div class="form-field"><input v-model="form.name" class="form-input" type="text" placeholder="如：内部OA系统" /></div>
            </div>
            <div class="form-row">
              <div class="form-label">系统地址 <span class="req">*</span></div>
              <div class="form-field">
                <div class="form-icon">
                  <input v-model="form.url" class="form-input" type="text" placeholder="https://example.com" />
                  <i class="fa-solid fa-copy" @click="copy(form.url)"></i>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-label">环境分类</div>
              <div class="form-field">
                <select v-model="form.environment" class="form-select">
                  <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-label">图标</div>
              <div class="form-field"><input v-model="form.icon" class="form-input" type="text" placeholder="fa-solid fa-globe" /></div>
            </div>
            <div class="form-row">
              <div class="form-label">颜色</div>
              <div class="form-field">
                <div class="color-bar-wrap">
                  <input type="color" v-model="colorHex" class="color-picker-native" />
                  <span class="color-hex">{{ colorHex }}</span>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-label">标签</div>
              <div class="form-field">
                <div class="tag-list">
                  <TagPill v-for="t in selectedTags" :key="t.id" :name="t.name" :color="t.color" removable @remove="removeTag(t.id)" />
                </div>
                <input v-model="newTag" class="form-input tag-add-input" type="text" placeholder="输入标签后回车添加..." @keyup.enter="addTag" />
              </div>
            </div>
          </template>
          <template v-else-if="tab === 'accounts'">
            <AccountList :accounts="displayAccounts" :system-id="systemId || 'temp'" @add="onAddAccount" @delete="deleteAccount" @set-default="setDefault" />
          </template>
          <template v-else>
            <textarea v-model="form.remark" class="form-textarea" placeholder="备注信息..."></textarea>
          </template>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="$emit('close')">取消</button>
          <button class="btn btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { System, SystemInput, Account, EncryptedField } from '@shared/types/entities';
import { ENVIRONMENTS } from '@shared/types/enums';
import { useAccountStore } from '@shared/stores/accountStore';
import { useTagStore } from '@shared/stores/tagStore';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import { copyToClipboard } from '@shared/utils/clipboard';
import { isValidUrl } from '@shared/utils/url';
import TagPill from '../common/TagPill.vue';
import AccountList from './AccountList.vue';

const props = defineProps<{ visible: boolean; system: System | null; systemId: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const accountStore = useAccountStore();
const tagStore = useTagStore();
const systemStore = useSystemStore();
const toast = useToastStore();

const tab = ref<'basic' | 'accounts' | 'remark'>('basic');
const form = ref<SystemInput>({
  name: '', url: '', environment: 'development', icon: '', iconColor: '', favorite: false, sort: 0, remark: '',
});
const colorHex = computed<string>({
  get: () => {
    const v = form.value.iconColor || '';
    const m = v.match(/#([0-9a-fA-F]{6})\b/);
    return m ? m[0] : '#007AFF';
  },
  set: (val: string) => { form.value.iconColor = val; },
});
const selectedTags = ref<Array<{ id: string; name: string; color?: string }>>([]);
const newTag = ref('');
const accounts = ref<Account[]>([]);
const pendingAccounts = ref<Array<{ tempId: string; role: string; username: string; password: string; isDefault: boolean }>>([]);

const displayAccounts = computed<Account[]>(() => {
  if (props.system) return accounts.value;
  return pendingAccounts.value.map(a => ({
    id: a.tempId,
    systemId: 'temp',
    role: a.role,
    username: a.username,
    password: { __encrypted: false, value: a.password } as EncryptedField,
    isDefault: a.isDefault,
    remark: '',
    createdAt: 0,
    updatedAt: 0,
  }));
});

watch(() => props.visible, async (v) => {
  if (!v) return;
  tab.value = 'basic';
  newTag.value = '';
  pendingAccounts.value = [];
  if (props.system) {
    form.value = { ...props.system };
    accounts.value = await accountStore.loadBySystem(props.system.id).then(() => accountStore.list);
  } else {
    form.value = { name: '', url: '', environment: 'development', icon: '', iconColor: '', favorite: false, sort: 0, remark: '' };
    accounts.value = [];
  }
}, { immediate: true });

function addTag() {
  if (!newTag.value.trim()) return;
  const name = newTag.value.trim();
  tagStore.create(name).then(id => {
    selectedTags.value.push({ id, name });
    newTag.value = '';
  });
}

function removeTag(id: string) {
  selectedTags.value = selectedTags.value.filter(t => t.id !== id);
}

async function onAddAccount(account: { role: string; username: string; password: string; isDefault: boolean }) {
  if (props.system) {
    await accountStore.create({
      systemId: props.systemId,
      role: account.role,
      username: account.username,
      password: account.password,
      isDefault: account.isDefault,
    });
    accounts.value = accountStore.list;
  } else {
    if (account.isDefault) {
      pendingAccounts.value.forEach(a => a.isDefault = false);
    }
    pendingAccounts.value.push({
      tempId: `temp-${Date.now()}-${Math.random()}`,
      role: account.role,
      username: account.username,
      password: account.password,
      isDefault: account.isDefault,
    });
  }
  toast.success('账号已添加');
}

async function deleteAccount(id: string) {
  if (props.system) {
    await accountStore.remove(id, props.systemId);
    accounts.value = accountStore.list;
  } else {
    pendingAccounts.value = pendingAccounts.value.filter(a => a.tempId !== id);
  }
  toast.success('已删除');
}

async function setDefault(id: string) {
  if (props.system) {
    await accountStore.setDefault(props.systemId, id);
    accounts.value = accountStore.list;
  } else {
    pendingAccounts.value.forEach(a => a.isDefault = (a.tempId === id));
  }
  toast.success('已设为默认账号');
}

async function save() {
  if (!form.value.name.trim()) {
    toast.error('系统名称不能为空');
    tab.value = 'basic';
    return;
  }
  if (!form.value.url.trim()) {
    toast.error('系统地址不能为空');
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
  try {
    if (props.system) {
      await systemStore.update(props.system.id, form.value);
      await systemStore.setTags(props.system.id, selectedTags.value.map(t => t.name));
      toast.success('系统已更新');
    } else {
      const id = await systemStore.create(form.value);
      await systemStore.setTags(id, selectedTags.value.map(t => t.name));
      for (const acc of pendingAccounts.value) {
        await accountStore.create({
          systemId: id,
          role: acc.role,
          username: acc.username,
          password: acc.password,
          isDefault: acc.isDefault,
        });
      }
      toast.success(`系统已创建${pendingAccounts.value.length > 0 ? `（含 ${pendingAccounts.value.length} 个账号）` : ''}`);
    }
    emit('saved');
  } catch (e) {
    toast.error((e as Error).message || '保存失败');
  }
}

function copy(text: string) { copyToClipboard(text); }
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: 24px;
}
.modal-dialog {
  background: var(--bg-pure);
  border-radius: var(--radius-xl);
  padding: 4px 0 0;
  width: 580px;
  max-width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-soft);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 8px;
  flex-shrink: 0;
}
.modal-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
  background: transparent;
  border: none;
}
.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.detail-tabs {
  display: flex;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-soft);
  margin: 8px 0 0;
  gap: var(--gap-xs);
  flex-shrink: 0;
}
.detail-tab {
  padding: 10px 14px;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  position: relative;
  font-weight: var(--font-medium);
  transition: var(--transition-fast);
}
.detail-tab:hover { color: var(--text-primary); }
.detail-tab.active {
  color: var(--primary);
  font-weight: var(--font-semibold);
}
.detail-tab.active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 14px;
  right: 14px;
  height: 2px;
  background: var(--primary);
  border-radius: 2px 2px 0 0;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 8px;
}
.form-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: var(--gap-md);
  gap: var(--gap-md);
}
.form-label {
  width: 80px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding-top: 11px;
  flex-shrink: 0;
  font-weight: var(--font-medium);
}
.form-label .req { color: var(--danger); margin-left: 2px; }
.form-field { flex: 1; min-width: 0; }
.form-input, .form-select, .form-textarea {
  width: 100%;
  height: var(--control-h);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 0 14px;
  font-size: var(--text-sm);
  background: var(--bg-pure);
  outline: none;
  font-family: inherit;
  color: var(--text-primary);
  transition: var(--transition-fast);
}
.form-input::placeholder, .form-textarea::placeholder { color: var(--text-quaternary); }
.form-input:hover, .form-select:hover, .form-textarea:hover { border-color: var(--text-quaternary); }
.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}
.form-textarea {
  height: auto;
  padding: 10px 14px;
  resize: vertical;
  min-height: 100px;
  line-height: var(--leading-normal);
}
.form-icon { position: relative; }
.form-icon i {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-quaternary);
  font-size: var(--text-sm);
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}
.form-icon i:hover { color: var(--primary); background: var(--primary-50); }

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-xs);
  margin-bottom: var(--gap-sm);
}
.tag-add-input { width: 100%; }

.color-bar-wrap { display: flex; align-items: center; gap: var(--gap-md); }
.color-picker-native {
  flex: 1;
  height: var(--control-h);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 4px;
  background: var(--bg-pure);
  cursor: pointer;
  outline: none;
  transition: var(--transition-fast);
}
.color-picker-native:hover { border-color: var(--primary); }
.color-picker-native::-webkit-color-swatch-wrapper { padding: 0; }
.color-picker-native::-webkit-color-swatch { border: none; border-radius: var(--radius-sm); }
.color-hex {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  flex-shrink: 0;
  min-width: 88px;
}

.accounts-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-tertiary);
  text-align: center;
}
.accounts-hint i {
  font-size: 32px;
  margin-bottom: var(--gap-sm);
  color: var(--primary);
}
.accounts-hint p {
  font-size: var(--text-sm);
  margin: 0;
  line-height: var(--leading-normal);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--gap-md);
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-soft);
  margin-top: var(--gap-md);
  flex-shrink: 0;
}
</style>
