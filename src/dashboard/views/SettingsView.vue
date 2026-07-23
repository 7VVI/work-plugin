<template>
  <div class="settings-view">
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
    <section class="panel settings-section">
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
    </section>

    <!-- 快捷键 -->
    <section class="panel settings-section">
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

    <!-- 关于 -->
    <section class="panel settings-section about-card">
      <div class="about-logo">D</div>
      <div class="about-info">
        <div class="about-name">Dock for Chrome</div>
        <div class="about-version mono">v3.0.0 · Manifest V3 · Light Lab</div>
      </div>
      <div class="about-spacer"></div>
      <button class="btn btn-danger" @click="onClearAll"><i class="fa-solid fa-trash-can"></i> 清除所有数据</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { importExportService } from '@shared/services/importExportService';

const prefStore = usePrefStore();
const toast = useToastStore();
const dialog = useDialogStore();

const masterPwdOn = ref(false);

function toggleMasterPwd() {
  masterPwdOn.value = !masterPwdOn.value;
  toast.info(masterPwdOn.value ? '主密码已启用' : '主密码已关闭');
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
  max-width: 760px;
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
