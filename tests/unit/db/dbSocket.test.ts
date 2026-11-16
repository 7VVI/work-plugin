import { describe, it, expect, vi } from 'vitest';
import { DbSocket } from '../../../src/shared/db/DbSocket';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sent: string[] = [];
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

  send(data: string): void {
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

  message(data: string): void {
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
    onMessage: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('DbSocket', () => {
  it('reports readiness with the server capabilities', () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new DbSocket('ws://dock.test/api/db/ws', callbacks, { WebSocketImpl: fakeFactory });
    const fake = FakeWebSocket.last();
    fake.open();

    fake.message(JSON.stringify({
      type: 'db-ready',
      protocol: 1,
      dialect: 'postgres',
      middlewareId: 'mw_1',
      sessionId: 'sess_1',
      caps: { maxRows: 500, maxResultBytes: 2097152, queryTimeoutMs: 30000, readOnly: false },
    }));

    expect(callbacks.onReady).toHaveBeenCalledWith(expect.objectContaining({
      dialect: 'postgres',
      middlewareId: 'mw_1',
      sessionId: 'sess_1',
    }));
    socket.close();
  });

  it('routes business frames to the message callback and ignores unknown types', () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new DbSocket('ws://dock.test/api/db/ws', callbacks, { WebSocketImpl: fakeFactory });
    socket.onDbMessage = callbacks.onMessage;
    const fake = FakeWebSocket.last();
    fake.open();

    fake.message(JSON.stringify({ type: 'db-list', id: 1, kind: 'tables', items: [], truncated: false }));
    expect(callbacks.onMessage).toHaveBeenCalledTimes(1);
    expect(callbacks.onMessage.mock.calls[0][0]).toMatchObject({ type: 'db-list', id: 1 });

    fake.message(JSON.stringify({ type: 'who-knows', id: 2 }));
    expect(callbacks.onMessage).toHaveBeenCalledTimes(1);
    socket.close();
  });

  it('reports session level errors', () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new DbSocket('ws://dock.test/api/db/ws', callbacks, { WebSocketImpl: fakeFactory });
    const fake = FakeWebSocket.last();
    fake.open();

    fake.message(JSON.stringify({ type: 'db-error', code: 'DB_SESSION_LIMIT', message: '会话数已达上限' }));
    expect(callbacks.onError).toHaveBeenCalledWith('DB_SESSION_LIMIT', '会话数已达上限');
    expect(callbacks.onMessage).not.toHaveBeenCalled();
    socket.close();
  });

  it('sends control frames as JSON and closes cleanly', () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new DbSocket('ws://dock.test/api/db/ws', callbacks, { WebSocketImpl: fakeFactory });
    const fake = FakeWebSocket.last();
    fake.open();

    socket.send({ type: 'db-query', id: 3, sql: 'SELECT 1' });
    expect(fake.sent.map(text => JSON.parse(text))).toEqual([
      { type: 'db-query', id: 3, sql: 'SELECT 1' },
    ]);

    socket.close();
    expect(callbacks.onClose).toHaveBeenCalledWith(expect.objectContaining({ intentional: true }));
  });

  it('answers ping frames without touching the business channel', () => {
    FakeWebSocket.instances = [];
    const callbacks = makeCallbacks();
    const socket = new DbSocket('ws://dock.test/api/db/ws', callbacks, { WebSocketImpl: fakeFactory });
    const fake = FakeWebSocket.last();
    fake.open();

    fake.message(JSON.stringify({ type: 'db-pong', t: 42 }));
    expect(callbacks.onMessage).not.toHaveBeenCalled();
    socket.close();
  });
});
