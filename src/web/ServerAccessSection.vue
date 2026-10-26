<template>
  <section class="panel settings-section">
    <h3 class="section-title"><i class="fa-solid fa-user-shield section-icon"></i>服务端访问</h3>

    <div class="setting-row">
      <div class="setting-meta">
        <div class="setting-name">重新输入密钥周期</div>
        <div class="setting-desc">登录会话有效期，修改后会立即裁剪已有会话</div>
      </div>
      <div class="days-control">
        <input v-model.number="sessionDays" class="inp days-input" type="number" min="1" max="3650" />
        <span class="days-unit">天</span>
        <button class="btn-p btn-sm" :disabled="saving" @click="saveDays">保存</button>
      </div>
    </div>

    <div class="setting-row bordered">
      <div class="setting-meta">
        <div class="setting-name">会话管理</div>
        <div class="setting-desc">注销全部设备后，所有浏览器都需要重新输入密钥</div>
      </div>
      <button class="btn-g btn-sm" @click="revokeAll">注销全部设备</button>
    </div>

    <div class="setting-row bordered">
      <div class="setting-meta">
        <div class="setting-name">退出登录</div>
        <div class="setting-desc">退出当前云端面板会话</div>
      </div>
      <button class="btn-d btn-sm" @click="logout">退出登录</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { webApi } from './webApi';

const toast = useToastStore();
const dialog = useDialogStore();
const sessionDays = ref(30);
const saving = ref(false);

onMounted(async () => {
  try {
    const settings = await webApi.getSettings();
    sessionDays.value = settings.sessionDays;
  } catch {
    // 登录态失效时会触发全局 401 处理
  }
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function saveDays() {
  const days = Math.floor(Number(sessionDays.value));
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    toast.error('请输入 1–3650 天');
    return;
  }
  saving.value = true;
  try {
    const result = await webApi.updateSessionDays(days);
    sessionDays.value = result.sessionDays;
    toast.success(`会话有效期已设为 ${result.sessionDays} 天`);
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function revokeAll() {
  const ok = await dialog.confirm('注销全部设备', '所有浏览器都需要重新输入访问密钥，确认继续？');
  if (!ok) return;
  try {
    await webApi.revokeSessions();
    window.location.reload();
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

async function logout() {
  const ok = await dialog.confirm('退出登录', '退出后需要重新输入访问密钥；未同步的编辑会尝试在离开前推送。');
  if (!ok) return;
  try {
    await webApi.logout();
  } finally {
    window.location.reload();
  }
}
</script>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  margin: 0 0 var(--gap-lg);
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
.section-icon { color: var(--accent); font-size: var(--text-sm); }
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
.days-control {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.days-input { width: 88px; height: 30px; }
.days-unit { font-size: var(--text-xs); color: var(--text-tertiary); }
.btn-sm {
  padding: 4px 12px;
  font-size: var(--text-xs);
}
</style>
