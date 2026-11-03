import type { WebSocket } from 'ws';

export interface WsMessage {
  data: Buffer;
  isBinary: boolean;
}

export function collector(socket: WebSocket) {
  const messages: WsMessage[] = [];
  const waiters: Array<(message: WsMessage) => void> = [];
  socket.on('message', (data: Buffer, isBinary: boolean) => {
    const message = { data, isBinary };
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else messages.push(message);
  });
  return {
    next(timeoutMs = 1500): Promise<WsMessage> {
      const queued = messages.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out waiting for websocket message')), timeoutMs);
        waiters.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
    /** 等待满足条件的下一条消息（跳过不匹配的帧并缓存） */
    async nextMatching(
      timeoutMs: number,
      predicate: (message: WsMessage) => boolean,
    ): Promise<WsMessage> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('timed out waiting for websocket message');
        const message = await this.next(remaining);
        if (predicate(message)) return message;
      }
    },
    text(message: WsMessage): string {
      return message.data.toString('utf8');
    },
  };
}

export async function waitTick(ms = 30): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}
