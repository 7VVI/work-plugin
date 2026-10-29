import type { SshClientMessage, SshErrorCode, SshServerMessage } from '@protocol/ssh';

export type SshWebSocketFactory = (url: string) => WebSocket;

export interface SshSocketCallbacks {
  onReady: (info: { serverId: string; sessionId: string; fingerprint: string }) => void;
  onOutput: (data: Uint8Array) => void;
  onExit: (code: number | null, signal: string | null) => void;
  onError: (code: SshErrorCode, message: string) => void;
  onClose: (info: { code: number; reason: string; intentional: boolean }) => void;
}

export interface SshSocketOptions {
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
  connectTimeoutMs?: number;
  readyTimeoutMs?: number;
  WebSocketImpl?: SshWebSocketFactory;
}

const OPEN = 1;
const MAX_PENDING_INPUT = 64 * 1024;
const INPUT_CHUNK = 64 * 1024;

/**
 * 终端 WebSocket 封装：二进制帧走终端数据，文本帧走控制消息；
 * 定时 ping，长时间没有 pong 视为断线。重连由上层用新票据重新创建。
 */
export class SshSocket {
  private readonly socket: WebSocket;
  private readonly callbacks: SshSocketCallbacks;
  private readonly pingIntervalMs: number;
  private readonly pongTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly readyTimeoutMs: number;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPongAt = Date.now();
  private pendingInput: Uint8Array[] = [];
  private pendingBytes = 0;
  private pendingSize: { cols: number; rows: number } | null = null;
  private intentional = false;
  private closed = false;
  private failed = false;
  private readonly onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.lastPongAt = Date.now();
    }
  };

  constructor(url: string, callbacks: SshSocketCallbacks, options: SshSocketOptions = {}) {
    this.callbacks = callbacks;
    this.pingIntervalMs = options.pingIntervalMs ?? 20_000;
    this.pongTimeoutMs = options.pongTimeoutMs ?? 45_000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 12_000;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 25_000;
    const factory = options.WebSocketImpl ?? ((target: string) => new WebSocket(target));
    this.socket = factory(url);
    this.socket.binaryType = 'arraybuffer';
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.socket.addEventListener('open', () => this.onOpen());
    this.socket.addEventListener('message', event => this.onMessage(event));
    this.socket.addEventListener('close', event => this.onClose(event));
    this.socket.addEventListener('error', () => {
      // 浏览器不提供错误详情，close 事件随后会触发
    });
    this.connectTimer = setTimeout(() => {
      this.failConnect('SSH_UNREACHABLE', '无法建立 WebSocket 连接，请检查云端地址和反向代理 Upgrade 配置');
    }, this.connectTimeoutMs);
  }

  sendInput(data: Uint8Array): void {
    if (this.socket.readyState === OPEN) {
      this.sendChunks(data);
      return;
    }
    if (this.pendingBytes + data.length > MAX_PENDING_INPUT) return;
    this.pendingInput.push(data);
    this.pendingBytes += data.length;
  }

  resize(cols: number, rows: number): void {
    this.pendingSize = { cols, rows };
    if (this.socket.readyState === OPEN) this.sendControl({ type: 'resize', cols, rows });
  }

  close(): void {
    if (this.closed) return;
    this.intentional = true;
    this.clearTimers();
    if (this.socket.readyState === OPEN) {
      this.sendControl({ type: 'close' });
      try { this.socket.close(1000); } catch { /* closed */ }
    } else {
      try { this.socket.close(); } catch { /* closed */ }
    }
  }

  private onOpen(): void {
    if (this.closed || this.failed) return;
    this.lastPongAt = Date.now();
    this.clearTimer('connect');
    this.pingTimer = setInterval(() => this.ping(), this.pingIntervalMs);
    this.readyTimer = setTimeout(() => {
      this.failConnect('SSH_TIMEOUT', '云端服务端未在 25 秒内返回 SSH 会话，可能无法访问目标服务器');
    }, this.readyTimeoutMs);
    if (this.pendingSize) {
      this.sendControl({ type: 'resize', ...this.pendingSize });
      this.pendingSize = null;
    }
    for (const chunk of this.pendingInput) this.sendChunks(chunk);
    this.pendingInput = [];
    this.pendingBytes = 0;
  }

  private sendChunks(data: Uint8Array): void {
    for (let offset = 0; offset < data.length; offset += INPUT_CHUNK) {
      this.socket.send(data.subarray(offset, offset + INPUT_CHUNK));
    }
  }

  private ping(): void {
    if (this.closed) return;
    // 后台标签页的定时器会被节流，不能据此判定连接已死
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.lastPongAt = Date.now();
      this.sendControl({ type: 'ping', t: Date.now() });
      return;
    }
    if (Date.now() - this.lastPongAt > this.pongTimeoutMs) {
      this.clearTimers();
      try { this.socket.close(4000, 'pong timeout'); } catch { /* closed */ }
      return;
    }
    this.sendControl({ type: 'ping', t: Date.now() });
  }

  private onMessage(event: MessageEvent): void {
    if (this.closed || this.failed) return;
    const data = event.data;
    if (typeof data === 'string') {
      this.handleControl(data);
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.callbacks.onOutput(new Uint8Array(data));
      return;
    }
    if (data instanceof Uint8Array) {
      this.callbacks.onOutput(data);
      return;
    }
    if (data instanceof Blob) {
      void data.arrayBuffer().then(buffer => this.callbacks.onOutput(new Uint8Array(buffer)));
    }
  }

  private handleControl(text: string): void {
    let message: SshServerMessage;
    try { message = JSON.parse(text) as SshServerMessage; } catch { return; }
    switch (message.type) {
      case 'ready':
        this.clearTimer('ready');
        this.lastPongAt = Date.now();
        this.callbacks.onReady(message);
        break;
      case 'pong':
        this.lastPongAt = Date.now();
        break;
      case 'exit':
        this.clearTimer('ready');
        this.callbacks.onExit(message.code, message.signal);
        break;
      case 'error':
        this.failed = true;
        this.clearTimers();
        this.callbacks.onError(message.code, message.message);
        break;
      default:
        break;
    }
  }

  private failConnect(code: SshErrorCode, message: string): void {
    if (this.closed || this.failed) return;
    this.failed = true;
    this.clearTimers();
    this.callbacks.onError(code, message);
    try { this.socket.close(); } catch { /* closed */ }
  }

  private onClose(event: CloseEvent): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
    this.callbacks.onClose({
      code: event.code,
      reason: event.reason,
      intentional: this.intentional,
    });
  }

  private sendControl(message: SshClientMessage): void {
    if (this.socket.readyState !== OPEN) return;
    try { this.socket.send(JSON.stringify(message)); } catch { /* closed */ }
  }

  private clearTimer(kind: 'connect' | 'ready'): void {
    const timer = kind === 'connect' ? this.connectTimer : this.readyTimer;
    if (!timer) return;
    clearTimeout(timer);
    if (kind === 'connect') this.connectTimer = null;
    else this.readyTimer = null;
  }

  private clearTimers(): void {
    this.clearTimer('connect');
    this.clearTimer('ready');
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }
}
