import type {
  SshChannel,
  SshConnectOptions,
  SshConnector,
  SshFsAttrs,
  SshFsReadStream,
  SshFsWriteStream,
  SshSftp,
  SshTarget,
} from '../src/ssh/connector';
import type { SshFsEntry } from '@protocol/ssh';

export type FakeFsSeed = string | Buffer | { dir: true } | { link: string };

interface FakeFsFile { type: 'file'; content: Buffer; mtimeMs: number }
interface FakeFsDir { type: 'dir'; children: Map<string, FakeFsNode>; mtimeMs: number }
interface FakeFsLink { type: 'link'; target: string; mtimeMs: number }
type FakeFsNode = FakeFsFile | FakeFsDir | FakeFsLink;

const CHUNK_BYTES = 16 * 1024;

function sftpErr(code: number, message: string): Error & { code: number } {
  return Object.assign(new Error(message), { code });
}

function pathParts(path: string): string[] {
  return path.split('/').filter(part => part.length > 0);
}

function newDir(now: number): FakeFsDir {
  return { type: 'dir', children: new Map(), mtimeMs: now };
}

function isDirNode(node: FakeFsNode | undefined): node is FakeFsDir {
  return !!node && node.type === 'dir';
}

/** 内存文件树，供 FakeSshConnector 的 SFTP 通道使用 */
export class FakeFsTree {
  readonly root: FakeFsDir;

  constructor(now = Date.now()) {
    this.root = newDir(now);
  }

  seed(entries: Record<string, FakeFsSeed>): void {
    for (const [path, value] of Object.entries(entries)) {
      const parts = pathParts(path);
      const name = parts.at(-1);
      if (!name) continue;
      const parent = this.ensureDir(parts.slice(0, -1));
      if (typeof value === 'string') {
        parent.children.set(name, { type: 'file', content: Buffer.from(value, 'utf8'), mtimeMs: Date.now() });
      } else if (Buffer.isBuffer(value)) {
        parent.children.set(name, { type: 'file', content: value, mtimeMs: Date.now() });
      } else if ('dir' in value) {
        parent.children.set(name, newDir(Date.now()));
      } else {
        parent.children.set(name, { type: 'link', target: value.link, mtimeMs: Date.now() });
      }
    }
  }

  private ensureDir(parts: string[]): FakeFsDir {
    let node = this.root;
    for (const part of parts) {
      const next = node.children.get(part);
      if (isDirNode(next)) {
        node = next;
        continue;
      }
      const created = newDir(Date.now());
      node.children.set(part, created);
      node = created;
    }
    return node;
  }

  /** 解析路径；follow 最后一段不跟随链接（follow 参数用于读取语义） */
  resolve(path: string, follow = false): FakeFsNode | undefined {
    const parts = pathParts(path);
    let node: FakeFsNode = this.root;
    for (let index = 0; index < parts.length; index += 1) {
      if (!isDirNode(node)) return undefined;
      const child = node.children.get(parts[index]!);
      if (!child) return undefined;
      const last = index === parts.length - 1;
      if (last && child.type === 'link' && !follow) return child;
      node = child;
    }
    return node;
  }

  parentOf(path: string): { dir: FakeFsDir; name: string } | null {
    const parts = pathParts(path);
    const name = parts.at(-1);
    if (!name) return null;
    let node: FakeFsNode = this.root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      if (!isDirNode(node)) return null;
      const child = node.children.get(parts[index]!);
      if (!child) return null;
      node = child;
    }
    return isDirNode(node) ? { dir: node, name } : null;
  }
}

export class FakeSshConnector implements SshConnector {
  readonly targets: SshTarget[] = [];
  readonly options: SshConnectOptions[] = [];
  readonly writes: Buffer[] = [];
  readonly resizes: Array<{ cols: number; rows: number }> = [];
  closed = 0;
  paused = 0;
  resumed = 0;
  failWith: Error | null = null;
  delayMs = 20;

  readonly fsTree = new FakeFsTree();
  sftpOpens = 0;
  readsDestroyed = 0;
  writesDestroyed = 0;
  /** 下一次 SFTP 操作注入失败（数字为 SFTP 状态码） */
  failSftpWith: { code: number; message: string } | null = null;
  readChunkBytes = CHUNK_BYTES;
  /** >0 时每块读取间隔毫秒，用于模拟慢速传输 */
  readTickMs = 0;

  private failSftp(): Error | null {
    if (!this.failSftpWith) return null;
    const error = sftpErr(this.failSftpWith.code, this.failSftpWith.message);
    this.failSftpWith = null;
    return error;
  }

  async connect(target: SshTarget, options: SshConnectOptions): Promise<SshChannel> {
    this.targets.push(target);
    this.options.push(options);
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    if (this.failWith) throw this.failWith;
    queueMicrotask(() => options.onFingerprint('SHA256:fake-fingerprint'));
    return {
      write: (data) => { this.writes.push(Buffer.from(data)); },
      resize: (cols, rows) => { this.resizes.push({ cols, rows }); },
      pause: () => { this.paused += 1; },
      resume: () => { this.resumed += 1; },
      close: () => { this.closed += 1; },
      openSftp: async () => {
        this.sftpOpens += 1;
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
        const error = this.failSftp();
        if (error) throw error;
        return this.createSftp();
      },
    };
  }

  private createSftp(): SshSftp {
    const tree = this.fsTree;
    const entryOf = (node: FakeFsNode, name: string): SshFsEntry => ({
      name,
      type: node.type === 'dir' ? 'dir' : node.type === 'link' ? 'link' : node.type === 'file' ? 'file' : 'other',
      size: node.type === 'file' ? node.content.length : 0,
      mtime: node.mtimeMs,
    });
    const attrsOf = (node: FakeFsNode, follow: boolean): SshFsAttrs => ({
      isDir: node.type === 'dir',
      isFile: node.type === 'file',
      isLink: node.type === 'link',
      size: node.type === 'file' ? node.content.length : 0,
      mtimeMs: node.mtimeMs,
    });
    const requireFile = (path: string): FakeFsFile => {
      const node = tree.resolve(path, true);
      if (!node) throw sftpErr(2, 'No such file');
      if (node.type === 'dir') throw sftpErr(4, 'Is a directory');
      if (node.type === 'link') throw sftpErr(4, 'Is a symbolic link');
      return node;
    };
    const requireDir = (path: string): FakeFsDir => {
      const node = tree.resolve(path, true);
      if (!node) throw sftpErr(2, 'No such file');
      if (node.type !== 'dir') throw sftpErr(4, 'Not a directory');
      return node;
    };

    return {
      stat: async path => {
        const error = this.failSftp();
        if (error) throw error;
        const node = tree.resolve(path, true);
        if (!node) throw sftpErr(2, 'No such file');
        return attrsOf(node, true);
      },
      lstat: async path => {
        const error = this.failSftp();
        if (error) throw error;
        const node = tree.resolve(path, false);
        if (!node) throw sftpErr(2, 'No such file');
        return attrsOf(node, false);
      },
      list: async path => {
        const error = this.failSftp();
        if (error) throw error;
        const dir = requireDir(path);
        const result: SshFsEntry[] = [];
        for (const [name, node] of dir.children) result.push(entryOf(node, name));
        return result;
      },
      mkdir: async path => {
        const error = this.failSftp();
        if (error) throw error;
        const parent = tree.parentOf(path);
        if (!parent) throw sftpErr(2, 'No such file');
        if (parent.dir.children.has(parent.name)) throw sftpErr(4, 'Already exists');
        parent.dir.children.set(parent.name, newDir(Date.now()));
      },
      unlink: async path => {
        const error = this.failSftp();
        if (error) throw error;
        const parent = tree.parentOf(path);
        if (!parent) throw sftpErr(2, 'No such file');
        const node = parent.dir.children.get(parent.name);
        if (!node) throw sftpErr(2, 'No such file');
        if (node.type === 'dir') throw sftpErr(4, 'Is a directory');
        parent.dir.children.delete(parent.name);
      },
      rmdir: async path => {
        const error = this.failSftp();
        if (error) throw error;
        const parent = tree.parentOf(path);
        if (!parent) throw sftpErr(2, 'No such file');
        const node = parent.dir.children.get(parent.name);
        if (!node || node.type !== 'dir') throw sftpErr(4, 'Not a directory');
        if (node.children.size > 0) throw sftpErr(4, 'Directory not empty');
        parent.dir.children.delete(parent.name);
      },
      rename: async (from, to) => {
        const error = this.failSftp();
        if (error) throw error;
        const fromParent = tree.parentOf(from);
        if (!fromParent) throw sftpErr(2, 'No such file');
        const node = fromParent.dir.children.get(fromParent.name);
        if (!node) throw sftpErr(2, 'No such file');
        const toParent = tree.parentOf(to);
        if (!toParent) throw sftpErr(2, 'No such file');
        if (toParent.dir.children.has(toParent.name)) throw sftpErr(4, 'Target already exists');
        fromParent.dir.children.delete(fromParent.name);
        toParent.dir.children.set(toParent.name, node);
      },
      createReadStream: path => {
        let handlers: {
          data?: (chunk: Buffer) => void;
          error?: (error: Error) => void;
          end?: () => void;
          close?: () => void;
        } = {};
        let destroyed = false;
        const emit = (offset: number): void => {
          if (destroyed) return;
          try {
            const node = requireFile(path);
            const content = node.content;
            if (offset >= content.length) {
              handlers.end?.();
              handlers.close?.();
              return;
            }
            handlers.data?.(Buffer.from(content.subarray(offset, offset + this.readChunkBytes)));
            if (this.readTickMs > 0) {
              setTimeout(() => emit(offset + this.readChunkBytes), this.readTickMs);
            } else {
              emit(offset + this.readChunkBytes);
            }
          } catch (error) {
            handlers.error?.(error as Error);
            handlers.close?.();
          }
        };
        const stream: SshFsReadStream = {
          on: (event, listener) => {
            handlers = { ...handlers, [event]: listener };
            if (event === 'data') {
              // 延迟到所有事件监听注册完成后开始发射数据
              const start = () => emit(0);
              if (this.readTickMs > 0) setTimeout(start, this.readTickMs);
              else queueMicrotask(start);
            }
          },
          destroy: () => {
            if (destroyed) return;
            destroyed = true;
            this.readsDestroyed += 1;
            handlers.close?.();
          },
          pause: () => { /* 内存读取无需暂停 */ },
          resume: () => { /* 内存读取无需暂停 */ },
        };
        return stream;
      },
      createWriteStream: path => {
        let handlers: {
          error?: (error: Error) => void;
          finish?: () => void;
          close?: () => void;
        } = {};
        const chunks: Buffer[] = [];
        let destroyed = false;
        let failed = false;
        let finished = false;
        const stream: SshFsWriteStream = {
          write: chunk => {
            if (destroyed || failed) return;
            chunks.push(Buffer.from(chunk));
          },
          end: () => {
            if (destroyed || failed || finished) return;
            finished = true;
            try {
              const parent = tree.parentOf(path);
              if (!parent) throw sftpErr(2, 'No such file');
              if (parent.dir.children.has(parent.name)) {
                const existing = parent.dir.children.get(parent.name)!;
                if (existing.type === 'dir') throw sftpErr(4, 'Is a directory');
              }
              parent.dir.children.set(parent.name, {
                type: 'file',
                content: Buffer.concat(chunks),
                mtimeMs: Date.now(),
              });
              handlers.finish?.();
              handlers.close?.();
            } catch (error) {
              failed = true;
              handlers.error?.(error as Error);
              handlers.close?.();
            }
          },
          destroy: () => {
            if (destroyed) return;
            destroyed = true;
            this.writesDestroyed += 1;
            handlers.close?.();
          },
          on: (event, listener) => {
            handlers = { ...handlers, [event]: listener };
          },
        };
        return stream;
      },
      end: () => { /* 内存实现无需关闭 */ },
    };
  }

  emitOutput(text: string): void {
    this.options.at(-1)?.onData(Buffer.from(text, 'utf8'));
  }

  emitExit(code = 0, signal: string | null = null): void {
    this.options.at(-1)?.onExit(code, signal);
  }
}
