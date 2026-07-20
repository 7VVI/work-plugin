<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-dialog">
        <div class="modal-header"><h3>{{ middleware ? '编辑中间件' : '新增中间件' }}</h3></div>
        <div class="modal-body">
          <div class="form-row"><div class="form-label">类型 <span class="req">*</span></div>
            <select v-model="form.type" class="form-select" @change="onTypeChange">
              <option v-for="t in MIDDLEWARE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div class="form-row"><div class="form-label">名称 <span class="req">*</span></div><input v-model="form.name" class="form-input" /></div>
          <div class="form-row"><div class="form-label">版本</div><input v-model="form.version" class="form-input" /></div>
          <div class="form-row"><div class="form-label">Host <span class="req">*</span></div><input v-model="form.host" class="form-input" /></div>
          <div class="form-row"><div class="form-label">端口</div><input v-model.number="form.port" class="form-input" type="number" /></div>
          <div class="form-row"><div class="form-label">数据库</div><input v-model="form.database" class="form-input" /></div>
          <div class="form-row"><div class="form-label">账号</div><input v-model="form.username" class="form-input" /></div>
          <div class="form-row"><div class="form-label">密码</div>
            <div class="pwd-field">
              <input v-model="form.password" :type="showPwd ? 'text' : 'password'" class="form-input" :placeholder="middleware ? '留空则不修改' : ''" />
              <i :class="showPwd ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" @click="showPwd = !showPwd"></i>
            </div>
          </div>
          <div v-if="extraFields.length > 0" class="extra-section">
            <div class="section-title">额外参数</div>
            <div v-for="field in extraFields" :key="field.key" class="form-row">
              <div class="form-label">{{ field.label }}</div>
              <input v-model="extraValues[field.key]" :type="field.type === 'number' ? 'number' : 'text'" class="form-input" :placeholder="field.placeholder" />
            </div>
          </div>
          <div class="form-row"><div class="form-label">备注</div><textarea v-model="form.remark" class="form-textarea"></textarea></div>
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
import { ref, computed, watch } from 'vue';
import type { Middleware, MiddlewareInput } from '@shared/types/entities';
import { MIDDLEWARE_TYPES } from '@shared/types/enums';
import { MIDDLEWARE_EXTRA_SCHEMAS } from '@shared/types/middlewareSchemas';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';
import { cryptoService } from '@shared/services/cryptoService';

const props = defineProps<{ visible: boolean; middleware: Middleware | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const store = useMiddlewareStore();
const toast = useToastStore();
const showPwd = ref(false);

const form = ref<MiddlewareInput>({
  type: 'redis', name: '', version: '', host: '', port: 6379, database: '',
  username: '', password: '', extra: {}, remark: '', favorite: false,
});
const extraValues = ref<Record<string, unknown>>({});

const extraFields = computed(() => MIDDLEWARE_EXTRA_SCHEMAS[form.value.type] ?? []);

watch(() => props.visible, async (v) => {
  if (v) {
    showPwd.value = false;
    if (props.middleware) {
      const { password: _p, ...rest } = props.middleware;
      form.value = { ...rest, password: '' } as MiddlewareInput;
      if (props.middleware.password) {
        try {
          form.value.password = await cryptoService.decryptField(props.middleware.password);
        } catch {
          form.value.password = '';
        }
      }
      extraValues.value = { ...(props.middleware.extra ?? {}) };
    } else {
      form.value = { type: 'redis', name: '', version: '', host: '', port: 6379, database: '', username: '', password: '', extra: {}, remark: '', favorite: false };
      extraValues.value = {};
      onTypeChange();
    }
  }
});

function onTypeChange() {
  extraValues.value = {};
  const schema = MIDDLEWARE_EXTRA_SCHEMAS[form.value.type];
  for (const field of schema) {
    if (field.defaultValue !== undefined) extraValues.value[field.key] = field.defaultValue;
  }
  // Update default port
  const defaultPorts: Record<string, number> = { mysql: 3306, redis: 6379, rabbitmq: 5672, mongodb: 27017, elasticsearch: 9200 };
  if (defaultPorts[form.value.type]) form.value.port = defaultPorts[form.value.type];
}

async function save() {
  if (!form.value.name.trim()) { toast.error('请填写名称'); return; }
  if (!form.value.host.trim()) { toast.error('请填写 Host'); return; }
  const port = Number(form.value.port);
  if (!port || port <= 0) { toast.error('请填写有效的端口'); return; }
  form.value.port = port;
  form.value.extra = { ...extraValues.value };
  try {
    if (props.middleware) {
      await store.update(props.middleware.id, form.value);
      toast.success('中间件已更新');
    } else {
      await store.create(form.value);
      toast.success('中间件已创建');
    }
    emit('saved');
  } catch (e) {
    toast.error((e as Error).message || '保存失败');
  }
}
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
  width: 540px;
  max-width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-soft);
}
.modal-header {
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
.modal-body {
  padding: 8px 24px 8px;
  overflow-y: auto;
  flex: 1;
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
.form-input:hover, .form-select:hover, .form-textarea:hover { border-color: var(--text-quaternary); }
.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}
.form-textarea {
  height: auto;
  padding: 10px 14px;
  resize: vertical;
  min-height: 80px;
  line-height: var(--leading-normal);
}
.pwd-field { position: relative; flex: 1; }
.pwd-field .form-input { padding-right: 40px; }
.pwd-field i {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: var(--text-quaternary);
  font-size: var(--text-sm);
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}
.pwd-field i:hover { color: var(--primary); background: var(--primary-50); }
.extra-section {
  margin-top: var(--gap-lg);
  padding-top: var(--gap-md);
  border-top: 1px solid var(--border-soft);
}
.section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  margin-bottom: var(--gap-md);
  color: var(--text-tertiary);
  letter-spacing: 0.4px;
  text-transform: uppercase;
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
