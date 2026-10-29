<template>
  <Teleport to="body">
    <div class="terminal-overlay" role="dialog" aria-modal="true" :aria-label="`${server.name} SSH 终端`">
      <div class="terminal-panel">
        <header class="terminal-head">
          <div class="terminal-id">
            <span class="terminal-status" :class="`is-${status}`"></span>
            <div class="terminal-titles">
              <strong class="terminal-name">{{ server.name }}</strong>
              <span class="terminal-target mono">{{ server.username || '—' }}@{{ server.ip }}:{{ server.sshPort || 22 }}</span>
            </div>
          </div>
          <div class="terminal-meta">
            <span v-if="fingerprint" class="terminal-fingerprint mono" :title="fingerprint">{{ shortFingerprint }}</span>
            <span class="terminal-state">{{ statusText }}</span>
          </div>
          <div class="terminal-actions">
            <button type="button" class="terminal-btn" title="复制选中" @click="copySelection">
              <i class="fa-regular fa-copy"></i>
            </button>
            <button type="button" class="terminal-btn" title="清屏" @click="clearScreen">
              <i class="fa-solid fa-eraser"></i>
            </button>
            <button type="button" class="terminal-btn" title="重新连接" :disabled="busy" @click="reconnect">
              <i class="fa-solid fa-rotate-right"></i>
            </button>
            <button type="button" class="terminal-btn danger" title="关闭" @click="requestClose">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <div
          ref="terminalHost"
          class="terminal-host"
          @contextmenu.prevent="openMenu"
          @mousedown="captureSelection"
        ></div>

        <div v-if="status === 'connecting' || busy" class="terminal-mask">
          <div class="terminal-progress" aria-hidden="true"></div>
          <i class="fa-solid fa-spinner fa-spin"></i>
          <span>{{ busy ? '正在同步服务器信息…' : `正在连接 ${server.ip}…${connectSeconds >= 3 ? ` (${connectSeconds}s)` : ''}` }}</span>
        </div>

        <div v-if="errorText && status === 'error'" class="terminal-mask terminal-error">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>{{ errorText }}</p>
          <div class="terminal-error-actions">
            <button v-if="errorKind === 'sync'" type="button" class="btn-p btn-sm" :disabled="busy" @click="syncAndRetry">
              同步并重试
            </button>
            <button v-if="errorKind === 'settings' || errorKind === 'login'" type="button" class="btn-p btn-sm" @click="openSettings">
              打开设置
            </button>
            <button type="button" class="btn-g btn-sm" :disabled="busy" @click="reconnect">重试</button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="menuVisible"
      class="terminal-menu-backdrop"
      @mousedown="closeMenu"
      @contextmenu.prevent="closeMenu"
    ></div>
    <div
      v-if="menuVisible"
      class="terminal-menu"
      :style="{ left: `${menuX}px`, top: `${menuY}px` }"
      @mousedown.stop
    >
      <button
        type="button"
        class="terminal-menu-item"
        :disabled="!menuHasSelection"
        @click="copyMenuItem"
      >
        <i class="fa-regular fa-copy"></i>复制
      </button>
      <button type="button" class="terminal-menu-item" @click="pasteMenuItem">
        <i class="fa-regular fa-paste"></i>粘贴
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { Server } from '@shared/types/entities';
import type { SshErrorCode } from '@protocol/ssh';
import { SshSocket } from '@shared/ssh/SshSocket';
import { describeSshError, requestSshWsUrl, syncBeforeSsh, type SshErrorKind } from '@shared/ssh/ticket';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useToastStore } from '@shared/stores/toastStore';
import '@xterm/xterm/css/xterm.css';

const props = defineProps<{ server: Server }>();
const emit = defineEmits<{ close: [] }>();

type Status = 'connecting' | 'connected' | 'closed' | 'error';

const router = useRouter();
const dialog = useDialogStore();
const toast = useToastStore();

const terminalHost = ref<HTMLElement | null>(null);
const status = ref<Status>('connecting');
const errorText = ref('');
const errorKind = ref<SshErrorKind>('unknown');
const fingerprint = ref('');
const busy = ref(false);
const connectSeconds = ref(0);
const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const menuHasSelection = ref(false);

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let socket: SshSocket | null = null;
let observer: ResizeObserver | null = null;
let resizeTimer = 0;
let retryTimer = 0;
let connectClock = 0;
let retries = 0;
let disposed = false;
let fatal = false;
let contextSelection = '';

const statusText = computed(() => ({
  connecting: '连接中',
  connected: '已连接',
  closed: '已断开',
  error: '连接失败',
}[status.value]));

const shortFingerprint = computed(() => {
  const value = fingerprint.value.replace(/^SHA256:/, '');
  return value.length > 18 ? `${value.slice(0, 18)}…` : value;
});

const TERMINAL_THEME = {
  background: '#0f1113',
  foreground: '#e8eaed',
  cursor: '#5b8def',
  cursorAccent: '#0f1113',
  selectionBackground: 'rgba(91, 141, 239, 0.35)',
  black: '#0f1113',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e8eaed',
  brightBlack: '#6b7280',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f8fafc',
};

function fit(): void {
  if (!fitAddon) return;
  try {
    fitAddon.fit();
  } catch {
    // 容器尚不可见时忽略
  }
}

function initTerminal(): void {
  if (!terminalHost.value || term) return;
  term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: '"JetBrains Mono", Menlo, Consolas, monospace',
    scrollback: 5000,
    theme: TERMINAL_THEME,
  });
  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalHost.value);
  fit();
  term.onData(data => socket?.sendInput(new TextEncoder().encode(data)));
  term.onResize(({ cols, rows }) => socket?.resize(cols, rows));
  observer = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      fit();
      if (term && socket) socket.resize(term.cols, term.rows);
    }, 80);
  });
  observer.observe(terminalHost.value);
}

function closeSocket(): void {
  socket?.close();
  socket = null;
}

function startConnectClock(): void {
  stopConnectClock();
  connectSeconds.value = 0;
  connectClock = window.setInterval(() => {
    connectSeconds.value += 1;
  }, 1000);
}

function stopConnectClock(): void {
  if (connectClock) {
    window.clearInterval(connectClock);
    connectClock = 0;
  }
}

function errorForSsh(code: SshErrorCode, message: string): { kind: SshErrorKind; message: string } {
  if (code === 'SSH_AUTH_FAILED' || code === 'SSH_KEY_INVALID' || code === 'SSH_NO_CREDENTIALS'
    || code === 'SSH_INVALID_TARGET') {
    return { kind: 'unknown', message };
  }
  if (code === 'SSH_SESSION_LIMIT') return { kind: 'unknown', message };
  if (code === 'SSH_DISABLED') return { kind: 'disabled', message };
  return { kind: 'unknown', message };
}

function connect(): void {
  closeSocket();
  window.clearTimeout(retryTimer);
  fatal = false;
  errorText.value = '';
  fingerprint.value = '';
  status.value = 'connecting';
  startConnectClock();

  void (async () => {
    try {
      const url = await requestSshWsUrl(props.server.id);
      if (disposed) return;
      socket = new SshSocket(url, {
        onReady: info => {
          if (disposed) return;
          stopConnectClock();
          status.value = 'connected';
          fingerprint.value = info.fingerprint;
          errorText.value = '';
          retries = 0;
          fit();
          if (term) {
            term.focus();
            socket?.resize(term.cols, term.rows);
          }
        },
        onOutput: data => {
          if (!disposed) term?.write(data);
        },
        onExit: (code, signal) => {
          if (disposed) return;
          stopConnectClock();
          status.value = 'closed';
          const suffix = code != null ? ` (${code})` : signal ? ` ${signal}` : '';
          term?.write(`\r\n\x1b[90m[连接已结束${suffix}]\x1b[0m\r\n`);
        },
        onError: (code, message) => {
          if (disposed) return;
          stopConnectClock();
          fatal = true;
          const info = errorForSsh(code, message);
          errorKind.value = info.kind;
          errorText.value = info.message || message;
          status.value = 'error';
        },
        onClose: ({ code, reason, intentional }) => {
          stopConnectClock();
          if (disposed || intentional || fatal) return;
          if (status.value === 'closed') return;
          status.value = 'error';
          errorKind.value = 'unknown';
          errorText.value = reason || `连接已断开（${code}）`;
          if (retries < 2) {
            retries += 1;
            retryTimer = window.setTimeout(() => {
              if (!disposed) connect();
            }, retries * 1000);
          }
        },
      });
    } catch (error) {
      if (disposed) return;
      stopConnectClock();
      const info = describeSshError(error);
      errorKind.value = info.kind;
      errorText.value = info.message;
      status.value = 'error';
    }
  })();
}

function reconnect(): void {
  retries = 0;
  fatal = false;
  connect();
}

async function requestClose(): Promise<void> {
  if (status.value === 'connected' || status.value === 'connecting') {
    const ok = await dialog.confirm('断开终端', '确定要断开当前 SSH 连接吗？');
    if (!ok) return;
  }
  emit('close');
}

async function syncAndRetry(): Promise<void> {
  busy.value = true;
  try {
    await syncBeforeSsh();
    busy.value = false;
    reconnect();
  } catch (error) {
    busy.value = false;
    const info = describeSshError(error);
    errorKind.value = info.kind;
    errorText.value = info.message;
    status.value = 'error';
  }
}

function openSettings(): void {
  emit('close');
  void router.push('/settings');
}

async function copySelection(): Promise<void> {
  const selection = term?.getSelection() ?? '';
  if (!selection) {
    toast.info('请先选择要复制的终端内容');
    return;
  }
  try {
    await navigator.clipboard.writeText(selection);
    toast.success('已复制选中内容');
  } catch {
    toast.error('复制失败');
  }
}

function captureSelection(event: MouseEvent): void {
  if (event.button !== 2) return;
  contextSelection = term?.hasSelection() ? term.getSelection() : '';
}

function openMenu(event: MouseEvent): void {
  const selection = term?.hasSelection() ? term.getSelection() : contextSelection;
  contextSelection = selection;
  menuHasSelection.value = selection.length > 0;
  const width = 140;
  const height = 88;
  menuX.value = Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8));
  menuY.value = Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8));
  menuVisible.value = true;
}

function closeMenu(): void {
  menuVisible.value = false;
}

async function copyMenuItem(): Promise<void> {
  const selection = contextSelection || term?.getSelection() || '';
  closeMenu();
  if (!selection) {
    toast.info('请先选择要复制的终端内容');
    term?.focus();
    return;
  }
  try {
    await navigator.clipboard.writeText(selection);
    toast.success('已复制');
  } catch {
    toast.error('复制失败');
  }
  term?.focus();
}

async function pasteMenuItem(): Promise<void> {
  closeMenu();
  if (!term) return;
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      toast.info('剪贴板为空');
      term.focus();
      return;
    }
    term.paste(text);
    term.focus();
  } catch {
    toast.error('无法读取剪贴板，请使用 Ctrl+V 粘贴');
    term.focus();
  }
}

function clearScreen(): void {
  term?.clear();
  term?.focus();
}

function cleanup(): void {
  disposed = true;
  window.clearTimeout(retryTimer);
  window.clearTimeout(resizeTimer);
  stopConnectClock();
  closeMenu();
  closeSocket();
  observer?.disconnect();
  observer = null;
  term?.dispose();
  term = null;
  fitAddon = null;
}

onMounted(async () => {
  await nextTick();
  initTerminal();
  requestAnimationFrame(() => fit());
  connect();
});

onBeforeUnmount(cleanup);
</script>

<style scoped>
.terminal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  padding: 24px;
  background: rgba(8, 10, 13, 0.78);
  backdrop-filter: blur(6px);
}
.terminal-panel {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #262b33;
  border-radius: var(--radius-xl);
  background: #0f1113;
  box-shadow: var(--shadow-xl);
}
.terminal-head {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 50px;
  padding: 0 14px;
  border-bottom: 1px solid #22272e;
  background: #12151a;
  color: #e8eaed;
  flex-shrink: 0;
}
.terminal-id { display: flex; align-items: center; gap: 10px; min-width: 0; }
.terminal-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: #6b7280;
}
.terminal-status.is-connected { background: #4ade80; box-shadow: 0 0 8px rgba(74, 222, 128, 0.6); }
.terminal-status.is-connecting { background: #facc15; }
.terminal-status.is-error { background: #f87171; }
.terminal-titles { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.terminal-name { font-size: 13px; font-weight: 600; white-space: nowrap; }
.terminal-target { font-size: 11px; color: #8b94a3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.terminal-meta { display: flex; align-items: center; gap: 10px; margin-left: auto; color: #8b94a3; font-size: 11px; }
.terminal-fingerprint { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.terminal-state { white-space: nowrap; }
.terminal-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.terminal-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ba3ae;
  font-size: 12px;
  cursor: pointer;
}
.terminal-btn:hover { background: #1f242c; color: #e8eaed; }
.terminal-btn.danger:hover { color: #f87171; }
.terminal-btn:disabled { opacity: 0.4; cursor: default; }
.terminal-host {
  flex: 1;
  min-height: 0;
  padding: 8px 10px;
  overflow: hidden;
  background: #0f1113;
}
.terminal-host :deep(.xterm) { height: 100%; }
.terminal-host :deep(.xterm-viewport) { background: transparent !important; }
.terminal-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
.terminal-menu {
  position: fixed;
  z-index: 10000;
  min-width: 132px;
  padding: 4px;
  border: 1px solid #2a3038;
  border-radius: 8px;
  background: #171b21;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
.terminal-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #dfe4ea;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.terminal-menu-item:hover:not(:disabled) { background: #232a33; }
.terminal-menu-item:disabled { opacity: 0.4; cursor: default; }
.terminal-menu-item i { width: 14px; font-size: 11px; text-align: center; color: #8b94a3; }
.terminal-mask {
  position: absolute;
  inset: 50px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(15, 17, 19, 0.72);
  color: #c3c9d4;
  font-size: 13px;
  backdrop-filter: blur(2px);
}
.terminal-mask > i { color: #5b8def; font-size: 18px; }
.terminal-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  overflow: hidden;
  background: #1a1f26;
}
.terminal-progress::after {
  content: '';
  display: block;
  width: 35%;
  height: 100%;
  background: linear-gradient(90deg, transparent, #5b8def, transparent);
  animation: terminal-progress 1.4s ease-in-out infinite;
}
@keyframes terminal-progress {
  from { transform: translateX(-100%); }
  to { transform: translateX(400%); }
}
.terminal-error p { max-width: 520px; margin: 0; padding: 0 24px; text-align: center; line-height: 1.7; }
.terminal-error > i { color: #f87171; }
.terminal-error-actions { display: flex; gap: 8px; margin-top: 4px; }

@media (max-width: 720px) {
  .terminal-overlay { padding: 0; }
  .terminal-panel { border-radius: 0; border: none; }
  .terminal-meta { display: none; }
}
</style>
