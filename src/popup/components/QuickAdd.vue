<template>
  <div class="quick-actions">
    <template v-if="!showForm">
      <button class="qa-btn" @click="openForm">
        <i class="fa-solid fa-plus"></i>
        <span>新增系统</span>
      </button>
      <button class="qa-btn secondary" @click="openDashboard">
        <i class="fa-solid fa-table-columns"></i>
        <span>管理面板</span>
      </button>
    </template>
    <template v-else>
      <div class="form-overlay">
        <div class="form-header">
          <span>新增系统</span>
          <i class="fa-solid fa-xmark" @click="closeForm"></i>
        </div>
        <div class="form-body">
          <div class="form-row">
            <label>系统名称 <span class="req">*</span></label>
            <input v-model="form.name" class="form-input" placeholder="如：内部OA系统" />
          </div>
          <div class="form-row">
            <label>系统地址 <span class="req">*</span></label>
            <input v-model="form.url" class="form-input" placeholder="https://example.com" />
          </div>
          <div class="form-row">
            <label>环境分类</label>
            <select v-model="form.environment" class="form-select">
              <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>图标</label>
            <input v-model="form.icon" class="form-input" placeholder="fa-solid fa-globe" />
          </div>
          <div class="form-row">
            <label>颜色</label>
            <input v-model="form.iconColor" class="form-input" placeholder="linear-gradient(135deg,#3b82f6,#2563eb)" />
          </div>
          <div class="form-row">
            <label>标签</label>
            <input v-model="tagsText" class="form-input" placeholder="多个标签用逗号分隔" />
          </div>
          <div class="form-row">
            <label>备注</label>
            <textarea v-model="form.remark" class="form-textarea" placeholder="备注信息..."></textarea>
          </div>
        </div>
        <div class="form-footer">
          <button class="btn-cancel" @click="closeForm">取消</button>
          <button class="btn-save" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import { ENVIRONMENTS } from '@shared/types/enums';
import type { SystemInput } from '@shared/types/entities';
import { isValidUrl } from '@shared/utils/url';

const emit = defineEmits<{ saved: [] }>();

const systemStore = useSystemStore();
const toast = useToastStore();

const showForm = ref(false);
const saving = ref(false);
const tagsText = ref('');
const form = ref<SystemInput>({
  name: '', url: '', environment: 'development', icon: '', iconColor: '', favorite: false, sort: 0, remark: '',
});

function openForm() {
  showForm.value = true;
}

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
}

async function save() {
  if (!form.value.name.trim()) {
    toast.error('请填写系统名称');
    return;
  }
  let url = form.value.url.trim();
  if (!url) {
    toast.error('请填写系统地址');
    return;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
    form.value.url = url;
  }
  if (!isValidUrl(url)) {
    toast.error('系统地址格式不正确');
    return;
  }
  saving.value = true;
  try {
    const id = await systemStore.create(form.value);
    const tagNames = tagsText.value.split(',').map(t => t.trim()).filter(Boolean);
    if (tagNames.length > 0) {
      await systemStore.setTags(id, tagNames);
    }
    toast.success('系统已创建');
    emit('saved');
    closeForm();
  } catch (e) {
    toast.error((e as Error).message || '创建失败');
  } finally {
    saving.value = false;
  }
}

function closeForm() {
  showForm.value = false;
  form.value = { name: '', url: '', environment: 'development', icon: '', iconColor: '', favorite: false, sort: 0, remark: '' };
  tagsText.value = '';
}
</script>

<style scoped>
.quick-actions { padding: 0 12px 12px; }
.qa-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; height: 36px; background: var(--primary-50); border: 1px solid var(--primary-100); color: var(--primary-700); border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; margin-bottom: 8px; }
.qa-btn:hover { background: var(--primary-100); }
.qa-btn.secondary { background: white; color: var(--text-secondary); border-color: var(--border); margin-bottom: 0; }
.qa-btn.secondary:hover { background: var(--border-soft); }
.form-overlay { position: fixed; inset: 0; background: var(--bg); z-index: 100; display: flex; flex-direction: column; }
.form-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: white; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--text-primary); flex-shrink: 0; }
.form-header i { cursor: pointer; color: var(--text-tertiary); padding: 4px; font-size: 14px; }
.form-header i:hover { color: var(--text-primary); }
.form-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.form-row { display: flex; flex-direction: column; gap: 4px; }
.form-row label { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
.form-row label .req { color: var(--danger); }
.form-input, .form-select, .form-textarea { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; outline: none; font-family: inherit; background: white; color: var(--text-primary); }
.form-textarea { height: 60px; padding: 6px 10px; resize: none; }
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
.form-footer { display: flex; gap: 8px; padding: 10px 14px; background: white; border-top: 1px solid var(--border); flex-shrink: 0; }
.btn-cancel, .btn-save { flex: 1; height: 34px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-cancel { background: var(--border-soft); color: var(--text-secondary); }
.btn-save { background: var(--primary); color: white; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
