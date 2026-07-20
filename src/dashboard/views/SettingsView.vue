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
.settings-view {
  padding: var(--gap-lg) var(--page-pad) var(--page-pad);
  max-width: 720px;
  height: 100%;
  overflow-y: auto;
}
.settings-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--gap-xl);
  margin-bottom: var(--gap-lg);
  box-shadow: var(--shadow-sm);
}
.settings-section h3 {
  margin: 0 0 var(--gap-lg);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}
.crypto-section .status {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--gap-md);
  display: inline-flex;
  align-items: center;
  gap: var(--gap-sm);
}
.crypto-section .status::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--text-quaternary);
}
.form-row {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  margin-bottom: var(--gap-md);
}
.form-row label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  width: 120px;
  flex-shrink: 0;
  font-weight: var(--font-medium);
}
.form-input.small { max-width: 120px; flex: 0 0 auto; }
.button-group {
  display: flex;
  gap: var(--gap-sm);
  margin-bottom: var(--gap-md);
  flex-wrap: wrap;
}
.hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--gap-sm);
  line-height: var(--leading-normal);
}
.danger-zone {
  border-color: var(--danger-light);
  background: linear-gradient(180deg, rgba(254, 226, 226, 0.3) 0%, var(--card-bg) 60%);
}
.danger-zone h3 { color: var(--danger-text); }
</style>
