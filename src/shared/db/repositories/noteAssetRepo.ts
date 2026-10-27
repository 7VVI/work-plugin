import { db } from '../schema';
import { MAX_ASSET_BYTES } from '@protocol/limits';
import { collectAssetRefs } from '../../utils/noteAssets';
import type { NoteAsset } from '../../types/entities';

export class NoteAssetTooLargeError extends Error {
  constructor(limit: number) {
    super(`图片超过 ${Math.floor(limit / 1024 / 1024)}MB 上限`);
    this.name = 'NoteAssetTooLargeError';
  }
}

export class NoteAssetTypeError extends Error {
  constructor() {
    super('只支持图片文件');
    this.name = 'NoteAssetTypeError';
  }
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** 读取图片字节，兼容没有 Blob.arrayBuffer 的环境 */
export function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsArrayBuffer(blob);
  });
}

/** 计算内容 sha-256，用于相同图片去重 */
export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await readBlob(blob));
  return toHex(digest);
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBuffer(data: string): ArrayBuffer {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export const noteAssetRepo = {
  async all(): Promise<NoteAsset[]> {
    return db.noteAssets.toArray();
  },

  async get(id: string): Promise<NoteAsset | undefined> {
    return db.noteAssets.get(id);
  },

  /** 写入图片：内容相同则复用已有资源 */
  async save(blob: Blob, mime: string): Promise<NoteAsset> {
    if (!mime.startsWith('image/')) throw new NoteAssetTypeError();
    if (blob.size > MAX_ASSET_BYTES) throw new NoteAssetTooLargeError(MAX_ASSET_BYTES);
    const data = await readBlob(blob);
    const hash = toHex(await crypto.subtle.digest('SHA-256', data));
    const existing = await db.noteAssets.where('hash').equals(hash).first();
    if (existing) return existing;
    const now = Date.now();
    const asset: NoteAsset = {
      id: `ast_${hash.slice(0, 32)}`,
      mime,
      size: blob.size,
      hash,
      data,
      createdAt: now,
      updatedAt: now,
    };
    await db.noteAssets.put(asset);
    return asset;
  },

  async remove(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await db.noteAssets.bulkDelete(ids);
  },
};

/**
 * 清理不再被任何笔记引用的图片资源，并写入删除墓碑避免云端复活。
 * 必须在删除笔记的事务内调用。
 */
export async function releaseUnusedAssets(contents: string[], deletedAt: number): Promise<void> {
  const ids = new Set<string>();
  for (const content of contents) {
    for (const id of collectAssetRefs(content)) ids.add(id);
  }
  for (const id of ids) {
    const ref = `dock-asset:${id}`;
    const stillUsed = await db.notes.filter(note => note.content.includes(ref)).count();
    if (stillUsed > 0) continue;
    await db.noteAssets.delete(id);
    await db.deletions.put({
      id: `noteAsset:${id}`,
      entityType: 'noteAsset',
      entityId: id,
      deletedAt,
    });
  }
}
