import { describe, it, expect } from 'vitest';
import type { DbClientMessage, DbServerMessage } from '@protocol/db';
import { DbClient } from '../../../src/shared/db/DbClient';
import type { DbSocket } from '../../../src/shared/db/DbSocket';

class FakeSocket {
  sent: DbClientMessage[] = [];
  onDbMessage: ((message: DbServerMessage) => void) | null = null;

  send(message: DbClientMessage): void {
    this.sent.push(message);
  }

  emit(message: DbServerMessage): void {
    this.onDbMessage?.(message);
  }
}

function createClient(): { client: DbClient; socket: FakeSocket } {
  const socket = new FakeSocket();
  const client = new DbClient(socket as unknown as DbSocket);
  return { client, socket };
}

function lastId(socket: FakeSocket): number {
  return socket.sent[socket.sent.length - 1]!.id;
}

describe('DbClient', () => {
  it('resolves object lists', async () => {
    const { client, socket } = createClient();
    const promise = client.listObjects('tables', 'public');
    const id = lastId(socket);
    expect(socket.sent[0]).toMatchObject({ type: 'db-list', id, kind: 'tables', schema: 'public' });

    socket.emit({
      type: 'db-list',
      id,
      kind: 'tables',
      items: [{ schema: 'public', name: 'users' }],
      truncated: false,
    });
    await expect(promise).resolves.toEqual([{ schema: 'public', name: 'users' }]);
  });

  it('aggregates query results from meta, chunk and end frames', async () => {
    const { client, socket } = createClient();
    const promise = client.query('SELECT * FROM users');
    const id = lastId(socket);

    socket.emit({
      type: 'db-result-meta',
      id,
      columns: [{ name: 'id', ordinal: 1 }],
      totalRows: 2,
      affectedRows: 0,
      elapsedMs: 7,
    });
    socket.emit({ type: 'db-result-chunk', id, seq: 0, rows: [[1]] });
    socket.emit({ type: 'db-result-chunk', id, seq: 1, rows: [[2]] });
    socket.emit({ type: 'db-result-end', id, rowCount: 2, truncated: false });

    await expect(promise).resolves.toEqual({
      columns: [{ name: 'id', ordinal: 1 }],
      rows: [[1], [2]],
      rowCount: 2,
      affectedRows: 0,
      truncated: false,
      elapsedMs: 7,
    });
  });

  it('rejects with the server error code', async () => {
    const { client, socket } = createClient();
    const promise = client.query('SELECT 1');
    const id = lastId(socket);
    socket.emit({ type: 'db-fail', id, code: 'DB_SYNTAX_ERROR', message: '语法错误' });
    await expect(promise).rejects.toMatchObject({ code: 'DB_SYNTAX_ERROR', message: '语法错误' });
  });

  it('keeps concurrent requests apart', async () => {
    const { client, socket } = createClient();
    const first = client.query('SELECT 1');
    const firstId = lastId(socket);
    const second = client.query('SELECT 2');
    const secondId = lastId(socket);
    expect(firstId).not.toBe(secondId);

    socket.emit({
      type: 'db-result-meta', id: secondId, columns: [], totalRows: 0, elapsedMs: 1,
    });
    socket.emit({ type: 'db-result-end', id: secondId, rowCount: 0, truncated: false });
    socket.emit({
      type: 'db-result-meta', id: firstId, columns: [], totalRows: 0, elapsedMs: 2,
    });
    socket.emit({ type: 'db-result-end', id: firstId, rowCount: 0, truncated: false });

    await expect(second).resolves.toMatchObject({ elapsedMs: 1 });
    await expect(first).resolves.toMatchObject({ elapsedMs: 2 });
  });

  it('rejects pending requests after dispose', async () => {
    const { client, socket } = createClient();
    const promise = client.query('SELECT 1');
    void lastId(socket);
    client.dispose();
    await expect(promise).rejects.toMatchObject({ code: 'DB_CANCELED' });
  });
});
