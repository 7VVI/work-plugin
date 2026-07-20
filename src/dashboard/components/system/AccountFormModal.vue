<template>
  <teleport to="body">
    <div v-if="visible" class="acc-overlay" @click.self="$emit('close')">
      <div class="acc-dialog">
        <div class="acc-header">
          <h3>{{ account ? '编辑账号' : '新增账号' }}</h3>
          <div class="icon-btn" @click="$emit('close')"><i class="fa-solid fa-xmark"></i></div>
        </div>
        <div class="acc-body">
          <div class="form-row">
            <label>角色 <span class="req">*</span></label>
            <input v-model="form.role" class="form-input" placeholder="如：管理员、开发、测试" />
          </div>
          <div class="form-row">
            <label>用户名 <span class="req">*</span></label>
            <input v-model="form.username" class="form-input" placeholder="登录用户名" />
          </div>
          <div class="form-row">
            <label>密码 <span class="req">*</span></label>
            <div class="pwd-wrap">
              <input v-model="form.password" :type="showPwd ? 'text' : 'password'" class="form-input" placeholder="登录密码" />
              <i :class="showPwd ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" @click="showPwd = !showPwd"></i>
            </div>
          </div>
          <div class="form-row checkbox-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.isDefault" />
              <span>设为默认账号</span>
            </label>
          </div>
          <div class="form-row">
            <label>备注</label>
            <textarea v-model="form.remark" class="form-textarea" placeholder="备注信息..."></textarea>
          </div>
        </div>
        <div class="acc-footer">
          <button class="btn btn-default" @click="$emit('close')">取消</button>
          <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Account, AccountInput } from '@shared/types/entities';
import { useAccountStore } from '@shared/stores/accountStore';
import { useToastStore } from '@shared/stores/toastStore';

const props = defineProps<{ visible: boolean; account: Account | null; systemId: string; existingCount: number }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const accountStore = useAccountStore();
const toast = useToastStore();

const saving = ref(false);
const showPwd = ref(false);
const form = ref<AccountInput & { password: string }>({
  systemId: '', role: '', username: '', password: '', isDefault: false, remark: '',
});

watch(() => props.visible, (v) => {
  if (!v) return;
  showPwd.value = false;
  if (props.account) {
    form.value = {
      systemId: props.systemId,
      role: props.account.role,
      username: props.account.username,
      password: '',
      isDefault: props.account.isDefault,
      remark: props.account.remark,
    };
  } else {
    form.value = {
      systemId: props.systemId,
      role: '', username: '', password: '',
      isDefault: props.existingCount === 0,
      remark: '',
    };
  }
}, { immediate: true });

async function save() {
  if (!form.value.role.trim()) { toast.error('请填写角色'); return; }
  if (!form.value.username.trim()) { toast.error('请填写用户名'); return; }
  if (!form.value.password.trim()) { toast.error('请填写密码'); return; }
  saving.value = true;
  try {
    if (props.account) {
      await accountStore.update(props.account.id, props.systemId, {
        role: form.value.role,
        username: form.value.username,
        password: form.value.password,
        isDefault: form.value.isDefault,
        remark: form.value.remark,
      });
      toast.success('账号已更新');
    } else {
      await accountStore.create({
        systemId: props.systemId,
        role: form.value.role,
        username: form.value.username,
        password: form.value.password,
        isDefault: form.value.isDefault,
        remark: form.value.remark,
      });
      toast.success('账号已创建');
    }
    emit('saved');
  } catch (e) {
    toast.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.acc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-top);
  padding: 24px;
}
.acc-dialog {
  background: var(--bg-pure);
  border-radius: var(--radius-xl);
  padding: 4px 0 0;
  width: 420px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-soft);
}
.acc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 12px;
  flex-shrink: 0;
}
.acc-header h3 {
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
.icon-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
.acc-body {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
  padding: 4px 24px 8px;
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}
.form-row label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}
.form-row label .req { color: var(--danger); margin-left: 2px; }
.form-input, .form-textarea {
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
.form-input:hover, .form-textarea:hover { border-color: var(--text-quaternary); }
.form-input:focus, .form-textarea:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}
.form-textarea {
  height: auto;
  padding: 10px 14px;
  resize: vertical;
  min-height: 72px;
}
.pwd-wrap { position: relative; }
.pwd-wrap .form-input { padding-right: 40px; }
.pwd-wrap i {
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
.pwd-wrap i:hover { color: var(--primary); background: var(--primary-50); }
.checkbox-row { flex-direction: row; align-items: center; }
.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--text-primary);
  user-select: none;
}
.checkbox-label input { width: 16px; height: 16px; }
.acc-footer {
  display: flex;
  gap: var(--gap-md);
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-soft);
  margin-top: var(--gap-md);
  flex-shrink: 0;
}
</style>
