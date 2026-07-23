<template>
  <div class="form-overlay">
    <div class="form-header">
      <span>新增系统</span>
      <i class="fa-solid fa-xmark" @click="close"></i>
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
      <button class="btn-default" @click="close">取消</button>
      <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import { ENVIRONMENTS } from '@shared/types/enums';
import type { SystemInput } from '@shared/types/entities';
import { isValidUrl } from '@shared/utils/url';

const emit = defineEmits<{ saved: []; close: [] }>();

const systemStore = useSystemStore();
const toast = useToastStore();

const saving = ref(false);
const tagsText = ref('');
const form = ref<SystemInput>({
  name: '', url: '', environment: 'development', icon: '', iconColor: '', favorite: false, sort: 0, remark: '',
});

function close() {
  emit('close');
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
  } catch (e) {
    toast.error((e as Error).message || '创建失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.form-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
}
.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-md) var(--gap-lg);
  background: var(--bg-pure);
  border-bottom: 1px solid var(--border-soft);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  flex-shrink: 0;
}
.form-header i {
  cursor: pointer;
  color: var(--text-tertiary);
  font-size: var(--text-base);
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}
.form-header i:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}
.form-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--gap-md) var(--gap-lg);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}
.form-row label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}
.form-row label .req { color: var(--danger); margin-left: 2px; }
.form-input, .form-select, .form-textarea {
  width: 100%;
  height: var(--control-h);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 0 14px;
  font-size: var(--text-sm);
  outline: none;
  font-family: inherit;
  background: var(--bg-pure);
  color: var(--text-primary);
  transition: var(--transition-fast);
}
.form-input::placeholder, .form-textarea::placeholder { color: var(--text-quaternary); }
.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}
.form-textarea {
  height: auto;
  padding: 10px 14px;
  resize: vertical;
  min-height: 72px;
  line-height: var(--leading-normal);
}

.form-footer {
  display: flex;
  gap: var(--gap-sm);
  padding: var(--gap-md) var(--gap-lg);
  background: var(--bg-pure);
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.form-footer .btn-default,
.form-footer .btn-primary {
  flex: 1;
  height: var(--control-h);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
  transition: var(--transition-fast);
}
.form-footer .btn-default {
  background: var(--panel);
  color: var(--text-secondary);
  border-color: var(--border-strong);
}
.form-footer .btn-default:hover {
  background: var(--panel2);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.form-footer .btn-primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 14px -4px var(--glow), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.form-footer .btn-primary:hover {
  background: var(--primary-hover);
  filter: brightness(1.07);
  box-shadow: 0 6px 20px -4px var(--glow), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.form-footer .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
  filter: none;
}
</style>
