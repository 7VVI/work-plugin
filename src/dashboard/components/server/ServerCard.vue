<template>
  <div class="panel stat-card group p-4" @click="$emit('select')">
    <!-- 状态点 + 操作 -->
    <div class="flex items-center justify-between">
      <span class="inline-flex items-center gap-1.5 text-[11px] font-medium" :style="statusColor">
        <span class="relative flex h-1.5 w-1.5">
          <span v-if="online" class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" :style="{ background: statusColor.background }"></span>
          <span class="relative inline-flex h-1.5 w-1.5 rounded-full" :style="dotStyle"></span>
        </span>
        {{ statusLabel }}
      </span>
      <div class="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button class="ibtn !h-6 !w-6" title="终端" @click.stop="onCopySsh">
          <i class="fa-solid fa-terminal text-[11px]"></i>
        </button>
        <button class="ibtn danger !h-6 !w-6" title="删除" @click.stop="$emit('delete')">
          <i class="fa-regular fa-trash-can text-[11px]"></i>
        </button>
      </div>
    </div>

    <!-- 图标 + 名称 -->
    <div class="mt-3 flex items-center gap-3">
      <span class="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-base text-white" style="background:#F59E0B;box-shadow:0 5px 14px -4px #F59E0B">
        <i class="fa-solid fa-server"></i>
      </span>
      <div class="min-w-0">
        <div class="truncate text-[14px] font-semibold t1">{{ server.name }}</div>
        <div class="mono truncate text-xs t3">{{ server.ip }}:{{ server.sshPort || 22 }}</div>
      </div>
    </div>

    <!-- 环境徽章 -->
    <div class="mt-2.5 flex items-center gap-1.5">
      <EnvBadge :env="server.environment" />
      <span v-if="server.purpose" class="chip">{{ server.purpose }}</span>
    </div>

    <!-- 详情列表 -->
    <dl class="mt-3 space-y-1.5 pt-3 text-xs" style="border-top:1px solid var(--border)">
      <div class="flex justify-between">
        <dt class="t3">
          <i class="fa-regular fa-user mr-1.5 w-3 text-center"></i>账号
        </dt>
        <dd class="mono t2">{{ server.username || '—' }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="t3">
          <i class="fa-solid fa-plug mr-1.5 w-3 text-center"></i>SSH 端口
        </dt>
        <dd class="mono t2">{{ server.sshPort || 22 }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="t3">
          <i class="fa-regular fa-clock mr-1.5 w-3 text-center"></i>最后更新
        </dt>
        <dd class="t2">{{ formatRelativeTime(server.updatedAt) }}</dd>
      </div>
    </dl>

    <!-- 操作按钮 -->
    <div class="mt-3 flex gap-2">
      <button class="btn-g flex-1 justify-center !py-1.5 !text-xs" @click.stop="onCopyIp">
        <i class="fa-regular fa-copy text-[10px]"></i>复制 IP
      </button>
      <button class="btn-g flex-1 justify-center !py-1.5 !text-xs" @click.stop="onCopySsh">
        <i class="fa-solid fa-terminal text-[10px]"></i>复制 SSH
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Server } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import { copyToClipboard } from '@shared/utils/clipboard';
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

const statusColor = computed(() => ({
  background: online.value ? 'var(--ok)' : 'var(--ink3)',
}));

const dotStyle = computed(() => ({
  background: online.value ? 'var(--ok)' : 'var(--ink3)',
  boxShadow: online.value ? '0 0 8px var(--ok)' : 'transparent',
}));

function buildSshCommand() {
  const user = props.server.username || 'root';
  const port = props.server.sshPort || 22;
  return `ssh ${user}@${props.server.ip} -p ${port}`;
}

async function onCopyIp() {
  try {
    await copyToClipboard(props.server.ip);
    toast.success('IP 已复制');
  } catch {
    toast.error('复制失败');
  }
}

async function onCopySsh() {
  try {
    await copyToClipboard(buildSshCommand());
    toast.success('SSH 命令已复制');
  } catch {
    toast.error('复制失败');
  }
}
</script>

<style scoped>
/* 使用 components.css 中的 panel stat-card 基类 */
</style>
