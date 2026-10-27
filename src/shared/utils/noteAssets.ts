import { noteAssetRepo } from '../db/repositories/noteAssetRepo';

/** 正文里引用本地图片资源的前缀，形如 ![alt](dock-asset:ast_xxx) */
export const ASSET_REF_PREFIX = 'dock-asset:';

const ASSET_REF_RE = /dock-asset:([A-Za-z0-9_-]{1,128})/g;

/** 生成正文里的资源引用 */
export function assetRef(id: string): string {
  return `${ASSET_REF_PREFIX}${id}`;
}

/** 判断地址是否是本地资源引用 */
export function isAssetRef(src: string | undefined | null): boolean {
  return typeof src === 'string' && src.startsWith(ASSET_REF_PREFIX);
}

/** 从地址里解析资源 id */
export function parseAssetRef(src: string): string | null {
  if (!isAssetRef(src)) return null;
  const id = src.slice(ASSET_REF_PREFIX.length);
  return id || null;
}

/** 从 markdown 里收集引用到的资源 id */
export function collectAssetRefs(markdown: string): string[] {
  const ids = new Set<string>();
  for (const match of markdown.matchAll(ASSET_REF_RE)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}

const objectUrlCache = new Map<string, string>();

/**
 * 把资源引用解析成浏览器可显示的地址。
 * 同一资源复用同一个 object URL，避免重复创建导致内存泄漏。
 */
export async function resolveAssetUrl(src: string): Promise<string> {
  const id = parseAssetRef(src);
  if (!id) return src;
  const cached = objectUrlCache.get(id);
  if (cached) return cached;
  const asset = await noteAssetRepo.get(id);
  if (!asset) return '';
  const url = URL.createObjectURL(new Blob([asset.data], { type: asset.mime }));
  objectUrlCache.set(id, url);
  return url;
}

/** 释放已缓存的 object URL（编辑器销毁时调用） */
export function releaseAssetUrls(): void {
  for (const url of objectUrlCache.values()) URL.revokeObjectURL(url);
  objectUrlCache.clear();
}
