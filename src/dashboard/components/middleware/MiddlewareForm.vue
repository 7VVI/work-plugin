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
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.modal-dialog { background: white; border-radius: 8px; padding: 20px; min-width: 480px; max-width: 600px; max-height: 80vh; overflow-y: auto; }
.modal-header h3 { margin: 0 0 12px; font-size: 15px; }
.form-row { display: flex; align-items: flex-start; margin-bottom: 10px; }
.form-label { width: 78px; font-size: 12px; color: var(--text-secondary); padding-top: 7px; flex-shrink: 0; }
.form-label .req { color: var(--danger); }
.form-input, .form-select, .form-textarea { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; outline: none; font-family: inherit; }
.form-textarea { height: 60px; padding: 6px 10px; resize: vertical; }
.pwd-field { position: relative; flex: 1; }
.pwd-field .form-input { padding-right: 32px; }
.pwd-field i { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-tertiary); font-size: 12px; }
.pwd-field i:hover { color: var(--text-primary); }
.extra-section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-soft); }
.section-title { font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.btn { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
</style>
