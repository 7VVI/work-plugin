<template>
  <div class="settings-view">
    <div class="settings-section">
      <h3>主密码</h3>
      <div v-if="!cryptoStore.enabled" class="crypto-section">
        <p class="status">状态: 未设置</p>
        <div class="form-row">
          <input v-model="setupPassword" type="password" placeholder="设置主密码" class="form-input" />
          <button class="btn btn-primary" @click="onSetup">设置主密码</button>
        </div>
        <p class="hint">设置后，所有密码类字段将被 AES-GCM 加密存储。请牢记主密码，丢失后数据无法恢复。</p>
      </div>
      <div v-else class="crypto-section">
        <p class="status">状态: {{ cryptoStore.unlocked ? '已解锁' : '已锁定' }}</p>
        <div v-if="!cryptoStore.unlocked" class="form-row">
          <input v-model="unlockPassword" type="password" placeholder="输入主密码" class="form-input" />
          <button class="btn btn-primary" @click="onUnlock">解锁</button>
        </div>
        <div v-else class="button-group">
          <button class="btn btn-default" @click="cryptoStore.lock()">锁定</button>
          <button class="btn btn-default" @click="onChangePassword">修改密码</button>
          <button class="btn btn-danger" @click="onDisable">禁用主密码</button>
        </div>
        <div class="form-row">
          <label>自动锁定 (分钟):</label>
          <input v-model.number="prefStore.autoLockMinutes" type="number" min="1" max="60" class="form-input small" />
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>偏好</h3>
      <div class="form-row">
        <label>主题:</label>
        <select v-model="prefStore.theme" class="form-select">
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </div>
      <div class="form-row">
        <label>默认环境:</label>
        <select v-model="prefStore.defaultEnvironment" class="form-select">
          <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Popup 布局:</label>
        <select v-model="prefStore.popupLayout" class="form-select">
          <option value="compact">紧凑</option>
          <option value="expanded">展开</option>
        </select>
      </div>
    </div>

    <div class="settings-section danger-zone">
      <h3>危险区</h3>
      <button class="btn btn-danger" @click="onClearAll">清空所有数据</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCryptoStore } from '@shared/stores/cryptoStore';
import { usePrefStore } from '@shared/stores/prefStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { importExportService } from '@shared/services/importExportService';
import { ENVIRONMENTS } from '@shared/types/enums';

const cryptoStore = useCryptoStore();
const prefStore = usePrefStore();
const toast = useToastStore();
const dialog = useDialogStore();

const setupPassword = ref('');
const unlockPassword = ref('');

async function onSetup() {
  if (setupPassword.value.length < 4) {
    toast.error('密码至少 4 位');
    return;
  }
  await cryptoStore.setup(setupPassword.value);
  setupPassword.value = '';
  toast.success('主密码已设置');
}

async function onUnlock() {
  const ok = await cryptoStore.unlock(unlockPassword.value);
  if (ok) toast.success('已解锁');
  else toast.error('密码错误');
  unlockPassword.value = '';
}

async function onChangePassword() {
  const oldPwd = await dialog.prompt('修改密码', '请输入当前密码');
  if (!oldPwd) return;
  const newPwd = await dialog.prompt('修改密码', '请输入新密码');
  if (!newPwd) return;
  try {
    await cryptoStore.changePassword(oldPwd, newPwd);
    toast.success('密码已修改');
  } catch {
    toast.error('当前密码错误');
  }
}

async function onDisable() {
  const pwd = await dialog.prompt('禁用主密码', '输入主密码以禁用');
  if (!pwd) return;
  try {
    await cryptoStore.disablePassword(pwd);
    toast.success('主密码已禁用，密码字段恢复明文存储');
  } catch {
    toast.error('密码错误');
  }
}

async function onClearAll() {
  const ok1 = await dialog.confirm('确认清空', '确认清空所有数据？此操作不可恢复！');
  if (!ok1) return;
  const ok2 = await dialog.confirm('再次确认', '所有系统、账号、服务器、中间件将被永久删除。');
  if (!ok2) return;
  await importExportService.clearAll();
  toast.success('所有数据已清空');
}
</script>

<style scoped>
.settings-view { padding: 14px var(--page-pad); max-width: 640px; height: 100%; overflow-y: auto; }
.settings-section { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px; margin-bottom: 14px; }
.settings-section h3 { margin: 0 0 14px; font-size: 14px; font-weight: 600; color: var(--text-primary); }
.crypto-section .status { font-size: 13px; color: var(--text-secondary); margin: 0 0 10px; }
.form-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.form-row label { font-size: 13px; color: var(--text-secondary); width: 110px; flex-shrink: 0; }
.form-input, .form-select {
  height: 34px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 0 12px; font-size: 13px; outline: none; font-family: inherit;
  flex: 1; background: var(--card-bg); color: var(--text-primary);
  transition: var(--transition);
}
.form-input:focus, .form-select:focus { border-color: var(--text-primary); box-shadow: var(--shadow-focus); }
.form-input.small { max-width: 100px; }
.button-group { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 14px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500; cursor: pointer;
  border: 1px solid transparent; font-family: inherit;
  transition: var(--transition);
}
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-hover); }
.btn-default { background: var(--card-bg); color: var(--text-primary); border-color: var(--border); }
.btn-default:hover { border-color: var(--text-primary); }
.btn-danger { background: var(--card-bg); color: var(--danger); border-color: var(--danger-light); }
.btn-danger:hover { background: var(--danger-light); }
.hint { font-size: 12px; color: var(--text-tertiary); margin-top: 8px; line-height: 1.6; }
.danger-zone { border-color: var(--danger-light); }
</style>
