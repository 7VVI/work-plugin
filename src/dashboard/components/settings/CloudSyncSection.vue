<template>
  <section class="panel settings-section">
    <h3 class="section-title"><i class="fa-solid fa-cloud section-icon"></i>云端同步</h3>

    <div class="setting-row">
      <div class="setting-meta">
        <div class="setting-name">启用云端持久化</div>
        <div class="setting-desc">保存后自动把全部资产与配置同步到云端</div>
      </div>
      <div class="sw" :class="{ on: enabled, disabled: saving }" @click="onToggleEnabled"></div>
    </div>

    <div class="pwd-form cloud-form">
      <div class="pwd-field">
        <label class="pwd-label">云端地址</label>
        <input v-model="endpoint" class="inp" placeholder="https://dock.example.com 或 http://192.168.1.10:8080" />
        <div v-if="insecureHttp" class="cloud-warn">
          <i class="fa-solid fa-triangle-exclamation"></i>当前使用 HTTP，数据会明文传输；仅建议内网使用，公网请配置 HTTPS。
        </div>
      </div>
      <div class="pwd-field">
        <label class="pwd-label">API Token</label>
        <div class="token-wrap">
          <input
            v-model="tokenInput"
            :type="showToken ? 'text' : 'password'"
            class="inp pwd-input"
            :placeholder="store.hasToken ? '已保存（留空保持不变）' : '输入云端 API Token'"
          />
          <button class="ibtn token-eye" type="button" :title="showToken ? '隐藏' : '显示'" @click="showToken = !showToken">
            <i :class="showToken ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
          </button>
        </div>
      </div>
      <div class="cloud-actions">
        <button class="btn-g btn-sm" :disabled="testing" @click="onTest">
          <i class="fa-solid fa-plug"></i>{{ testing ? '测试中…' : '测试连接' }}
        </button>
        <button class="btn-p btn-sm" :disabled="saving" @click="onSave">
          <i class="fa-solid fa-check"></i>{{ saving ? '保存中…' : '保存配置' }}
        </button>
      </div>
    </div>

    <div class="setting-row bordered cloud-status-row">
      <div class="setting-meta">
        <div class="setting-name">状态：{{ statusText }}</div>
        <div class="setting-desc">{{ statusDetail }}</div>
      </div>
      <span class="status-dot" :class="statusClass"></span>
    </div>

    <div class="cloud-actions">
      <button class="btn-p btn-sm" :disabled="!canSync || store.loading" @click="onSync">
        <i class="fa-solid fa-cloud-arrow-up"></i>立即同步
      </button>
      <button class="btn-g btn-sm" :disabled="!canRemote || store.loading" @click="onRestore">
        <i class="fa-solid fa-cloud-arrow-down"></i>从云端恢复
      </button>
      <button class="btn-g btn-sm" :disabled="!canSync || store.loading" @click="onOverwrite">
        <i class="fa-solid fa-upload"></i>覆盖云端
      </button>
    </div>

    <div class="history-block">
      <div class="history-head">
        <div class="setting-meta">
          <div class="setting-name">版本历史</div>
          <div class="setting-desc">每次同步有变更自动记录，可选择旧版本恢复</div>
        </div>
        <button class="btn-g btn-sm" :disabled="!canRemote || store.historyLoading" @click="onLoadHistory">
          <i class="fa-solid fa-rotate"></i>{{ store.historyLoading ? '加载中…' : '刷新' }}
        </button>
      </div>

      <div v-if="!canRemote" class="history-empty">配置云端地址和 API Token 后可查看</div>
      <div v-else-if="store.historyLoading && store.versions.length === 0" class="history-empty">正在加载版本…</div>
      <div v-else-if="store.versions.length === 0" class="history-empty">暂无版本记录</div>
      <ul v-else class="history-list">
        <li v-for="version in store.versions" :key="version.revision" class="history-item">
          <div class="history-main">
            <div class="history-line">
              <span class="history-rev mono">#{{ version.revision }}</span>
              <span class="history-time">{{ formatHistoryTime(version.createdAt) }}</span>
              <span v-if="version.note" class="history-note">{{ version.note }}</span>
            </div>
            <div class="history-diff">
              新增 {{ version.changes.added }} · 更新 {{ version.changes.updated }} · 删除 {{ version.changes.deleted }}
            </div>
            <div class="history-counts">
              系统 {{ version.counts.systems }} · 服务器 {{ version.counts.servers }} · 中间件 {{ version.counts.middlewares }} · 配置 {{ version.counts.configProjects }}
            </div>
          </div>
          <button
            class="btn-g btn-sm"
            :disabled="store.loading || store.historyLoading"
            @click="onRestoreVersion(version)"
          >
            恢复
          </button>
        </li>
      </ul>
      <button
        v-if="store.hasMoreHistory"
        class="btn-g btn-sm history-more"
        :disabled="store.historyLoading"
        @click="onLoadMoreHistory"
      >
        {{ store.historyLoading ? '加载中…' : '加载更多' }}
      </button>
    </div>

    <p class="cloud-note">
      云端使用服务端密钥加密存储。主密码启用时，上传/恢复需要先解锁；恢复按更新时间安全合并，不删除本地记录。
      关闭持久化后本地改动不会上传，重新开启后的首次同步也不会把关闭期间的删除传播到云端。
      修改或关闭主密码后，需要重新输入云端 API Token。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useCloudSyncStore } from '@shared/stores/cloudSyncStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useSystemStore } from '@shared/stores/systemStore';
import { useServerStore } from '@shared/stores/serverStore';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useConfigStore } from '@shared/stores/configStore';
import { cryptoService } from '@shared/services/cryptoService';
import { normalizeEndpoint } from '@shared/sync/syncStorage';
import type { SyncVersionMeta } from '@protocol/types';

const store = useCloudSyncStore();
const toast = useToastStore();
const dialog = useDialogStore();
const systemStore = useSystemStore();
const serverStore = useServerStore();
const middlewareStore = useMiddlewareStore();
const configStore = useConfigStore();

const enabled = ref(false);
const endpoint = ref('');
const tokenInput = ref('');
const showToken = ref(false);
const saving = ref(false);
const testing = ref(false);

watch(
  () => store.config,
  (config) => {
    if (!config) return;
    enabled.value = config.enabled;
    endpoint.value = config.endpoint;
  },
  { immediate: true },
);

const canSync = computed(() =>
  !!store.config?.enabled && !!store.config?.endpoint && store.hasToken,
);

const canRemote = computed(() => !!store.config?.endpoint && store.hasToken);

onMounted(async () => {
  await store.load();
  if (canRemote.value && (!(await cryptoService.isEnabled()) || cryptoService.isUnlocked())) {
    try {
      await store.loadHistory();
    } catch {
      // 自动加载失败时保留手动刷新入口
    }
  }
});

const insecureHttp = computed(() => {
  if (!endpoint.value.trim()) return false;
  try {
    const url = new URL(normalizeEndpoint(endpoint.value));
    return url.protocol === 'http:'
      && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
});

const statusText = computed(() => ({
  disabled: '未启用',
  unknown: '未检测',
  healthy: '云端正常',
  unhealthy: '云端不可用',
  syncing: '同步中…',
  'waiting-unlock': '等待解锁',
  'waiting-cloud': '等待云端',
  'auth-error': 'Token 无效',
  error: '同步失败',
}[store.status.state] ?? '未知'));

const statusClass = computed(() => `is-${store.status.state}`);

const statusDetail = computed(() => {
  const parts: string[] = [];
  if (store.status.latencyMs !== undefined) parts.push(`延迟 ${store.status.latencyMs}ms`);
  if (store.status.lastSyncAt) parts.push(`最近同步 ${new Date(store.status.lastSyncAt).toLocaleString()}`);
  if (store.status.revision !== undefined) parts.push(`版本 #${store.status.revision}`);
  if (store.status.error) parts.push(store.status.error);
  return parts.length ? parts.join(' · ') : '尚未同步';
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function ensureUnlocked(): Promise<boolean> {
  if (!(await cryptoService.isEnabled()) || cryptoService.isUnlocked()) return true;
  const password = await dialog.prompt('解锁保险库', '输入主密码以访问云端凭据', '', 'password');
  if (!password) return false;
  const ok = await cryptoService.unlock(password);
  if (!ok) toast.error('主密码错误');
  return ok;
}

async function persistConfig(): Promise<boolean> {
  if (enabled.value || tokenInput.value.trim()) {
    if (!(await ensureUnlocked())) return false;
  }
  await store.save({
    enabled: enabled.value,
    endpoint: endpoint.value,
    token: tokenInput.value,
  });
  tokenInput.value = '';
  return true;
}

async function onSave() {
  saving.value = true;
  try {
    if (!(await persistConfig())) return;
    toast.success('云端配置已保存');
    if (enabled.value) {
      try {
        await store.syncNow();
      } catch (error) {
        toast.error(`配置已保存，但同步失败：${errorMessage(error)}`);
      }
    }
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function onToggleEnabled() {
  if (saving.value) return;
  const next = !enabled.value;
  if (next && !endpoint.value.trim()) {
    toast.error('请先填写云端地址');
    return;
  }
  if (next && !store.hasToken && !tokenInput.value.trim()) {
    toast.error('请先填写云端 API Token');
    return;
  }

  const previous = enabled.value;
  enabled.value = next;
  saving.value = true;
  try {
    if (!(await persistConfig())) {
      enabled.value = previous;
      return;
    }
    if (next) {
      try {
        const result = await store.syncNow();
        const rejected = result.response.stats.rejectedByTombstone;
        if (rejected > 0) {
          toast.error(`已开启；${rejected} 条记录被云端删除标记拦截，可点击“覆盖云端”修复`);
        } else {
          toast.success('云端持久化已开启');
        }
        await store.loadHistory().catch(() => {});
      } catch (error) {
        toast.error(`已开启，但首次同步失败：${errorMessage(error)}`);
      }
    } else {
      toast.info('云端持久化已关闭');
    }
  } catch (error) {
    enabled.value = previous;
    toast.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function onTest() {
  if (!endpoint.value.trim()) {
    toast.error('请填写云端地址');
    return;
  }
  if (!tokenInput.value.trim() && store.hasToken) {
    if (!(await ensureUnlocked())) return;
  }
  testing.value = true;
  try {
    const result = await store.testConnection(endpoint.value, tokenInput.value);
    toast.success(`连接正常，延迟 ${result.latencyMs}ms${result.revision !== undefined ? `，版本 #${result.revision}` : ''}`);
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    testing.value = false;
  }
}

async function onSync() {
  if (!(await ensureUnlocked())) return;
  try {
    const result = await store.syncNow();
    const { summary } = result;
    const rejected = result.response.stats.rejectedByTombstone;
    const hint = rejected > 0 ? `；${rejected} 条被云端删除标记拦截，可点击“覆盖云端”` : '';
    toast.success(`同步完成：新增 ${summary.added}，更新 ${summary.updated}，版本 #${result.response.revision}${hint}`);
    await store.loadHistory().catch(() => {});
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

async function onRestore() {
  const ok = await dialog.confirm(
    '从云端恢复',
    '将按更新时间合并云端数据，本地较新的记录保留，不删除本地数据。继续？',
  );
  if (!ok) return;
  if (!(await ensureUnlocked())) return;
  try {
    const result = await store.restore();
    const { summary } = result;
    toast.success(
      `恢复完成：新增 ${summary.added}，更新 ${summary.updated}，`
      + `跳过本地较新 ${summary.skippedLocalNewer}，云端已删除 ${summary.skippedCloudDeleted}`,
    );
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

async function onOverwrite() {
  const ok = await dialog.confirm(
    '覆盖云端',
    '将把本地全部数据以新时间戳上传，并删除云端独有的记录；不会删除本地数据。确定覆盖？',
  );
  if (!ok) return;
  if (!(await ensureUnlocked())) return;
  try {
    const result = await store.overwrite();
    const { summary } = result;
    toast.success(
      `云端已覆盖：新增 ${summary.added}，更新 ${summary.updated}，版本 #${result.response.revision}`,
    );
    await store.loadHistory().catch(() => {});
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

async function onLoadHistory() {
  if (!canRemote.value) return;
  if (!(await ensureUnlocked())) return;
  try {
    await store.loadHistory();
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

async function onLoadMoreHistory() {
  if (!(await ensureUnlocked())) return;
  try {
    await store.loadMoreHistory();
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

async function refreshLocalStores(): Promise<void> {
  await Promise.all([
    systemStore.load(),
    serverStore.load(),
    middlewareStore.load(),
    configStore.load(),
  ]).catch(() => {});
}

async function onRestoreVersion(version: SyncVersionMeta) {
  const enabledNow = !!store.config?.enabled;
  const ok = await dialog.confirm(
    `恢复到版本 #${version.revision}`,
    enabledNow
      ? '将用该版本替换本地数据，并立即覆盖云端；当前本地改动会丢失。继续？'
      : '将用该版本替换本地数据；持久化未开启，云端暂不修改。继续？',
  );
  if (!ok) return;
  if (!(await ensureUnlocked())) return;
  try {
    const result = await store.restoreVersion(version.revision);
    if (result.mirrorError) {
      toast.error(`已恢复到本地，但覆盖云端失败：${result.mirrorError}`);
    } else if (result.mirrored) {
      toast.success(`已恢复到版本 #${version.revision}，云端已同步为版本 #${result.mirrorRevision}`);
    } else {
      toast.success(`已恢复到版本 #${version.revision}；开启持久化后请点击“覆盖云端”同步`);
    }
    await refreshLocalStores();
    await store.loadHistory().catch(() => {});
  } catch (error) {
    toast.error(errorMessage(error));
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
.section-icon {
  color: var(--accent);
  font-size: var(--text-sm);
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
.cloud-form {
  margin-top: var(--gap-md);
  padding-top: var(--gap-md);
  max-width: 720px;
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
.pwd-input { width: 100%; }
.cloud-warn {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 2px;
  font-size: 11px;
  line-height: var(--leading-normal);
  color: var(--warning-text, #b45309);
}
.cloud-warn i { margin-top: 2px; font-size: 10px; }
.token-wrap { position: relative; }
.token-wrap .pwd-input { padding-right: 38px; }
.token-eye {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
}
.cloud-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: var(--gap-md);
}
.history-block {
  margin-top: var(--gap-lg);
  padding-top: var(--gap-lg);
  border-top: 1px solid var(--border);
}
.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-lg);
}
.history-empty {
  margin-top: var(--gap-sm);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
.history-list {
  list-style: none;
  margin: var(--gap-sm) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}
.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-md);
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel2);
}
.history-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.history-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}
.history-rev {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}
.history-time {
  color: var(--text-secondary);
  font-size: 11px;
}
.history-note {
  color: var(--text-primary);
  font-size: 11px;
}
.history-diff,
.history-counts {
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: var(--leading-normal);
}
.history-item .btn-sm { flex-shrink: 0; }
.history-more { margin-top: 8px; }
.btn-sm {
  padding: 4px 12px;
  font-size: var(--text-xs);
  gap: 4px;
}
.btn-sm i { font-size: 10px; }
.cloud-status-row { align-items: center; }
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-quaternary);
}
.status-dot.is-healthy { background: var(--ok, #10b981); box-shadow: 0 0 8px var(--ok, #10b981); }
.status-dot.is-syncing { background: var(--accent); }
.status-dot.is-waiting-unlock { background: var(--warning, #f59e0b); }
.status-dot.is-unhealthy,
.status-dot.is-auth-error,
.status-dot.is-error { background: var(--danger, #ef4444); }
.sw.disabled { opacity: .55; pointer-events: none; }
.cloud-note {
  margin: var(--gap-md) 0 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-normal);
}
</style>
