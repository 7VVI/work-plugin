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
        <i :class="copiedFlag === 'ssh' ? 'fa-solid fa-check' : 'fa-solid fa-terminal'"></i>
        <span>{{ copiedFlag === 'ssh' ? '已复制' : 'SSH' }}</span>
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
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px;
  transition: var(--transition);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.server-card:hover {
  border-color: var(--text-tertiary);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.card-top { display: flex; align-items: center; justify-content: space-between; }
.status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 500; color: var(--text-secondary);
}
.status::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%;
  background: var(--success);
}
.status-warn::before { background: var(--warning); }
.status-offline::before { background: var(--text-tertiary); }

.card-top-right { display: flex; align-items: center; gap: 4px; }
.menu-btn {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-xs); cursor: pointer;
  transition: var(--transition); font-size: 11px;
  background: transparent; border: none; color: var(--text-tertiary);
}
.menu-btn:hover { background: var(--border-soft); color: var(--text-primary); }

.card-identity { display: flex; align-items: center; gap: 10px; }
.server-icon {
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; flex-shrink: 0;
}
.icon-teal .server-icon { background: linear-gradient(135deg, #6B7B7A 0%, #3D4847 100%); }
.icon-purple .server-icon { background: linear-gradient(135deg, #7A7A8C 0%, #4A4A5C 100%); }
.icon-orange .server-icon { background: linear-gradient(135deg, #8C7A5C 0%, #5C4A30 100%); }
.icon-blue .server-icon { background: linear-gradient(135deg, #5C6B8C 0%, #364060 100%); }
.icon-gray .server-icon { background: linear-gradient(135deg, #B0B0B0 0%, #6B6B6B 100%); }
.icon-amber .server-icon { background: linear-gradient(135deg, #8C7A5C 0%, #5C4A30 100%); }
.icon-red .server-icon { background: linear-gradient(135deg, #8C5C5C 0%, #5C3030 100%); }
.icon-indigo .server-icon { background: linear-gradient(135deg, #5C5C8C 0%, #303060 100%); }

.identity-text { min-width: 0; flex: 1; }
.server-name {
  font-size: 13.5px; font-weight: 600; color: var(--text-primary);
  line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.server-ip {
  font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
}

.tag-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tag {
  display: inline-block; padding: 2px 8px; border-radius: 4px;
  font-size: 11px; font-weight: 500; line-height: 1.5;
}
.tag-dev { background: var(--env-dev-bg); color: var(--env-dev-fg); }
.tag-test { background: var(--env-test-bg); color: var(--env-test-fg); }
.tag-prod { background: var(--env-prod-bg); color: var(--env-prod-fg); }
.tag-default { background: var(--border-soft); color: var(--text-secondary); }

.info-list {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 0;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
}
.info-row { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; }
.info-left { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
.info-left i { font-size: 11px; color: var(--text-tertiary); width: 12px; text-align: center; }
.info-right {
  color: var(--text-primary); font-weight: 500;
  font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 11.5px;
}

.card-actions { display: flex; align-items: center; gap: 8px; }
.card-btn {
  flex: 1; height: 30px;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  background: var(--surface-secondary); color: var(--text-primary);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 11.5px; font-weight: 500; cursor: pointer;
  transition: var(--transition); font-family: inherit;
}
.card-btn:hover { border-color: var(--text-primary); background: var(--card-bg); }
.card-btn.copied { background: var(--success-light); border-color: var(--success); color: var(--success); }
.card-btn i { font-size: 11px; }
</style>

