import { describe, it, expect, vi } from 'vitest';
import { SshSocket } from '../../../src/shared/ssh/SshSocket';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  binaryType = 'blob';
  sent: Array<string | Uint8Array> = [];
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  static last(): FakeWebSocket {
    const instance = FakeWebSocket.instances.at(-1);
    if (!instance) throw new Error('no fake websocket');
    return instance;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }

  send(data: string | Uint8Array): void {
    this.sent.push(data);
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close', { code, reason });
  }

  open(): void {
    this.readyState = 1;
    this.emit('open', {});
  }

  message(data: string | ArrayBuffer): void {
    this.emit('message', { data });
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
}

function fakeFactory(url: string): WebSocket {
  return new FakeWebSocket(url) as unknown as WebSocket;
}

function makeCallbacks() {
  return {
    onReady: vi.fn(),
    onOutput: vi.fn(),
    onExit: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('SshSocket', () => {
  it('routes text control messages and binary terminal data', () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new SshSocket('ws://dock.test/api/ssh/ws', callbacks, { WebSocketImpl: fakeFactory });
    const fake = FakeWebSocket.last();
    expect(fake.binaryType).toBe('arraybuffer');

    socket.resize(120, 40);
    fake.open();
    expect(fake.sent.some(message => typeof message === 'string' && message.includes('"resize"'))).toBe(true);
    socket.resize(100, 30);
    expect(fake.sent.filter(message => typeof message === 'string' && message.includes('"resize"')).length).toBe(2);

    fake.message(JSON.stringify({
      type: 'ready',
      protocol: 1,
      serverId: 'srv_1',
      sessionId: 'sess_1',
      fingerprint: 'SHA256:abc',
    }));
    expect(callbacks.onReady).toHaveBeenCalledWith(expect.objectContaining({
      serverId: 'srv_1',
      sessionId: 'sess_1',
      fingerprint: 'SHA256:abc',
    }));

    const input = new Uint8Array([0x6c, 0x73]);
    socket.sendInput(input);
    expect([...(fake.sent.at(-1) as Uint8Array)]).toEqual([...input]);

    fake.message(new Uint8Array([0x68, 0x69]).buffer);
    expect(callbacks.onOutput).toHaveBeenCalledWith(new Uint8Array([0x68, 0x69]));

    fake.message(JSON.stringify({ type: 'exit', code: 0, signal: null }));
    expect(callbacks.onExit).toHaveBeenCalledWith(0, null);

    fake.message(JSON.stringify({ type: 'error', code: 'SSH_AUTH_FAILED', message: '认证失败' }));
    expect(callbacks.onError).toHaveBeenCalledWith('SSH_AUTH_FAILED', '认证失败');

    fake.close(1000);
    expect(callbacks.onClose).toHaveBeenCalledWith({ code: 1000, reason: '', intentional: false });
    socket.close();
  });

  it('queues input and resize until the socket opens', () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new SshSocket('ws://dock.test', callbacks, { WebSocketImpl: fakeFactory });
    const fake = FakeWebSocket.last();
    socket.sendInput(new Uint8Array([1, 2, 3]));
    expect(fake.sent).toHaveLength(0);
    fake.open();
    expect(fake.sent).toEqual([new Uint8Array([1, 2, 3])]);
    socket.close();
  });

  it('marks an intentional close and stops pings', () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new SshSocket('ws://dock.test', callbacks, { WebSocketImpl: fakeFactory });
    const fake = FakeWebSocket.last();
    fake.open();
    socket.close();
    expect(callbacks.onClose).toHaveBeenCalledWith(expect.objectContaining({ intentional: true }));
    expect(fake.readyState).toBe(3);
  });

  it('closes the socket when pongs stop arriving', async () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new SshSocket('ws://dock.test', callbacks, {
      WebSocketImpl: fakeFactory,
      pingIntervalMs: 20,
      pongTimeoutMs: 60,
    });
    const fake = FakeWebSocket.last();
    fake.open();
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(fake.readyState).toBe(3);
    expect(callbacks.onClose).toHaveBeenCalled();
    socket.close();
  });

  it('fails when the websocket never opens', async () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    new SshSocket('ws://dock.test', callbacks, {
      WebSocketImpl: fakeFactory,
      connectTimeoutMs: 20,
      readyTimeoutMs: 200,
    });
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(callbacks.onError).toHaveBeenCalledWith(
      'SSH_UNREACHABLE',
      expect.stringContaining('WebSocket'),
    );
    expect(callbacks.onClose).toHaveBeenCalled();
  });

  it('fails when the server never sends ready', async () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    new SshSocket('ws://dock.test', callbacks, {
      WebSocketImpl: fakeFactory,
      connectTimeoutMs: 200,
      readyTimeoutMs: 20,
    });
    FakeWebSocket.last().open();
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(callbacks.onError).toHaveBeenCalledWith(
      'SSH_TIMEOUT',
      expect.stringContaining('SSH 会话'),
    );
    expect(callbacks.onClose).toHaveBeenCalled();
  });
});
