<template>
  <div class="settings-view">
    <div class="settings-grid">
    <!-- 外观 -->
    <section class="panel settings-section">
      <h3 class="section-title"><i class="fa-solid fa-palette section-icon"></i>外观</h3>
      <div class="setting-row">
        <div class="setting-meta">
          <div class="setting-name">主题模式</div>
          <div class="setting-desc">控制台与弹窗的显示主题</div>
        </div>
        <div class="seg-group">
          <button class="seg-btn" :class="{ on: prefStore.theme === 'light' }" @click="prefStore.theme = 'light'">浅色</button>
          <button class="seg-btn" :class="{ on: prefStore.theme === 'dark' }" @click="prefStore.theme = 'dark'">深色</button>
          <button class="seg-btn" :class="{ on: prefStore.theme === 'system' }" @click="prefStore.theme = 'system'">跟随系统</button>
        </div>
      </div>
    </section>

    <!-- 安全 -->
    <section v-if="!isWeb" class="panel settings-section">
      <h3 class="section-title"><i class="fa-solid fa-shield-halved section-icon"></i>安全</h3>
      <div class="setting-row">
        <div class="setting-meta">
          <div class="setting-name">自动锁定</div>
          <div class="setting-desc">空闲后需要重新输入主密码</div>
        </div>
        <select v-model.number="prefStore.autoLockMinutes" class="inp auto-lock-select">
          <option :value="0">从不</option>
          <option :value="5">5 分钟</option>
          <option :value="15">15 分钟</option>
          <option :value="60">1 小时</option>
        </select>
      </div>
      <div class="setting-row bordered">
        <div class="setting-meta">
          <div class="setting-name">启用主密码</div>
          <div class="setting-desc">打开弹窗前需要验证主密码</div>
        </div>
        <div class="sw" :class="{ on: masterPwdOn }" @click="toggleMasterPwd"></div>
      </div>

      <!-- 主密码设置 / 修改 -->
      <div v-if="masterPwdOn" class="master-pwd-section">
        <div v-if="hasMasterPwd" class="setting-row bordered">
          <div class="setting-meta">
            <div class="setting-name">修改主密码</div>
            <div class="setting-desc">输入当前密码和新密码来更新</div>
          </div>
          <button class="btn-p btn-sm" @click="showChangePwd = !showChangePwd">
            <i class="fa-solid fa-key"></i>{{ showChangePwd ? '收起' : '修改密码' }}
          </button>
        </div>
        <div v-if="hasMasterPwd && showChangePwd" class="pwd-form">
          <div class="pwd-field">
            <label class="pwd-label">当前密码</label>
            <input
              v-model="currentPwd"
              type="password"
              class="inp pwd-input"
              placeholder="输入当前主密码"
              @keyup.enter="onChangePwd"
            />
          </div>
          <div class="pwd-field">
            <label class="pwd-label">新密码</label>
            <input
              v-model="newPwd"
              type="password"
              class="inp pwd-input"
              placeholder="输入新主密码（至少 4 位）"
              @keyup.enter="onChangePwd"
            />
          </div>
          <div class="pwd-field">
            <label class="pwd-label">确认新密码</label>
            <input
              v-model="confirmPwd"
              type="password"
              class="inp pwd-input"
              placeholder="再次输入新密码"
              @keyup.enter="onChangePwd"
            />
          </div>
          <button class="btn-p" :disabled="changePwdLoading" @click="onChangePwd">
            <i class="fa-solid fa-check"></i>确认修改
          </button>
        </div>

        <div v-if="!hasMasterPwd" class="pwd-form">
          <div class="setting-row bordered">
            <div class="setting-meta">
              <div class="setting-name">设置主密码</div>
              <div class="setting-desc">首次设置后，解锁需输入此密码</div>
            </div>
          </div>
          <div class="pwd-field">
            <label class="pwd-label">主密码</label>
            <input
              v-model="newPwd"
              type="password"
              class="inp pwd-input"
              placeholder="输入主密码（至少 4 位）"
              @keyup.enter="onSetPwd"
            />
          </div>
          <div class="pwd-field">
            <label class="pwd-label">确认密码</label>
            <input
              v-model="confirmPwd"
              type="password"
              class="inp pwd-input"
              placeholder="再次输入主密码"
              @keyup.enter="onSetPwd"
            />
          </div>
          <button class="btn-p" :disabled="changePwdLoading" @click="onSetPwd">
            <i class="fa-solid fa-check"></i>设置密码
          </button>
        </div>
      </div>
    </section>

    <!-- 快捷键 -->
    <section v-if="!isWeb" class="panel settings-section">
      <h3 class="section-title"><i class="fa-solid fa-keyboard section-icon"></i>快捷键</h3>
      <ul class="kbd-list">
        <li>
          <span class="kbd-label">弹窗中聚焦搜索</span>
          <span class="kbd-group"><span class="kbd">Ctrl</span><span class="kbd">K</span></span>
        </li>
        <li>
          <span class="kbd-label">关闭弹窗</span>
          <span class="kbd-group"><span class="kbd">Esc</span></span>
        </li>
        <li>
          <span class="kbd-label">弹窗中上下选择系统</span>
          <span class="kbd-group"><span class="kbd">↑</span><span class="kbd">↓</span></span>
        </li>
        <li>
          <span class="kbd-label">打开选中系统</span>
          <span class="kbd-group"><span class="kbd">Enter</span></span>
        </li>
      </ul>
    </section>

    <!-- 云端同步 -->
    <CloudSyncSection v-if="!isWeb" />

    <!-- 服务端访问（Web 面板） -->
    <ServerAccessSection v-if="isWeb" />

    <!-- 关于 -->
    <section class="panel settings-section about-card">
      <div class="about-logo">D</div>
      <div class="about-info">
        <div class="about-name">{{ isWeb ? 'Dock Cloud' : 'Dock for Chrome' }}</div>
        <div class="about-version mono">1.0.0</div>
      </div>
      <div class="about-spacer"></div>
      <button v-if="!isWeb" class="btn btn-danger" @click="onClearAll"><i class="fa-solid fa-trash-can"></i> 清除所有数据</button>
    </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { importExportService } from '@shared/services/importExportService';
import { cryptoService } from '@shared/services/cryptoService';
import { isWeb } from '@shared/platform';
import CloudSyncSection from '../components/settings/CloudSyncSection.vue';
import ServerAccessSection from '../../web/ServerAccessSection.vue';

const prefStore = usePrefStore();
const toast = useToastStore();
const dialog = useDialogStore();

const masterPwdOn = ref(false);
const hasMasterPwd = ref(false);
const showChangePwd = ref(false);
const currentPwd = ref('');
const newPwd = ref('');
const confirmPwd = ref('');
const changePwdLoading = ref(false);

onMounted(async () => {
  hasMasterPwd.value = await cryptoService.isEnabled();
  masterPwdOn.value = hasMasterPwd.value;
});

async function toggleMasterPwd() {
  if (masterPwdOn.value) {
    const pwd = await dialog.prompt('关闭主密码', '输入当前主密码以解密现有数据', '', 'password');
    if (!pwd) return;
    try {
      await cryptoService.disablePassword(pwd);
      masterPwdOn.value = false;
      hasMasterPwd.value = false;
      toast.info('主密码已关闭');
    } catch (e: any) {
      toast.error(e?.message || '关闭失败');
    }
  } else {
    masterPwdOn.value = true;
  }
}

async function onSetPwd() {
  if (newPwd.value.length < 4) { toast.error('密码至少 4 位'); return; }
  if (newPwd.value !== confirmPwd.value) { toast.error('两次输入不一致'); return; }
  changePwdLoading.value = true;
  try {
    await cryptoService.setPassword(newPwd.value);
    hasMasterPwd.value = true;
    masterPwdOn.value = true;
    newPwd.value = '';
    confirmPwd.value = '';
    toast.success('主密码已设置');
  } catch (e: any) {
    toast.error('设置失败: ' + (e.message || e));
  } finally {
    changePwdLoading.value = false;
  }
}

async function onChangePwd() {
  if (!currentPwd.value) { toast.error('请输入当前密码'); return; }
  if (newPwd.value.length < 4) { toast.error('新密码至少 4 位'); return; }
  if (newPwd.value !== confirmPwd.value) { toast.error('两次输入不一致'); return; }
  changePwdLoading.value = true;
  try {
    await cryptoService.changePassword(currentPwd.value, newPwd.value);
    currentPwd.value = '';
    newPwd.value = '';
    confirmPwd.value = '';
    showChangePwd.value = false;
    toast.success('主密码已更新');
  } catch (e: any) {
    toast.error('修改失败: ' + (e.message || e));
  } finally {
    changePwdLoading.value = false;
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
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  height: 100%;
  overflow-y: auto;
}
.settings-grid {
  max-width: none;
  margin: 0;
  column-count: 2;
  column-gap: clamp(16px, 2vw, 32px);
}
.settings-section {
  padding: var(--gap-xl);
  margin: 0 0 var(--gap-lg);
  width: 100%;
  break-inside: avoid;
}
@media (max-width: 980px) {
  .settings-grid {
    column-count: 1;
    max-width: 760px;
    margin: 0 auto;
  }
}
.section-title {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  margin: 0 0 var(--gap-lg);
  font-size: var(--text-md);
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
  color: var(--accent);
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-lg);
}
.setting-row.bordered {
  margin-top: var(--gap-lg);
  padding-top: var(--gap-lg);
  border-top: 1px solid var(--border);
}
.setting-meta { min-width: 0; }
.setting-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}
.setting-desc {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
.auto-lock-select { width: 144px; flex: none; }

/* 主密码 */
.master-pwd-section { margin-top: var(--gap-md); }
.pwd-form {
  margin-top: var(--gap-lg);
  padding-top: var(--gap-lg);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
  max-width: 380px;
}
.pwd-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pwd-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}
.pwd-input {
  width: 100%;
}
.btn-sm {
  padding: 4px 12px;
  font-size: var(--text-xs);
}

.kbd-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}
.kbd-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--text-secondary);
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
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
.about-version {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
.about-spacer { flex: 1; }
</style>
