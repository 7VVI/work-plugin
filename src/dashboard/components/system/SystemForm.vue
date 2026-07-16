<template>
  <aside class="detail-panel">
    <div class="detail-header">
      <div class="card-title"><i class="fa-solid fa-briefcase"></i> {{ form.name || '新系统' }}</div>
      <div class="icon-btn" @click="$emit('close')"><i class="fa-solid fa-xmark"></i></div>
    </div>
    <div class="detail-tabs">
      <div class="detail-tab" :class="{ active: tab === 'basic' }" @click="tab = 'basic'">基本信息</div>
      <div class="detail-tab" :class="{ active: tab === 'accounts' }" @click="tab = 'accounts'">账号密码 ({{ accounts.length }})</div>
      <div class="detail-tab" :class="{ active: tab === 'remark' }" @click="tab = 'remark'">备注信息</div>
    </div>
    <div class="detail-body">
      <template v-if="tab === 'basic'">
        <div class="form-row">
          <div class="form-label">系统名称 <span class="req">*</span></div>
          <div class="form-field"><input v-model="form.name" class="form-input" type="text" /></div>
        </div>
        <div class="form-row">
          <div class="form-label">系统地址 <span class="req">*</span></div>
          <div class="form-field">
            <div class="form-icon">
              <input v-model="form.url" class="form-input" type="text" />
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
          <div class="form-field"><input v-model="form.iconColor" class="form-input" type="text" placeholder="linear-gradient(...)" /></div>
        </div>
        <div class="form-row">
          <div class="form-label">标签</div>
          <div class="form-field">
            <div class="tag-list">
              <TagPill v-for="t in selectedTags" :key="t.id" :name="t.name" :color="t.color" removable @remove="removeTag(t.id)" />
              <input v-model="newTag" class="tag-input" type="text" placeholder="添加标签..." @keyup.enter="addTag" />
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="tab === 'accounts'">
        <AccountList :accounts="accounts" :system-id="systemId" @add="addAccount" @delete="deleteAccount" />
      </template>
      <template v-else>
        <textarea v-model="form.remark" class="form-textarea" placeholder="备注信息..."></textarea>
      </template>
    </div>
    <div class="detail-footer">
      <button class="btn btn-default" @click="$emit('cancel')">取消</button>
      <button class="btn btn-primary" @click="save">保存</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { System, SystemInput, Account } from '@shared/types/entities';
import { ENVIRONMENTS } from '@shared/types/enums';
import { useAccountStore } from '@shared/stores/accountStore';
import { useTagStore } from '@shared/stores/tagStore';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import { copyToClipboard } from '@shared/utils/clipboard';
import TagPill from '../common/TagPill.vue';
import AccountList from './AccountList.vue';

const props = defineProps<{ system: System | null; systemId: string }>();
const emit = defineEmits<{ close: []; saved: []; cancel: [] }>();

const accountStore = useAccountStore();
const tagStore = useTagStore();
const systemStore = useSystemStore();
const toast = useToastStore();

const tab = ref<'basic' | 'accounts' | 'remark'>('basic');
const form = ref<SystemInput>({
  name: '', url: '', environment: 'development', icon: '', iconColor: '', favorite: false, sort: 0, remark: '',
});
const selectedTags = ref<Array<{ id: string; name: string; color?: string }>>([]);
const newTag = ref('');
const accounts = ref<Account[]>([]);

watch(() => props.system, async (s) => {
  if (s) {
    form.value = { ...s };
    accounts.value = await accountStore.loadBySystem(s.id).then(() => accountStore.list);
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

async function addAccount() {
  // Open account creation modal (simplified for plan)
  const role = prompt('角色名称');
  if (!role) return;
  const username = prompt('用户名');
  if (!username) return;
  const password = prompt('密码');
  if (!password) return;
  await accountStore.create({ systemId: props.systemId, role, username, password, isDefault: accounts.value.length === 0 });
  accounts.value = accountStore.list;
}

async function deleteAccount(id: string) {
  await accountStore.remove(id, props.systemId);
  accounts.value = accountStore.list;
}

async function save() {
  if (props.system) {
    await systemStore.update(props.system.id, form.value);
    await systemStore.setTags(props.system.id, selectedTags.value.map(t => t.name));
    toast.success('系统已更新');
  } else {
    const id = await systemStore.create(form.value);
    await systemStore.setTags(id, selectedTags.value.map(t => t.name));
    toast.success('系统已创建');
  }
  emit('saved');
}

function copy(text: string) { copyToClipboard(text); }
</script>

<style scoped>
.detail-panel { background: white; border-radius: 8px; border: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; min-width: 360px; }
.detail-header { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-soft); }
.card-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.card-title i { color: var(--primary); font-size: 12px; }
.icon-btn { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); cursor: pointer; }
.icon-btn:hover { background: var(--border-soft); }
.detail-tabs { display: flex; padding: 0 14px; border-bottom: 1px solid var(--border-soft); }
.detail-tab { padding: 10px 12px; font-size: 12px; color: var(--text-secondary); cursor: pointer; position: relative; font-weight: 500; }
.detail-tab.active { color: var(--primary); font-weight: 600; }
.detail-tab.active::after { content: ""; position: absolute; bottom: -1px; left: 12px; right: 12px; height: 2px; background: var(--primary); border-radius: 2px 2px 0 0; }
.detail-body { padding: 14px; flex: 1; overflow-y: auto; }
.form-row { display: flex; align-items: flex-start; margin-bottom: 10px; }
.form-label { width: 78px; font-size: 12px; color: var(--text-secondary); padding-top: 7px; flex-shrink: 0; }
.form-label .req { color: var(--danger); }
.form-field { flex: 1; min-width: 0; }
.form-input, .form-select, .form-textarea { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; background: white; outline: none; font-family: inherit; color: var(--text-primary); }
.form-textarea { height: 80px; padding: 6px 10px; resize: vertical; }
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.form-icon { position: relative; }
.form-icon i { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; cursor: pointer; }
.tag-list { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.tag-input { border: 1px dashed var(--border); border-radius: 3px; padding: 1px 6px; font-size: 11px; width: 100px; outline: none; }
.detail-footer { padding: 10px 14px; border-top: 1px solid var(--border-soft); display: flex; justify-content: flex-end; gap: 8px; background: #fafbfc; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
</style>
