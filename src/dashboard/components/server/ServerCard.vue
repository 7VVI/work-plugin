<template>
  <div class="server-card" @click="$emit('select')">
    <div class="server-status" :class="server.status">{{ statusLabel }}</div>
    <div class="server-ip">{{ server.ip }}</div>
    <div class="server-desc">{{ server.name }}</div>
    <div class="server-meta">
      {{ server.username }} · SSH {{ server.sshPort }}<br />
      {{ server.environment }}
    </div>
    <div class="server-actions">
      <div class="row-action" @click.stop="$emit('edit')" title="编辑"><i class="fa-solid fa-pen"></i></div>
      <div class="row-action" @click.stop="$emit('copyIp')" title="复制IP"><i class="fa-solid fa-copy"></i></div>
      <div class="row-action" @click.stop="$emit('copySsh')" title="复制SSH"><i class="fa-solid fa-terminal"></i></div>
      <div class="row-action" @click.stop="$emit('copyPwd')" title="复制密码"><i class="fa-solid fa-key"></i></div>
      <div class="row-action" @click.stop="$emit('toggleFav')" title="收藏">
        <i :class="server.favorite ? 'fa-solid fa-star' : 'fa-regular fa-star'" :style="{ color: server.favorite ? '#f59e0b' : '#9ca3af' }"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Server } from '@shared/types/entities';

const props = defineProps<{ server: Server }>();
defineEmits<{ select: []; edit: []; copyIp: []; copySsh: []; copyPwd: []; toggleFav: [] }>();

const statusLabel = computed(() => ({ online: '在线', warn: '告警', offline: '离线' }[props.server.status ?? 'online']));
</script>

<style scoped>
.server-card { border: 1px solid var(--border-soft); border-radius: 6px; padding: 10px; cursor: pointer; background: white; transition: all 0.15s; }
.server-card:hover { border-color: #93c5fd; box-shadow: 0 2px 8px rgba(59,130,246,0.08); }
.server-status { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--success-text); font-weight: 500; margin-bottom: 4px; }
.server-status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
.server-status.warn { color: var(--warning-text); }
.server-status.warn::before { background: var(--warning); }
.server-status.offline { color: var(--text-tertiary); }
.server-status.offline::before { background: var(--text-tertiary); }
.server-ip { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.server-desc { font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; }
.server-meta { font-size: 11px; color: #4b5563; line-height: 1.6; margin-bottom: 8px; }
.server-actions { display: flex; align-items: center; gap: 2px; border-top: 1px solid var(--border-soft); padding-top: 6px; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
</style>
