import type { SshErrorCode, SshFsEntry, SshFsServerMessage, SshServerMessage } from '@protocol/ssh';
import { mapSftpError, type SshFsReadStream, type SshFsWriteStream, type SshSftp } from './connector';

/** fs- 文本帧的字符上限（< WS 256KiB maxPayload） */
export const FS_CONTROL_MAX_CHARS = 240_000;
const RAW_CHUNK_BYTES = 48 * 1024;
const MAX_DIR_ENTRIES = 1000;
const HIGH_WATER_BYTES = 1024 * 1024;
const LOW_WATER_BYTES = 256 * 1024;
const MAX_RM_DEPTH = 16;
const MAX_RM_TOTAL = 5000;
const MAX_PATH_CHARS = 4096;

export interface SshFsGatewayCaps {
  enabled: boolean;
  maxEdit: number;
  maxTransfer: number;
}

export interface SshFsGatewayOptions {
  openSftp: () => Promise<SshSftp>;
  caps: SshFsGatewayCaps;
  sendJson: (message: SshServerMessage, onSent?: () => void) => void;
  /** 读写泵据此暂停/恢复（与终端输出共用 socket 水位） */
  isBlocked: () => boolean;
  /** 每个收发的 fs 帧调用一次（空闲计时） */
  onActivity: () => void;
  logger?: Pick<Console, 'warn'>;
}

interface ReadTransfer {
  stream: SshFsReadStream | null;
  bytes: number;
  seq: number;
  done: boolean;
}

interface WriteTransfer {
  path: string;
  size: number;
  intent: 'edit' | 'upload';
  stream: SshFsWriteStream | null;
  bytes: number;
  expectedSeq: number;
  done: boolean;
}

function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`;
}

function sftpFailure(code: SshErrorCode, message: string): { code: SshErrorCode; message: string } {
  return { code, message };
}

/**
 * 会话内 SFTP 文件操作网关：fs-* 控制帧 → ssh2 SFTP 通道。
 * 简单操作经 promise 队列串行；读/写各允许一个活跃流式传输并做上限与背压控制。
 */
export class SshFsGateway {
  private readonly reads = new Map<number, ReadTransfer>();
  private readonly writes = new Map<number, WriteTransfer>();
  private queue: Promise<void> = Promise.resolve();
  private sftp: SshSftp | null = null;
  private sftpPromise: Promise<SshSftp> | null = null;
  private closed = false;

  constructor(private readonly options: SshFsGatewayOptions) {}

  /** 会话 cleanup 时调用：销毁流并关闭 sftp 通道 */
  abortAll(): void {
    this.closed = true;
    for (const read of this.reads.values()) {
      try { read.stream?.destroy(); } catch { /* already dead */ }
    }
    this.reads.clear();
    for (const write of this.writes.values()) {
      try { write.stream?.destroy(); } catch { /* already dead */ }
    }
    this.writes.clear();
    try { this.sftp?.end(); } catch { /* already dead */ }
    this.sftp = null;
    this.sftpPromise = null;
  }

  /** 处理 fs-* 控制消息；返回 true 表示已被网关消费 */
  handleMessage(message: Record<string, unknown>): boolean {
    const type = message.type;
    if (typeof type !== 'string' || !type.startsWith('fs-')) return false;
    const id = this.readId(message);
    this.options.onActivity();
    if (!this.options.caps.enabled) {
      this.fail(id, 'SFTP_DISABLED', '服务端未启用文件管理');
      return true;
    }
    if (id == null) {
      this.fail(null, 'SFTP_FAILED', '参数不合法');
      return true;
    }
    switch (type) {
      case 'fs-list':
        this.onList(id, message);
        return true;
      case 'fs-stat':
        this.onStat(id, message);
        return true;
      case 'fs-read':
        this.onRead(id, message);
        return true;
      case 'fs-write-start':
        this.onWriteStart(id, message);
        return true;
      case 'fs-write-chunk':
        this.onWriteChunk(id, message);
        return true;
      case 'fs-mkdir':
      case 'fs-touch':
      case 'fs-rm':
      case 'fs-rename':
        this.onSimple(id, type, message);
        return true;
      case 'fs-cancel':
        this.onCancel(id);
        return true;
      default:
        return true;
    }
  }

  // ---------- 基础设施 ----------

  private withSftp(run: (sftp: SshSftp) => Promise<void>): Promise<void> {
    return (async () => {
      if (this.closed) return;
      const sftp = await this.ensureSftp();
      await run(sftp);
    })();
  }

  private fail(id: number | null, code: SshErrorCode, message: string): void {
    if (this.closed) return;
    this.options.sendJson({ type: 'fs-error', id, code, message });
  }

  private failRead(id: number, code: SshErrorCode, message: string): void {
    const read = this.reads.get(id);
    if (read) {
      try { read.stream?.destroy(); } catch { /* already dead */ }
      this.reads.delete(id);
    }
    this.fail(id, code, message);
  }

  private failWrite(id: number, code: SshErrorCode, message: string): void {
    const write = this.writes.get(id);
    if (write) {
      write.done = true;
      try { write.stream?.destroy(); } catch { /* already dead */ }
      this.writes.delete(id);
    }
    this.fail(id, code, message);
  }

  private enqueue(id: number | null, run: (sftp: SshSftp) => Promise<void>): void {
    this.queue = this.queue
      .then(() => this.withSftp(run))
      .catch(error => {
        const code = error && typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: SshErrorCode }).code
          : mapSftpError(error);
        const message = error instanceof Error ? error.message : '文件操作失败';
        this.options.logger?.warn?.('[dock-ssh] fs op failed:', message);
        this.fail(id, code, message);
      });
  }

  private readId(message: Record<string, unknown>): number | null {
    const id = message.id;
    return typeof id === 'number' && Number.isInteger(id) && id >= 1 ? id : null;
  }

  private readPath(message: Record<string, unknown>): string | null {
    const path = message.path;
    return typeof path === 'string' && path.length >= 1 && path.length <= MAX_PATH_CHARS && !path.includes('\0')
      ? path
      : null;
  }

  // ---------- 目录 / 元数据 ----------

  private onList(id: number, message: Record<string, unknown>): void {
    const path = this.readPath(message);
    if (id == null || path == null) {
      this.fail(id, 'SFTP_FAILED', '参数不合法');
      return;
    }
    const limit = typeof message.limit === 'number' && Number.isInteger(message.limit) && message.limit >= 1
      ? Math.min(message.limit, MAX_DIR_ENTRIES)
      : MAX_DIR_ENTRIES;
    this.enqueue(id, async sftp => {
      const entries = await sftp.list(path);
      let truncated = false;
      const items = entries.slice();
      if (items.length > limit) {
        items.length = limit;
        truncated = true;
      }
      const payload: SshServerMessage & { type: 'fs-list' } = {
        type: 'fs-list',
        id,
        path,
        entries: items.map(entry => ({ ...entry })),
        truncated,
      };
      // 序列化体积兜底：超长时逐条弹出
      while (JSON.stringify(payload).length > FS_CONTROL_MAX_CHARS && payload.entries.length > 1) {
        payload.entries.pop();
        payload.truncated = true;
      }
      this.options.sendJson(payload);
    });
  }

  private onStat(id: number, message: Record<string, unknown>): void {
    const path = this.readPath(message);
    if (id == null || path == null) {
      this.fail(id, 'SFTP_FAILED', '参数不合法');
      return;
    }
    this.enqueue(id, async sftp => {
      const attrs = await sftp.stat(path);
      this.options.sendJson({
        type: 'fs-stat',
        id,
        stat: {
          type: attrs.isDir ? 'dir' : attrs.isLink ? 'link' : attrs.isFile ? 'file' : 'other',
          size: attrs.size,
          mtime: attrs.mtimeMs,
        },
      });
    });
  }

  // ---------- 读（编辑 / 下载） ----------

  private onRead(id: number, message: Record<string, unknown>): void {
    const path = this.readPath(message);
    const intent = message.intent === 'download' ? 'download' : 'edit';
    if (path == null) {
      this.fail(id, 'SFTP_FAILED', '参数不合法');
      return;
    }
    if (this.reads.size >= 1) {
      this.fail(id, 'SFTP_BUSY', '已有文件传输进行中');
      return;
    }
    const transfer: ReadTransfer = { stream: null, bytes: 0, seq: 0, done: false };
    this.reads.set(id, transfer);
    void (async () => {
      if (this.closed) return;
      const sftp = await this.ensureSftp();
      const cap = intent === 'download' ? this.options.caps.maxTransfer : this.options.caps.maxEdit;
      const attrs = await sftp.stat(path);
      if (attrs.isDir) throw sftpFailure('SFTP_FAILED', '目标是目录，无法按文件读取');
      if (attrs.size > cap) {
        throw sftpFailure(
          'SFTP_TOO_LARGE',
          `文件 ${(attrs.size / 1024 / 1024).toFixed(1)}MB 超过上限 ${(cap / 1024 / 1024).toFixed(0)}MB`,
        );
      }
      if (this.reads.get(id) !== transfer || transfer.done) return;
      this.options.sendJson({ type: 'fs-read-meta', id, size: attrs.size, mtime: attrs.mtimeMs });

      const stream = sftp.createReadStream(path);
      transfer.stream = stream;
      let blocked = false;
      stream.on('data', (chunk: Buffer) => {
        if (this.closed || transfer.done || this.reads.get(id) !== transfer) {
          stream.destroy();
          return;
        }
        transfer.bytes += chunk.length;
        if (transfer.bytes > cap) {
          transfer.done = true;
          this.reads.delete(id);
          stream.destroy();
          this.fail(id, 'SFTP_TOO_LARGE', '文件读取超过大小上限');
          return;
        }
        const data = chunk.toString('base64');
        const seq = transfer.seq;
        transfer.seq += 1;
        this.options.sendJson({ type: 'fs-read-chunk', id, seq, data }, () => {
          if (!blocked && !this.options.isBlocked()) return;
          if (!this.options.isBlocked() && blocked) {
            blocked = false;
            stream.resume();
          }
        });
        if (!blocked && this.options.isBlocked()) {
          blocked = true;
          stream.pause();
        }
      });
      stream.on('end', () => {
        if (transfer.done || this.reads.get(id) !== transfer) return;
        transfer.done = true;
        this.reads.delete(id);
        this.options.sendJson({ type: 'fs-read-end', id });
      });
      stream.on('error', error => {
        if (transfer.done || this.reads.get(id) !== transfer) return;
        transfer.done = true;
        this.reads.delete(id);
        this.fail(id, mapSftpError(error), error.message || '读取失败');
      });
    })().catch(error => {
      if (this.reads.get(id) === transfer) {
        transfer.done = true;
        this.reads.delete(id);
      }
      const code = error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: SshErrorCode }).code
        : mapSftpError(error);
      this.fail(id, code, error instanceof Error ? error.message : '读取失败');
    });
  }

  private async ensureSftp(): Promise<SshSftp> {
    if (!this.sftpPromise) {
      this.sftpPromise = this.options.openSftp();
      try {
        this.sftp = await this.sftpPromise;
      } catch (error) {
        this.sftpPromise = null;
        throw error;
      }
    }
    const sftp = this.sftp;
    if (!sftp) throw sftpFailure('SFTP_FAILED', 'SFTP 通道不可用');
    return sftp;
  }

  // ---------- 写（编辑保存 / 上传） ----------

  private onWriteStart(id: number, message: Record<string, unknown>): void {
    const path = this.readPath(message);
    const size = typeof message.size === 'number' && Number.isFinite(message.size) && message.size >= 0
      ? Math.floor(message.size)
      : -1;
    const intent = message.intent === 'edit' ? 'edit' : 'upload';
    if (path == null || size < 0) {
      this.fail(id, 'SFTP_FAILED', '参数不合法');
      return;
    }
    const cap = intent === 'edit' ? this.options.caps.maxEdit : this.options.caps.maxTransfer;
    if (size > cap) {
      this.fail(id, 'SFTP_TOO_LARGE', `文件超过 ${(cap / 1024 / 1024).toFixed(0)}MB 上限`);
      return;
    }
    if (this.writes.size >= 1) {
      this.fail(id, 'SFTP_BUSY', '已有文件传输进行中');
      return;
    }
    if (size === 0) {
      // 空文件：直接创建并结束，无需分片
      this.enqueue(id, async sftp => {
        const stream = sftp.createWriteStream(path);
        await new Promise<void>((resolve, reject) => {
          let failed = false;
          stream.on('error', error => {
            failed = true;
            reject(error);
          });
          // ssh2 的写流以 close 收尾（不一定触发 finish）
          stream.on('close', () => {
            if (!failed) resolve();
          });
          stream.end();
        });
        this.options.sendJson({ type: 'fs-ok', id });
      });
      return;
    }
    const transfer: WriteTransfer = {
      path,
      size,
      intent,
      stream: null,
      bytes: 0,
      expectedSeq: 0,
      done: false,
    };
    this.writes.set(id, transfer);
  }

  private onWriteChunk(id: number, message: Record<string, unknown>): void {
    const seq = typeof message.seq === 'number' && Number.isInteger(message.seq) && message.seq >= 0
      ? message.seq
      : -1;
    const data = typeof message.data === 'string' && message.data.length <= 65_536 ? message.data : null;
    const transfer = this.writes.get(id);
    if (!transfer) return;
    if (transfer.done) return;
    if (seq !== transfer.expectedSeq || data == null) {
      this.failWrite(id, 'SFTP_FAILED', '分片顺序异常，写入已中止');
      return;
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(data, 'base64');
    } catch {
      this.failWrite(id, 'SFTP_FAILED', '分片数据不合法');
      return;
    }
    transfer.bytes += buffer.length;
    if (transfer.bytes > transfer.size) {
      this.failWrite(id, 'SFTP_TOO_LARGE', '上传内容超过声明大小');
      return;
    }

    void (async () => {
      const sftp = await this.ensureSftp();
      if (!transfer.stream) {
        const stream = sftp.createWriteStream(transfer.path);
        stream.on('error', error => {
          if (!transfer.done) this.failWrite(id, mapSftpError(error), error.message || '写入失败');
        });
        transfer.stream = stream;
      }
      const stream = transfer.stream;
      if (!stream) return;
      stream.write(buffer);
      transfer.expectedSeq = seq + 1;
      this.options.sendJson({ type: 'fs-ack', id, seq });
      if (transfer.bytes >= transfer.size) {
        transfer.done = true;
        await new Promise<void>((resolve, reject) => {
          let failed = false;
          stream.on('error', error => {
            failed = true;
            reject(error);
          });
          stream.on('close', () => {
            if (!failed) resolve();
          });
          stream.end();
        });
        this.writes.delete(id);
        this.options.sendJson({ type: 'fs-ok', id });
      }
    })().catch(error => {
      if (this.writes.get(id) === transfer && !transfer.done) this.failWrite(id, mapSftpError(error), error instanceof Error ? error.message : '写入失败');
    });
  }

  // ---------- 简单操作 ----------

  private onSimple(id: number, type: string, message: Record<string, unknown>): void {
    if (type === 'fs-rename') {
      const from = typeof message.from === 'string' ? message.from : null;
      const to = typeof message.to === 'string' ? message.to : null;
      if (!from || !to || from.length > MAX_PATH_CHARS || to.length > MAX_PATH_CHARS) {
        this.fail(id, 'SFTP_FAILED', '参数不合法');
        return;
      }
      this.enqueue(id, async sftp => {
        await sftp.rename(from, to);
        this.options.sendJson({ type: 'fs-ok', id });
      });
      return;
    }
    const path = this.readPath(message);
    if (path == null) {
      this.fail(id, 'SFTP_FAILED', '参数不合法');
      return;
    }
    this.enqueue(id, async sftp => {
      if (type === 'fs-mkdir') {
        await sftp.mkdir(path);
      } else if (type === 'fs-touch') {
        let exists = false;
        try {
          await sftp.stat(path);
          exists = true;
        } catch (error) {
          if (mapSftpError(error) !== 'SFTP_NOT_FOUND') throw error;
        }
        if (!exists) {
          const stream = sftp.createWriteStream(path);
          await new Promise<void>((resolve, reject) => {
            stream.on('error', reject);
            stream.on('finish', resolve);
            stream.end();
          });
        }
      } else if (type === 'fs-rm') {
        const recursive = message.recursive === true;
        if (recursive) {
          let deleted = 0;
          const removeTree = async (target: string, depth: number): Promise<void> => {
            if (depth > MAX_RM_DEPTH) throw sftpFailure('SFTP_FAILED', '目录层级过深，请在终端执行 rm -rf');
            const attrs = await sftp.lstat(target);
            if (!attrs.isDir) {
              await sftp.unlink(target);
              deleted += 1;
              if (deleted > MAX_RM_TOTAL) throw sftpFailure('SFTP_FAILED', '目录过大，请在终端执行 rm -rf');
              return;
            }
            const entries = await sftp.list(target);
            for (const entry of entries) {
              if (deleted > MAX_RM_TOTAL) throw sftpFailure('SFTP_FAILED', '目录过大，请在终端执行 rm -rf');
              const child = joinPath(target, entry.name);
              if (entry.type === 'dir') {
                await removeTree(child, depth + 1);
              } else {
                await sftp.unlink(child);
                deleted += 1;
              }
            }
            await sftp.rmdir(target);
            deleted += 1;
          };
          await removeTree(path, 0);
        } else {
          await sftp.unlink(path);
        }
      }
      this.options.sendJson({ type: 'fs-ok', id });
    });
  }

  private onCancel(id: number | null): void {
    if (id == null) return;
    if (this.reads.has(id)) {
      this.failRead(id, 'SFTP_FAILED', '传输已取消');
      return;
    }
    if (this.writes.has(id)) {
      this.failWrite(id, 'SFTP_FAILED', '传输已取消');
    }
  }
}
