<template>
  <div class="settings-view">
    <!-- 主密码 -->
    <section class="panel settings-section">
      <h3 class="section-title">
        <i class="fa-solid fa-shield-halved section-icon"></i>
        主密码
      </h3>
      <div v-if="!cryptoStore.enabled" class="crypto-section">
        <p class="status">
          <span class="status-dot"></span>
          状态: 未设置
        </p>
        <div class="form-row">
          <input v-model="setupPassword" type="password" placeholder="设置主密码" class="form-input" />
          <button class="btn btn-primary" @click="onSetup">设置主密码</button>
        </div>
        <p class="hint">设置后，所有密码类字段将被 AES-GCM 加密存储。请牢记主密码，丢失后数据无法恢复。</p>
      </div>
      <div v-else class="crypto-section">
        <p class="status">
          <span class="status-dot" :class="{ on: cryptoStore.unlocked }"></span>
          状态: {{ cryptoStore.unlocked ? '已解锁' : '已锁定' }}
        </p>
        <div v-if="!cryptoStore.unlocked" class="form-row">
          <input v-model="unlockPassword" type="password" placeholder="输入主密码" class="form-input" />
          <button class="btn btn-primary" @click="onUnlock">解锁</button>
        </div>
        <div v-else class="button-group">
          <button class="btn btn-default" @click="cryptoStore.lock()"><i class="fa-solid fa-lock"></i> 锁定</button>
          <button class="btn btn-default" @click="onChangePassword"><i class="fa-solid fa-key"></i> 修改密码</button>
          <button class="btn btn-danger" @click="onDisable"><i class="fa-solid fa-ban"></i> 禁用主密码</button>
        </div>
        <div class="form-row">
          <label class="row-label">自动锁定 (分钟):</label>
          <input v-model.number="prefStore.autoLockMinutes" type="number" min="1" max="60" class="form-input small" />
        </div>
      </div>
    </section>

    <!-- 偏好 -->
    <section class="panel settings-section">
      <h3 class="section-title">
        <i class="fa-solid fa-sliders section-icon"></i>
        偏好
      </h3>
      <div class="form-row">
        <label class="row-label">主题:</label>
        <div class="seg-group">
          <button
            class="seg-btn"
            :class="{ on: prefStore.theme === 'light' }"
            @click="prefStore.theme = 'light'"
          >
            <i class="fa-solid fa-sun"></i> 浅色
          </button>
          <button
            class="seg-btn"
            :class="{ on: prefStore.theme === 'dark' }"
            @click="prefStore.theme = 'dark'"
          >
            <i class="fa-solid fa-moon"></i> 深色
          </button>
        </div>
      </div>
      <div class="form-row">
        <label class="row-label">默认环境:</label>
        <select v-model="prefStore.defaultEnvironment" class="form-select">
          <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
        </select>
      </div>
      <div class="form-row">
        <label class="row-label">Popup 布局:</label>
        <select v-model="prefStore.popupLayout" class="form-select">
          <option value="compact">紧凑</option>
          <option value="expanded">展开</option>
        </select>
      </div>
    </section>

    <!-- 快捷键 -->
    <section class="panel settings-section">
      <h3 class="section-title">
        <i class="fa-solid fa-keyboard section-icon"></i>
        快捷键
      </h3>
      <ul class="kbd-list">
        <li>
          <span class="kbd-label">快速搜索</span>
          <span class="kbd-group"><span class="kbd">Ctrl</span><span class="kbd">K</span></span>
        </li>
        <li>
          <span class="kbd-label">关闭弹层</span>
          <span class="kbd-group"><span class="kbd">Esc</span></span>
        </li>
        <li>
          <span class="kbd-label">切换条目</span>
          <span class="kbd-group"><span class="kbd">↑</span><span class="kbd">↓</span></span>
        </li>
        <li>
          <span class="kbd-label">确认选择</span>
          <span class="kbd-group"><span class="kbd">Enter</span></span>
        </li>
      </ul>
    </section>

    <!-- 关于 -->
    <section class="panel settings-section about-card">
      <div class="about-logo">D</div>
      <div class="about-info">
        <div class="about-name">Dock for Chrome</div>
        <div class="about-version mono">v3.0.0 · Manifest V3</div>
      </div>
    </section>

    <!-- 危险区 -->
    <section class="panel settings-section danger-zone">
      <h3 class="section-title">
        <i class="fa-solid fa-triangle-exclamation section-icon danger"></i>
        危险区
      </h3>
      <button class="btn btn-danger" @click="onClearAll">
        <i class="fa-solid fa-trash"></i> 清空所有数据
      </button>
    </section>
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
  padding: var(--gap-xl);
  margin-bottom: var(--gap-lg);
}
.section-title {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  margin: 0 0 var(--gap-lg);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}
.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--primary-50);
  color: var(--primary);
  font-size: var(--text-sm);
  flex-shrink: 0;
}
.section-icon.danger { background: var(--danger-light); color: var(--danger); }

.crypto-section .status {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--gap-md);
  display: inline-flex;
  align-items: center;
  gap: var(--gap-sm);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--text-quaternary);
  flex-shrink: 0;
}
.crypto-section .status-dot.on {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}
.form-row {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  margin-bottom: var(--gap-md);
}
.form-row:last-child { margin-bottom: 0; }
.row-label {
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
  margin-bottom: 0;
  line-height: var(--leading-normal);
}

.kbd-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}
.kbd-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--gap-xs) 0;
}
.kbd-label { color: var(--text-secondary); }
.kbd-group { display: inline-flex; align-items: center; gap: 4px; }

.about-card {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
}
.about-logo {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--accent), var(--primary-hover));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  box-shadow: 0 5px 14px -4px var(--glow);
  flex-shrink: 0;
}
.about-info { display: flex; flex-direction: column; gap: 2px; }
.about-name {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
.about-version {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.danger-zone {
  border-color: var(--danger-light);
  background: linear-gradient(180deg, var(--danger-light) 0%, var(--panel) 65%);
}
.danger-zone .section-title { color: var(--danger-text); }
</style>
