<template>
  <div class="panel stat-card server-card" @click="$emit('select')">
    <!-- 环境 + 操作 -->
    <div class="card-top">
      <EnvBadge :env="server.environment" />
      <div class="card-actions">
        <button class="ibtn ibtn-sm" title="复制 SSH 连接信息" @click.stop="onCopySsh">
          <i class="fa-regular fa-copy"></i>
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

    <!-- 用途 -->
    <div v-if="server.purpose" class="card-env">
      <span class="chip">{{ server.purpose }}</span>
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
      <button class="btn-p card-btn card-btn-primary" @click.stop="$emit('connect')">
        <i class="fa-solid fa-terminal"></i>连接
      </button>
      <button class="btn-g card-btn" @click.stop="onCopyIp">
        <i class="fa-regular fa-copy"></i>复制 IP
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Server } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import { copyToClipboard } from '@shared/utils/clipboard';
import { serverService } from '@shared/services/serverService';
import { useToastStore } from '@shared/stores/toastStore';
import EnvBadge from '../common/EnvBadge.vue';

const props = defineProps<{ server: Server }>();
defineEmits<{ select: []; delete: []; connect: [] }>();

const toast = useToastStore();

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
  min-height: 220px;
}

/* 顶部状态 + hover 操作 */
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  flex-wrap: wrap;
  gap: 8px;
}
.card-btn {
  flex: 1;
  justify-content: center;
  padding: 6px 10px;
  font-size: var(--text-xs);
  white-space: nowrap;
}
.card-btn-primary {
  flex: 1.2;
  background: #4e5d75;
  box-shadow: 0 2px 8px rgba(15, 23, 38, 0.14);
}
.card-btn-primary:hover {
  background: #3a475c;
  filter: none;
  box-shadow: 0 4px 14px rgba(15, 23, 38, 0.18);
}
.card-btn i { font-size: 10px; }
</style>
