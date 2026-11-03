interface SftpReqStream {
  handle(reqid: number, handle: Buffer): void;
  status(reqid: number, code: number, message?: string): void;
  data(reqid: number, data: Buffer): void;
  name(reqid: number, names: Array<{ filename: string; longname: string; attrs?: unknown }>): void;
  attrs(reqid: number, attrs: unknown): void;
  on(event: 'OPEN', listener: (reqid: number, filename: string, pflags: number, attrs: unknown) => void): void;
  on(event: 'READ', listener: (reqid: number, handle: Buffer, offset: number, length: number) => void): void;
  on(event: 'WRITE', listener: (reqid: number, handle: Buffer, offset: number, data: Buffer) => void): void;
  on(event: 'CLOSE', listener: (reqid: number, handle: Buffer) => void): void;
  on(event: 'OPENDIR', listener: (reqid: number, path: string) => void): void;
  on(event: 'READDIR', listener: (reqid: number, handle: Buffer) => void): void;
  on(event: 'STAT' | 'LSTAT', listener: (reqid: number, path: string) => void): void;
  on(event: 'MKDIR' | 'RMDIR' | 'REMOVE' | 'REALPATH', listener: (reqid: number, path: string) => void): void;
  on(event: 'FSETSTAT', listener: (reqid: number, handle: Buffer, attrs: unknown) => void): void;
  on(event: 'SETSTAT', listener: (reqid: number, path: string, attrs: unknown) => void): void;
  on(event: 'RENAME', listener: (reqid: number, from: string, to: string) => void): void;
}

interface SftpAttrs {
  mode: number;
  size: number;
  uid: number;
  gid: number;
  atime: number;
  mtime: number;
}

const STATUS_OK = 0;
const STATUS_EOF = 1;
const STATUS_NO_SUCH_FILE = 2;
const STATUS_FAILURE = 4;
const OPEN_WRITE = 0x00000002;
const OPEN_CREAT = 0x00000008;

function parentOf(path: string): string {
  const index = path.lastIndexOf('/');
  if (index <= 0) return '/';
  return path.slice(0, index);
}

function baseName(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? path : path.slice(index + 1);
}

/**
 * 内存 SFTP 服务端：挂在 ssh2.Server 的会话上，用于 RealSshConnector
 * openSftp()/SFTP 操作的端到端回环测试。
 */
export class InMemorySftpServer {
  readonly files = new Map<string, Buffer>();
  readonly dirs = new Set<string>(['/']);

  constructor(seed: Record<string, string | Buffer> = {}) {
    for (const [path, data] of Object.entries(seed)) {
      this.writeFile(path, Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'));
    }
  }

  readFileText(path: string): string | undefined {
    return this.files.get(path)?.toString('utf8');
  }

  exists(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }

  isDir(path: string): boolean {
    return this.dirs.has(path);
  }

  private writeFile(path: string, data: Buffer): void {
    const parent = parentOf(path);
    if (!this.dirs.has(parent)) this.dirs.add(parent);
    this.files.set(path, data);
  }

  private childrenOf(path: string): string[] {
    const prefix = path === '/' ? '/' : `${path}/`;
    const names = new Set<string>();
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) names.add(baseName(key));
    }
    for (const dir of this.dirs) {
      if (dir === path || !dir.startsWith(prefix)) continue;
      const rest = dir.slice(prefix.length);
      if (rest && !rest.includes('/')) names.add(rest);
    }
    return [...names];
  }

  private attrsOf(path: string): SftpAttrs | null {
    const file = this.files.get(path);
    if (file) return { mode: 0o100644, size: file.length, uid: 0, gid: 0, atime: 0, mtime: 0 };
    if (this.dirs.has(path)) return { mode: 0o040755, size: 0, uid: 0, gid: 0, atime: 0, mtime: 0 };
    return null;
  }

  attach(session: { on(event: 'sftp', listener: (accept: (error?: Error) => SftpReqStream) => void): void }): void {
    session.on('sftp', (accept) => {
      const sftp = accept() as unknown as SftpReqStream;
      const handles = new Map<string, { kind: 'file' | 'dir'; path: string; listed: boolean }>();
      let handleSeq = 0;

      sftp.on('REALPATH', (reqid: number, path: string) => {
        sftp.name(reqid, [{ filename: path, longname: path }]);
      });

      sftp.on('STAT', (reqid: number, path: string) => {
        const attrs = this.attrsOf(path);
        if (!attrs) return sftp.status(reqid, STATUS_NO_SUCH_FILE, 'No such file');
        sftp.attrs(reqid, attrs);
      });
      sftp.on('LSTAT', (reqid: number, path: string) => {
        const attrs = this.attrsOf(path);
        if (!attrs) return sftp.status(reqid, STATUS_NO_SUCH_FILE, 'No such file');
        sftp.attrs(reqid, attrs);
      });

      sftp.on('OPENDIR', (reqid: number, path: string) => {
        if (!this.dirs.has(path)) return sftp.status(reqid, STATUS_NO_SUCH_FILE, 'No such directory');
        const handle = `d${handleSeq += 1}`;
        handles.set(handle, { kind: 'dir', path, listed: false });
        sftp.handle(reqid, Buffer.from(handle));
      });
      sftp.on('READDIR', (reqid: number, handle: Buffer) => {
        const entry = handles.get(handle.toString('utf8'));
        if (!entry || entry.kind !== 'dir') return sftp.status(reqid, STATUS_FAILURE, 'Invalid handle');
        if (entry.listed) return sftp.status(reqid, STATUS_EOF);
        entry.listed = true;
        const names = this.childrenOf(entry.path).map(filename => {
          const child = entry.path === '/' ? `/${filename}` : `${entry.path}/${filename}`;
          return { filename, longname: filename, attrs: this.attrsOf(child) ?? undefined };
        });
        sftp.name(reqid, names);
      });

      sftp.on('OPEN', (reqid: number, filename: string, pflags: number) => {
        const isWrite = (pflags & OPEN_WRITE) !== 0 || (pflags & OPEN_CREAT) !== 0;
        if (isWrite) {
          this.writeFile(filename, Buffer.alloc(0));
        } else if (!this.files.has(filename)) {
          return sftp.status(reqid, STATUS_NO_SUCH_FILE, 'No such file');
        }
        const handle = `f${handleSeq += 1}`;
        handles.set(handle, { kind: 'file', path: filename, listed: false });
        sftp.handle(reqid, Buffer.from(handle));
      });
      sftp.on('READ', (reqid: number, handle: Buffer, offset: number, length: number) => {
        const entry = handles.get(handle.toString('utf8'));
        if (!entry || entry.kind !== 'file') return sftp.status(reqid, STATUS_FAILURE, 'Invalid handle');
        const file = this.files.get(entry.path);
        if (!file) return sftp.status(reqid, STATUS_NO_SUCH_FILE, 'No such file');
        if (offset >= file.length) return sftp.status(reqid, STATUS_EOF);
        sftp.data(reqid, file.subarray(offset, offset + length));
      });
      sftp.on('WRITE', (reqid: number, handle: Buffer, offset: number, data: Buffer) => {
        const entry = handles.get(handle.toString('utf8'));
        if (!entry || entry.kind !== 'file') return sftp.status(reqid, STATUS_FAILURE, 'Invalid handle');
        const current = this.files.get(entry.path) ?? Buffer.alloc(0);
        const next = Buffer.alloc(Math.max(current.length, offset + data.length));
        current.copy(next);
        data.copy(next, offset);
        this.writeFile(entry.path, next);
        sftp.status(reqid, STATUS_OK);
      });
      sftp.on('CLOSE', (reqid: number, handle: Buffer) => {
        handles.delete(handle.toString('utf8'));
        sftp.status(reqid, STATUS_OK);
      });

      // 客户端写流会附带属性设置，这里直接确认
      sftp.on('FSETSTAT', (reqid: number) => sftp.status(reqid, STATUS_OK));
      sftp.on('SETSTAT', (reqid: number) => sftp.status(reqid, STATUS_OK));

      sftp.on('MKDIR', (reqid: number, path: string) => {
        if (this.exists(path)) return sftp.status(reqid, STATUS_FAILURE, 'Already exists');
        this.dirs.add(path);
        sftp.status(reqid, STATUS_OK);
      });
      sftp.on('RMDIR', (reqid: number, path: string) => {
        if (!this.dirs.has(path)) return sftp.status(reqid, STATUS_NO_SUCH_FILE, 'No such directory');
        this.dirs.delete(path);
        sftp.status(reqid, STATUS_OK);
      });
      sftp.on('REMOVE', (reqid: number, path: string) => {
        if (!this.files.has(path)) return sftp.status(reqid, STATUS_NO_SUCH_FILE, 'No such file');
        this.files.delete(path);
        sftp.status(reqid, STATUS_OK);
      });
      sftp.on('RENAME', (reqid: number, from: string, to: string) => {
        const file = this.files.get(from);
        if (!file) return sftp.status(reqid, STATUS_NO_SUCH_FILE, 'No such file');
        if (this.exists(to)) return sftp.status(reqid, STATUS_FAILURE, 'Target already exists');
        this.files.delete(from);
        this.writeFile(to, file);
        sftp.status(reqid, STATUS_OK);
      });
    });
  }
}
