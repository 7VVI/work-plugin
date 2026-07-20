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
          <button class="btn-cancel" @click="$emit('close')">取消</button>
          <button class="btn-save" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
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
.acc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10001; }
.acc-dialog { background: white; border-radius: 8px; padding: 20px; width: 400px; max-width: 90vw; }
.acc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.acc-header h3 { margin: 0; font-size: 15px; color: var(--text-primary); }
.icon-btn { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); cursor: pointer; }
.icon-btn:hover { background: var(--border-soft); }
.acc-body { display: flex; flex-direction: column; gap: 12px; }
.form-row { display: flex; flex-direction: column; gap: 4px; }
.form-row label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.form-row label .req { color: var(--danger); }
.form-input, .form-textarea { width: 100%; height: 32px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 13px; outline: none; font-family: inherit; background: white; color: var(--text-primary); }
.form-textarea { height: 60px; padding: 6px 10px; resize: none; }
.form-input:focus, .form-textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
.pwd-wrap { position: relative; }
.pwd-wrap .form-input { padding-right: 32px; }
.pwd-wrap i { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-tertiary); font-size: 13px; }
.pwd-wrap i:hover { color: var(--text-primary); }
.checkbox-row { flex-direction: row; align-items: center; }
.checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: var(--text-primary); }
.checkbox-label input { width: 14px; height: 14px; accent-color: var(--primary); }
.acc-footer { display: flex; gap: 8px; margin-top: 16px; }
.btn-cancel, .btn-save { flex: 1; height: 34px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-cancel { background: var(--border-soft); color: var(--text-secondary); }
.btn-save { background: var(--primary); color: white; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
