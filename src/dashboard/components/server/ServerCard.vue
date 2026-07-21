<template>
  <div class="server-card" :class="[`status-${statusKey}`, `icon-${iconColorKey}`]" @click="$emit('select')">
    <div class="card-top">
      <span class="status">
        <span class="status-text">{{ statusLabel }}</span>
      </span>
      <div class="card-top-right">
        <button class="menu-btn" @click.stop="$emit('edit')" title="编辑">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="menu-btn" @click.stop="$emit('copyPwd')" title="复制密码">
          <i class="fa-solid fa-key"></i>
        </button>
      </div>
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
      <span class="tag" :class="`tag-${envKey}`">{{ envLabel }}</span>
      <span v-if="server.purpose" class="tag tag-default">{{ server.purpose }}</span>
    </div>

    <div class="info-list">
      <div class="info-row">
        <div class="info-left">
          <i class="fa-solid fa-user"></i>
          <span>账号</span>
        </div>
        <div class="info-right">{{ server.username || '—' }}</div>
      </div>
      <div class="info-row">
        <div class="info-left">
          <i class="fa-solid fa-plug"></i>
          <span>SSH 端口</span>
        </div>
        <div class="info-right">{{ server.sshPort }}</div>
      </div>
      <div class="info-row">
        <div class="info-left">
          <i class="fa-regular fa-clock"></i>
          <span>最后更新</span>
        </div>
        <div class="info-right" style="font-family: inherit;">{{ formatRelativeTime(server.updatedAt) }}</div>
      </div>
    </div>

    <div class="card-actions">
      <button class="card-btn" :class="{ copied: copiedFlag === 'ip' }" @click.stop="onCopyIp">
        <i :class="copiedFlag === 'ip' ? 'fa-solid fa-check' : 'fa-solid fa-copy'"></i>
        <span>{{ copiedFlag === 'ip' ? '已复制' : '复制IP' }}</span>
      </button>
      <button class="card-btn" :class="{ copied: copiedFlag === 'ssh' }" @click.stop="onCopySsh">
        <i :class="copiedFlag === 'ssh' ? 'fa-solid fa-check' : 'fa-solid fa-copy'"></i>
        <span>{{ copiedFlag === 'ssh' ? '已复制' : '复制服务器' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Server } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';

const props = defineProps<{ server: Server }>();
const emit = defineEmits<{ select: []; edit: []; copyIp: []; copySsh: []; copyPwd: [] }>();

const copiedFlag = ref<'' | 'ip' | 'ssh'>('');

const statusKey = computed(() => props.server.status ?? 'online');
const statusLabel = computed(() => ({
  online: '在线',
  warn: '告警',
  offline: '离线',
}[statusKey.value as string] ?? '在线'));

const envKey = computed(() => ({
  production: 'prod',
  development: 'dev',
  test: 'test',
  staging: 'test',
}[props.server.environment as string] ?? 'default'));

const envLabel = computed(() => ({
  production: '生产',
  development: '开发',
  test: '测试',
  staging: '预发布',
}[props.server.environment as string] ?? props.server.environment));

const iconColorKey = computed(() => {
  const colors = ['teal', 'purple', 'orange', 'blue', 'amber', 'red', 'indigo', 'gray'];
  let hash = 0;
  const name = props.server.name || '';
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
});

const iconClass = computed(() => {
  const purpose = (props.server.purpose || '').toLowerCase();
  if (purpose.includes('redis')) return 'fa-solid fa-bolt';
  if (purpose.includes('mysql') || purpose.includes('数据库') || purpose.includes('database')) return 'fa-solid fa-database';
  if (purpose.includes('git') || purpose.includes('gitlab')) return 'fa-brands fa-gitlab';
  if (purpose.includes('backup') || purpose.includes('备份')) return 'fa-solid fa-archive';
  if (purpose.includes('cache') || purpose.includes('缓存')) return 'fa-solid fa-bolt';
  return 'fa-solid fa-server';
});

async function onCopyIp() {
  emit('copyIp');
  copiedFlag.value = 'ip';
  setTimeout(() => { copiedFlag.value = ''; }, 1200);
}

async function onCopySsh() {
  emit('copySsh');
  copiedFlag.value = 'ssh';
  setTimeout(() => { copiedFlag.value = ''; }, 1200);
}
</script>

<style scoped>
.server-card {
  background: var(--card-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  padding: var(--gap-xl);
  transition: var(--transition);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}
.server-card:hover {
  border-color: var(--primary);
  box-shadow: 0 6px 24px rgba(79, 124, 255, 0.12);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
}
.status::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--success);
}
.status-warn::before { background: var(--warning); }
.status-offline::before { background: var(--text-quaternary); }

.card-top-right {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
}
.menu-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: 11px;
  background: transparent;
  border: none;
  color: var(--text-quaternary);
}
.menu-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
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
  box-shadow: var(--shadow-xs);
}
.icon-teal .server-icon { background: linear-gradient(135deg, #34D399 0%, #10B981 100%); }
.icon-purple .server-icon { background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%); }
.icon-orange .server-icon { background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%); }
.icon-blue .server-icon { background: linear-gradient(135deg, #4F7CFF 0%, #3D6DF7 100%); }
.icon-gray .server-icon { background: linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%); }
.icon-amber .server-icon { background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%); }
.icon-red .server-icon { background: linear-gradient(135deg, #F87171 0%, #EF4444 100%); }
.icon-indigo .server-icon { background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%); }

.identity-text { min-width: 0; flex: 1; }
.server-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.server-ip {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: 4px;
  font-family: var(--font-mono);
}

.tag-row {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  flex-wrap: wrap;
}
.tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1;
  white-space: nowrap;
}
.tag-dev { background: var(--env-dev-bg); color: var(--env-dev-fg); }
.tag-test { background: var(--env-test-bg); color: var(--env-test-fg); }
.tag-prod { background: var(--env-prod-bg); color: var(--env-prod-fg); }
.tag-default { background: var(--surface-secondary); color: var(--text-secondary); }

.info-list {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  padding: var(--gap-md) 0;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
}
.info-left {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  color: var(--text-tertiary);
}
.info-left i {
  font-size: 11px;
  color: var(--text-quaternary);
  width: 14px;
  text-align: center;
}
.info-right {
  color: var(--text-primary);
  font-weight: var(--font-medium);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}
.card-btn {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--surface-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: var(--transition-fast);
  font-family: inherit;
}
.card-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-50);
}
.card-btn.copied {
  background: var(--success-light);
  border-color: var(--success);
  color: var(--success-text);
}
.card-btn i { font-size: 11px; }
</style>

