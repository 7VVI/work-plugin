<template>
  <div class="server-card stat-card" @click="$emit('select')">
    <div class="card-head">
      <span class="status-dot" :class="online ? 'on' : 'off'" :title="statusLabel">
        <span class="ping"></span>
      </span>
      <button class="row-action edit" @click.stop="$emit('edit')" title="编辑">
        <i class="fa-solid fa-pen"></i>
      </button>
    </div>

    <div class="card-identity">
      <div class="server-icon">
        <i :class="iconClass"></i>
      </div>
      <div class="identity-text">
        <div class="server-name">{{ server.name }}</div>
        <div class="server-ip">{{ server.ip }}{{ server.sshPort ? `:${server.sshPort}` : '' }}</div>
      </div>
    </div>

    <div class="tag-row">
      <EnvBadge :env="server.environment" size="sm" />
      <span v-if="server.purpose" class="chip">{{ server.purpose }}</span>
    </div>

    <dl class="detail">
      <div class="detail-row">
        <dt><i class="fa-solid fa-user"></i><span>账号</span></dt>
        <dd>{{ server.username || '—' }}</dd>
      </div>
      <div class="detail-row">
        <dt><i class="fa-solid fa-plug"></i><span>SSH 端口</span></dt>
        <dd>{{ server.sshPort || '—' }}</dd>
      </div>
      <div class="detail-row">
        <dt><i class="fa-regular fa-clock"></i><span>最后更新</span></dt>
        <dd>{{ formatRelativeTime(server.updatedAt) }}</dd>
      </div>
    </dl>

    <div class="card-actions">
      <button
        class="btn btn-default copy-btn"
        :class="{ copied: copiedFlag === 'ip' }"
        @click.stop="onCopyIp"
      >
        <i :class="copiedFlag === 'ip' ? 'fa-solid fa-check' : 'fa-solid fa-copy'"></i>
        <span>{{ copiedFlag === 'ip' ? '已复制' : '复制 IP' }}</span>
      </button>
      <button
        class="btn btn-default copy-btn"
        :class="{ copied: copiedFlag === 'ssh' }"
        @click.stop="onCopySsh"
      >
        <i :class="copiedFlag === 'ssh' ? 'fa-solid fa-check' : 'fa-solid fa-copy'"></i>
        <span>{{ copiedFlag === 'ssh' ? '已复制' : '复制 SSH' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Server } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import { copyToClipboard } from '@shared/utils/clipboard';
import { useToastStore } from '@shared/stores/toastStore';
import EnvBadge from '../common/EnvBadge.vue';

const props = defineProps<{ server: Server }>();
defineEmits<{ select: []; edit: [] }>();

const toast = useToastStore();
const copiedFlag = ref<'' | 'ip' | 'ssh'>('');

const statusKey = computed(() => props.server.status ?? 'online');
const online = computed(() => statusKey.value !== 'offline');
const statusLabel = computed(() => ({
  online: '在线',
  warn: '告警',
  offline: '离线',
}[statusKey.value as string] ?? '在线'));

const iconClass = computed(() => {
  const purpose = (props.server.purpose || '').toLowerCase();
  if (purpose.includes('redis')) return 'fa-solid fa-bolt';
  if (purpose.includes('mysql') || purpose.includes('数据库') || purpose.includes('database')) return 'fa-solid fa-database';
  if (purpose.includes('git') || purpose.includes('gitlab')) return 'fa-brands fa-gitlab';
  if (purpose.includes('backup') || purpose.includes('备份')) return 'fa-solid fa-archive';
  if (purpose.includes('cache') || purpose.includes('缓存')) return 'fa-solid fa-bolt';
  return 'fa-solid fa-server';
});

function buildSshCommand() {
  const user = props.server.username || 'root';
  const port = props.server.sshPort || 22;
  return `ssh ${user}@${props.server.ip} -p ${port}`;
}

async function onCopyIp() {
  try {
    await copyToClipboard(props.server.ip);
    toast.success('IP 已复制');
    copiedFlag.value = 'ip';
    setTimeout(() => { if (copiedFlag.value === 'ip') copiedFlag.value = ''; }, 1200);
  } catch {
    toast.error('复制失败');
  }
}

async function onCopySsh() {
  try {
    await copyToClipboard(buildSshCommand());
    toast.success('SSH 命令已复制');
    copiedFlag.value = 'ssh';
    setTimeout(() => { if (copiedFlag.value === 'ssh') copiedFlag.value = ''; }, 1200);
  } catch {
    toast.error('复制失败');
  }
}
</script>

<style scoped>
.server-card {
  padding: var(--gap-lg);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
  cursor: pointer;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 22px;
}

/* v3 在线呼吸点 —— 必须与 .ping 同处一个 scoped 块（Vue 会重命名 @keyframes） */
.status-dot { position: relative; width: 6px; height: 6px; border-radius: 50%; }
.status-dot.on { background: var(--ok); box-shadow: 0 0 8px var(--ok); }
.status-dot.on .ping {
  position: absolute; inset: 0; border-radius: 50%;
  background: var(--ok);
  animation: ping 1.6s cubic-bezier(0, 0, .2, 1) infinite;
  opacity: .6;
}
.status-dot.off { background: var(--ink3); }
@keyframes ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }

.card-head .row-action {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: 11px;
}
.card-head .row-action:hover {
  background: var(--panel2);
  color: var(--accent);
}

.card-identity {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
}
.server-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--text-base);
  flex-shrink: 0;
  background: #F59E0B;
  box-shadow: 0 5px 14px -4px #F59E0B;
}
.identity-text { min-width: 0; flex: 1; }
.server-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--ink);
  line-height: var(--leading-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.server-ip {
  font-size: var(--text-xs);
  color: var(--ink3);
  margin-top: 4px;
  font-family: var(--font-mono);
}

.tag-row {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  flex-wrap: wrap;
}

.detail {
  margin: 0;
  padding: var(--gap-md) 0;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}
.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
}
.detail-row dt {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  color: var(--ink3);
  font-weight: normal;
}
.detail-row dt i {
  font-size: 11px;
  color: var(--ink3);
  width: 14px;
  text-align: center;
}
.detail-row dd {
  margin: 0;
  color: var(--ink);
  font-weight: var(--font-medium);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}
.copy-btn {
  flex: 1;
  height: 34px;
  padding: 0 var(--gap-sm);
  font-size: var(--text-sm);
}
.copy-btn.copied {
  border-color: var(--ok);
  color: var(--ok);
  background: var(--panel2);
}
</style>
