import type {
  DbCaps,
  DbClientMessage,
  DbDialect,
  DbErrorCode,
  DbServerMessage,
} from '@protocol/db';

export type DbWebSocketFactory = (url: string) => WebSocket;

export interface DbSocketCallbacks {
  onReady: (info: {
    dialect: DbDialect;
    middlewareId: string;
    sessionId: string;
    serverVersion?: string;
    caps: DbCaps;
  }) => void;
  onError: (code: DbErrorCode, message: string) => void;
  onClose: (info: { code: number; reason: string; intentional: boolean }) => void;
}

export interface DbSocketOptions {
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
  connectTimeoutMs?: number;
  readyTimeoutMs?: number;
  WebSocketImpl?: DbWebSocketFactory;
}

const OPEN = 1;

/**
 * 数据库工作台 WebSocket 封装：只走文本帧（JSON 控制消息）。
 * 定时 ping，长时间没有 pong 视为断线；重连由上层用新票据重新创建。
 */
export class DbSocket {
  /** 数据库业务帧回调（由 DbClient 注册） */
  onDbMessage: ((message: DbServerMessage) => void) | null = null;

  private readonly socket: WebSocket;
  private readonly callbacks: DbSocketCallbacks;
  private readonly pingIntervalMs: number;
  private readonly pongTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly readyTimeoutMs: number;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPongAt = Date.now();
  private intentional = false;
  private closed = false;
  private failed = false;
  private readonly onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.lastPongAt = Date.now();
    }
  };

  constructor(url: string, callbacks: DbSocketCallbacks, options: DbSocketOptions = {}) {
    this.callbacks = callbacks;
    this.pingIntervalMs = options.pingIntervalMs ?? 20_000;
    this.pongTimeoutMs = options.pongTimeoutMs ?? 45_000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 12_000;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 25_000;
    const factory = options.WebSocketImpl ?? ((target: string) => new WebSocket(target));
    this.socket = factory(url);
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
      this.failConnect('DB_UNREACHABLE', '无法建立 WebSocket 连接，请检查云端地址和反向代理 Upgrade 配置');
    }, this.connectTimeoutMs);
  }

  /** 发送数据库操作请求 */
  send(message: DbClientMessage): void {
    if (this.socket.readyState !== OPEN) return;
    try {
      this.socket.send(JSON.stringify(message));
    } catch { /* closed */ }
  }

  close(): void {
    if (this.closed) return;
    this.intentional = true;
    this.clearTimers();
    if (this.socket.readyState === OPEN) {
      this.send({ type: 'db-close' });
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
      this.failConnect('DB_TIMEOUT', '云端服务端未在 25 秒内返回数据库会话');
    }, this.readyTimeoutMs);
  }

  private ping(): void {
    if (this.closed) return;
    // 后台标签页的定时器会被节流，不能据此判定连接已死
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.lastPongAt = Date.now();
      this.send({ type: 'db-ping', t: Date.now() });
      return;
    }
    if (Date.now() - this.lastPongAt > this.pongTimeoutMs) {
      this.clearTimers();
      try { this.socket.close(4000, 'pong timeout'); } catch { /* closed */ }
      return;
    }
    this.send({ type: 'db-ping', t: Date.now() });
  }

  private onMessage(event: MessageEvent): void {
    if (this.closed || this.failed) return;
    const data = event.data;
    if (typeof data !== 'string') return;
    this.handleControl(data);
  }

  private handleControl(text: string): void {
    let message: DbServerMessage;
    try { message = JSON.parse(text) as DbServerMessage; } catch { return; }
    if (typeof message.type !== 'string' || !message.type.startsWith('db-')) return;
    switch (message.type) {
      case 'db-ready':
        this.clearTimer('ready');
        this.lastPongAt = Date.now();
        this.callbacks.onReady(message);
        return;
      case 'db-pong':
        this.lastPongAt = Date.now();
        return;
      case 'db-error':
        this.failed = true;
        this.clearTimers();
        this.callbacks.onError(message.code, message.message);
        return;
      default:
        this.onDbMessage?.(message);
    }
  }

  private failConnect(code: DbErrorCode, message: string): void {
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
