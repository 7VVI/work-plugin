<template>
  <div class="panel stat-card server-card" @click="$emit('select')">
    <!-- 状态点 + 操作 -->
    <div class="card-top">
      <span class="status" :style="{ color: online ? 'var(--ok)' : 'var(--ink3)' }">
        <span class="dot-ping">
          <span v-if="online" class="ping" :style="{ background: 'var(--ok)' }"></span>
          <span class="dot" :style="dotStyle"></span>
        </span>
        {{ statusLabel }}
      </span>
      <div class="card-actions">
        <button class="ibtn ibtn-sm" title="终端" @click.stop="onCopySsh">
          <i class="fa-solid fa-terminal"></i>
        </button>
        <button class="ibtn ibtn-sm danger" title="删除" @click.stop="$emit('delete')">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    </div>

    <!-- 图标 + 名称 -->
    <div class="card-id">
      <span class="card-icon"><i class="fa-solid fa-server"></i></span>
      <div class="card-id-text">
        <div class="card-name t1">{{ server.name }}</div>
        <div class="card-ip t3">{{ server.ip }}:{{ server.sshPort || 22 }}</div>
      </div>
    </div>

    <!-- 环境徽章 -->
    <div class="card-env">
      <EnvBadge :env="server.environment" />
      <span v-if="server.purpose" class="chip">{{ server.purpose }}</span>
    </div>

    <!-- 详情列表 -->
    <dl class="card-dl">
      <div class="dl-row">
        <dt class="t3"><i class="fa-regular fa-user"></i>账号</dt>
        <dd class="mono t2">{{ server.username || '—' }}</dd>
      </div>
      <div class="dl-row">
        <dt class="t3"><i class="fa-solid fa-plug"></i>SSH 端口</dt>
        <dd class="mono t2">{{ server.sshPort || 22 }}</dd>
      </div>
      <div class="dl-row">
        <dt class="t3"><i class="fa-regular fa-clock"></i>最后更新</dt>
        <dd class="t2">{{ formatRelativeTime(server.updatedAt) }}</dd>
      </div>
    </dl>

    <!-- 操作按钮 -->
    <div class="card-btns">
      <button class="btn-g card-btn" @click.stop="onCopyIp">
        <i class="fa-regular fa-copy"></i>复制 IP
      </button>
      <button class="btn-g card-btn" @click.stop="onCopySsh">
        <i class="fa-solid fa-terminal"></i>复制 SSH
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Server } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import { copyToClipboard } from '@shared/utils/clipboard';
import { serverService } from '@shared/services/serverService';
import { useToastStore } from '@shared/stores/toastStore';
import EnvBadge from '../common/EnvBadge.vue';

const props = defineProps<{ server: Server }>();
defineEmits<{ select: []; delete: [] }>();

const toast = useToastStore();

const statusKey = computed(() => props.server.status ?? 'online');
const online = computed(() => statusKey.value !== 'offline');
const statusLabel = computed(() => ({
  online: '在线',
  warn: '告警',
  offline: '离线',
}[statusKey.value as string] ?? '在线'));

const dotStyle = computed(() => ({
  background: online.value ? 'var(--ok)' : 'var(--ink3)',
  boxShadow: online.value ? '0 0 8px var(--ok)' : 'transparent',
}));

async function onCopyIp() {
  try {
    await copyToClipboard(props.server.ip);
    toast.success('IP 已复制');
  } catch {
    toast.error('复制失败');
  }
}

async function onCopySsh() {
  // 复制为「名称 / 地址 / 端口 / 用户 / 明文密码」多行格式
  try {
    await serverService.copySshCommand(props.server.id);
    toast.success('连接信息已复制');
  } catch {
    toast.error('复制失败');
  }
}
</script>

<style scoped>
/* 卡片基类：panel + stat-card 提供外观，这里补齐 v3 p-4 内部布局 */
.server-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

/* 顶部状态 + hover 操作 */
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: var(--font-medium);
}
.dot-ping {
  position: relative;
  display: inline-flex;
  width: 6px;
  height: 6px;
}
.dot-ping .ping {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: 0.6;
  animation: svrPing 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.dot-ping .dot {
  position: relative;
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
@keyframes svrPing {
  0% { transform: scale(1); opacity: 0.6; }
  75%, 100% { transform: scale(2.4); opacity: 0; }
}
.card-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.server-card:hover .card-actions { opacity: 1; }
.ibtn-sm { width: 24px; height: 24px; }
.ibtn-sm i { font-size: 11px; }

/* 图标 + 名称 */
.card-id {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-icon {
  width: 40px;
  height: 40px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #fff;
  font-size: var(--text-base);
  background: #F59E0B;
  box-shadow: 0 5px 14px -4px #F59E0B;
}
.card-id-text { min-width: 0; }
.card-name {
  font-size: 14px;
  font-weight: var(--font-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-ip {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 环境 */
.card-env {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 详情列表 */
.card-dl {
  margin-top: 12px;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--text-xs);
  border-top: 1px solid var(--border);
}
.dl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dl-row dt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dl-row dt i {
  width: 12px;
  text-align: center;
  margin-right: 0;
}

/* 操作按钮 */
.card-btns {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
.card-btn {
  flex: 1;
  justify-content: center;
  padding: 6px 14px;
  font-size: var(--text-xs);
}
.card-btn i { font-size: 10px; }
</style>
