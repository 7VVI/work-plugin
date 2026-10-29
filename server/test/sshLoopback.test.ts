import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { createServer, type Socket } from 'node:net';
import { RealSshConnector, SshConnectError } from '../src/ssh/connector';
import type { SshChannel } from '../src/ssh/connector';

const require = createRequire(import.meta.url);
const ssh2 = require('ssh2') as {
  Server: new (options: unknown, listener: (client: any) => void) => {
    on: (event: string, listener: (error: Error) => void) => void;
    listen: (port: number, host: string, callback: () => void) => void;
    address: () => { port: number };
    close: (callback?: () => void) => void;
  };
  utils: {
    generateKeyPairSync: (type: string) => { private: string; public: string };
  };
};

const USERNAME = 'dock-test';
const PASSWORD = 'dock-secret';

function startServer() {
  const hostKey = ssh2.utils.generateKeyPairSync('ed25519');
  const clientKey = ssh2.utils.generateKeyPairSync('ed25519');
  const server = new ssh2.Server({ hostKeys: [hostKey.private] }, (client: any) => {
    client.on('authentication', (ctx: any) => {
      if (ctx.username !== USERNAME) return ctx.reject();
      if (ctx.method === 'password' && ctx.password === PASSWORD) return ctx.accept();
      if (ctx.method === 'publickey') return ctx.accept();
      return ctx.reject();
    });
    client.on('ready', () => {
      client.on('session', (acceptSession: any) => {
        const session = acceptSession();
        session.on('pty', (acceptPty: any) => acceptPty?.());
        session.on('window-change', (acceptWindow: any) => acceptWindow?.());
        session.on('shell', (acceptShell: any) => {
          const stream = acceptShell();
          stream.write('welcome\r\n');
          stream.on('data', (data: Buffer) => stream.write(data));
          stream.on('close', () => client.end());
        });
      });
    });
  });

  return new Promise<{ port: number; clientKey: string; close: () => Promise<void> }>((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        port,
        clientKey: clientKey.private,
        close: () => new Promise<void>(done => server.close(() => done())),
      });
    });
  });
}

function collectOutput() {
  const chunks: string[] = [];
  const waiters: Array<{ text: string; resolve: (value: string) => void }> = [];
  const notify = (): void => {
    const joined = chunks.join('');
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index]!;
      if (joined.includes(waiter.text)) {
        waiters.splice(index, 1);
        waiter.resolve(joined);
      }
    }
  };
  return {
    chunks,
    push(chunk: string): void {
      chunks.push(chunk);
      notify();
    },
    waitFor(text: string): Promise<string> {
      const joined = chunks.join('');
      if (joined.includes(text)) return Promise.resolve(joined);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${text}`)), 5000);
        waiters.push({
          text,
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
        });
      });
    },
  };
}

describe('RealSshConnector loopback', () => {
  let closeServer: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (closeServer) await closeServer();
    closeServer = null;
  });

  it('connects with a password, reports the fingerprint and echoes input', async () => {
    const info = await startServer();
    closeServer = info.close;
    const connector = new RealSshConnector();
    const output = collectOutput();
    const fingerprints: string[] = [];
    const channel: SshChannel = await connector.connect({
      serverId: 'srv_test',
      host: '127.0.0.1',
      port: info.port,
      username: USERNAME,
      password: PASSWORD,
    }, {
      cols: 100,
      rows: 30,
      onFingerprint: fingerprint => fingerprints.push(fingerprint),
      onData: chunk => output.push(chunk.toString('utf8')),
      onExit: () => undefined,
    });
    try {
      expect(fingerprints[0]).toMatch(/^SHA256:/);
      await output.waitFor('welcome');
      channel.write(new TextEncoder().encode('echo dock\n'));
      const text = await output.waitFor('echo dock');
      expect(text).toContain('welcome');
      channel.resize(120, 40);
    } finally {
      channel.close();
    }
  });

  it('connects with an unencrypted private key', async () => {
    const info = await startServer();
    closeServer = info.close;
    const connector = new RealSshConnector();
    const output = collectOutput();
    const channel = await connector.connect({
      serverId: 'srv_test',
      host: '127.0.0.1',
      port: info.port,
      username: USERNAME,
      privateKey: info.clientKey,
    }, {
      cols: 80,
      rows: 24,
      onFingerprint: () => undefined,
      onData: chunk => output.push(chunk.toString('utf8')),
      onExit: () => undefined,
    });
    try {
      await output.waitFor('welcome');
    } finally {
      channel.close();
    }
  });

  it('maps a bad password to SSH_AUTH_FAILED', async () => {
    const info = await startServer();
    closeServer = info.close;
    const connector = new RealSshConnector();
    await expect(connector.connect({
      serverId: 'srv_test',
      host: '127.0.0.1',
      port: info.port,
      username: USERNAME,
      password: 'wrong-password',
    }, {
      cols: 80,
      rows: 24,
      onFingerprint: () => undefined,
      onData: () => undefined,
      onExit: () => undefined,
    })).rejects.toMatchObject({ code: 'SSH_AUTH_FAILED' });
  });

  it('rejects missing credentials and invalid targets before connecting', async () => {
    const connector = new RealSshConnector();
    const options = {
      cols: 80,
      rows: 24,
      onFingerprint: () => undefined,
      onData: () => undefined,
      onExit: () => undefined,
    };
    await expect(connector.connect({
      serverId: 'srv_test', host: '127.0.0.1', port: 22, username: 'root',
    }, options)).rejects.toMatchObject({ code: 'SSH_NO_CREDENTIALS' });
    await expect(connector.connect({
      serverId: 'srv_test', host: '', port: 22, username: 'root', password: 'x',
    }, options)).rejects.toMatchObject({ code: 'SSH_INVALID_TARGET' });
    await expect(connector.connect({
      serverId: 'srv_test', host: '127.0.0.1', port: 0, username: 'root', password: 'x',
    }, options)).rejects.toMatchObject({ code: 'SSH_INVALID_TARGET' });
  });

  it('times out when the target accepts TCP but never starts the SSH handshake', async () => {
    const sockets = new Set<Socket>();
    const silent = createServer(socket => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      silent.once('error', reject);
      silent.listen(0, '127.0.0.1', () => resolve());
    });
    const port = (silent.address() as { port: number }).port;
    try {
      await expect(new RealSshConnector(80).connect({
        serverId: 'srv_silent',
        host: '127.0.0.1',
        port,
        username: 'root',
        password: 'x',
      }, {
        cols: 80,
        rows: 24,
        onFingerprint: () => undefined,
        onData: () => undefined,
        onExit: () => undefined,
      })).rejects.toMatchObject({ code: 'SSH_TIMEOUT' });
    } finally {
      for (const socket of sockets) socket.destroy();
      silent.close();
    }
  });

  it('exposes typed connection errors', () => {
    const error = new SshConnectError('SSH_TIMEOUT', 'timeout');
    expect(error.name).toBe('SshConnectError');
    expect(error.code).toBe('SSH_TIMEOUT');
  });
});
