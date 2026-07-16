<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-dialog">
        <div class="modal-header"><h3>{{ server ? '编辑服务器' : '新增服务器' }}</h3></div>
        <div class="modal-body">
          <div class="form-row"><div class="form-label">名称 <span class="req">*</span></div><input v-model="form.name" class="form-input" /></div>
          <div class="form-row"><div class="form-label">IP <span class="req">*</span></div><input v-model="form.ip" class="form-input" /></div>
          <div class="form-row"><div class="form-label">SSH 端口</div><input v-model.number="form.sshPort" class="form-input" type="number" /></div>
          <div class="form-row"><div class="form-label">账号</div><input v-model="form.username" class="form-input" /></div>
          <div class="form-row"><div class="form-label">密码</div><input v-model="form.password" class="form-input" type="password" /></div>
          <div class="form-row"><div class="form-label">SSH Key</div><textarea v-model="form.sshKey" class="form-textarea"></textarea></div>
          <div class="form-row"><div class="form-label">环境</div>
            <select v-model="form.environment" class="form-select">
              <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
            </select>
          </div>
          <div class="form-row"><div class="form-label">用途</div><input v-model="form.purpose" class="form-input" /></div>
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
import { ref, watch } from 'vue';
import type { Server, ServerInput } from '@shared/types/entities';
import { ENVIRONMENTS } from '@shared/types/enums';
import { useServerStore } from '@shared/stores/serverStore';
import { useToastStore } from '@shared/stores/toastStore';

const props = defineProps<{ visible: boolean; server: Server | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const store = useServerStore();
const toast = useToastStore();

const form = ref<ServerInput>({
  name: '', ip: '', sshPort: 22, username: '', password: '', sshKey: '',
  environment: 'development', purpose: '', remark: '', favorite: false,
});

watch(() => props.visible, (v) => {
  if (v) {
    if (props.server) {
      form.value = { ...props.server, password: '', sshKey: '' };
    } else {
      form.value = { name: '', ip: '', sshPort: 22, username: '', password: '', sshKey: '', environment: 'development', purpose: '', remark: '', favorite: false };
    }
  }
});

async function save() {
  if (props.server) {
    await store.update(props.server.id, form.value);
    toast.success('服务器已更新');
  } else {
    await store.create(form.value);
    toast.success('服务器已创建');
  }
  emit('saved');
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.modal-dialog { background: white; border-radius: 8px; padding: 20px; min-width: 480px; max-width: 600px; max-height: 80vh; overflow-y: auto; }
.modal-header h3 { margin: 0 0 12px; font-size: 15px; }
.form-row { display: flex; align-items: flex-start; margin-bottom: 10px; }
.form-label { width: 78px; font-size: 12px; color: var(--text-secondary); padding-top: 7px; flex-shrink: 0; }
.form-label .req { color: var(--danger); }
.form-field { flex: 1; }
.form-input, .form-select, .form-textarea { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; outline: none; font-family: inherit; }
.form-textarea { height: 60px; padding: 6px 10px; resize: vertical; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.btn { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
</style>
