import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { createServer, type Socket } from 'node:net';
import { RealSshConnector, SshConnectError } from '../src/ssh/connector';
import type { SshChannel } from '../src/ssh/connector';
import { InMemorySftpServer } from './sshLoopbackSftp';

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

function startServer(sftpServer?: { attach(session: unknown): void }) {
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
        if (sftpServer) sftpServer.attach(session);
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

describe('SFTP over loopback', () => {
  let closeServer: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (closeServer) await closeServer();
    closeServer = null;
  });

  async function connectWithSftp(seed: Record<string, Buffer | string>) {
    const sftpServer = new InMemorySftpServer(seed);
    const info = await startServer(sftpServer);
    closeServer = info.close;
    const connector = new RealSshConnector();
    const channel = await connector.connect(
      {
        serverId: 'srv_sftp',
        host: '127.0.0.1',
        port: info.port,
        username: USERNAME,
        password: PASSWORD,
      },
      { cols: 80, rows: 24, onFingerprint: () => undefined, onData: () => undefined, onExit: () => undefined },
    );
    const sftp = await channel.openSftp();
    return { channel, sftp, sftpServer };
  }

  it('lists and stats entries over a real sftp channel', async () => {
    const { channel, sftp, sftpServer } = await connectWithSftp({ '/docs/a.md': 'alpha' });
    try {
      const entries = await sftp.list('/docs');
      expect(entries.map(entry => entry.name)).toEqual(['a.md']);
      const attrs = await sftp.stat('/docs/a.md');
      expect(attrs.isFile).toBe(true);
      expect(attrs.size).toBe(5);
      expect(sftpServer.readFileText('/docs/a.md')).toBe('alpha');
    } finally {
      sftp.end();
      channel.close();
    }
  });

  it('reads a 100KB file through the read stream', async () => {
    const content = Buffer.from(Array.from({ length: 100 * 1024 }, (_, index) => index % 256));
    const { channel, sftp } = await connectWithSftp({ '/big.bin': content });
    try {
      const chunks: Buffer[] = [];
      const stream = sftp.createReadStream('/big.bin');
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', resolve);
      });
      expect(Buffer.concat(chunks).equals(content)).toBe(true);
    } finally {
      sftp.end();
      channel.close();
    }
  });

  it('writes a file and reads it back', async () => {
    const { channel, sftp, sftpServer } = await connectWithSftp({});
    try {
      const payload = Buffer.from('写入中文内容\nsecond line\n', 'utf8');
      const stream = sftp.createWriteStream('/docs/新文件.md');
      await new Promise<void>((resolve, reject) => {
        stream.on('error', reject);
        stream.on('close', resolve);
        stream.write(payload);
        stream.end();
      });
      expect(sftpServer.readFileText('/docs/新文件.md')).toBe(payload.toString('utf8'));
    } finally {
      sftp.end();
      channel.close();
    }
  });

  it('supports mkdir / rename / rm and refuses overwriting renames', async () => {
    const { channel, sftp, sftpServer } = await connectWithSftp({ '/a.txt': 'a', '/b.txt': 'b' });
    try {
      await sftp.mkdir('/new-dir');
      expect(sftpServer.isDir('/new-dir')).toBe(true);

      await sftp.rename('/a.txt', '/new-dir/renamed.md');
      expect(sftpServer.exists('/a.txt')).toBe(false);
      expect(sftpServer.readFileText('/new-dir/renamed.md')).toBe('a');

      await expect(sftp.rename('/new-dir/renamed.md', '/b.txt')).rejects.toThrow();

      await sftp.unlink('/b.txt');
      expect(sftpServer.exists('/b.txt')).toBe(false);
    } finally {
      sftp.end();
      channel.close();
    }
  });
});
