import { platform } from '../platform';
import { generateId } from '../utils/id';
import type { EncryptedField } from '../types/entities';
import type { SnapshotIndex } from '@protocol/types';
import { emptySnapshotIndex } from '@protocol/index';

export interface CloudConfig {
  enabled: boolean;
  endpoint: string;
  token: EncryptedField | null;
  clientId: string;
  /** 关闭持久化期间产生的本地删除，不得在重新开启后传播到云端 */
  suppressDeletions?: boolean;
}

export interface CloudBaseline {
  revision: number;
  syncedAt: number;
  index: SnapshotIndex;
}

export type CloudState =
  | 'disabled'
  | 'unknown'
  | 'healthy'
  | 'unhealthy'
  | 'syncing'
  | 'waiting-unlock'
  | 'waiting-cloud'
  | 'auth-error'
  | 'error';

export interface CloudStatus {
  state: CloudState;
  checkedAt?: number;
  lastSyncAt?: number;
  revision?: number;
  latencyMs?: number;
  error?: string;
}

const CONFIG_KEY = 'cloud.config';
const BASELINE_KEY = 'cloud.baseline';
const STATUS_KEY = 'cloud.status';

export async function readCloudConfig(): Promise<CloudConfig | null> {
  const result = await platform.storage.local.get(CONFIG_KEY);
  const raw = result[CONFIG_KEY] as Partial<CloudConfig> | undefined;
  if (!raw) return null;
  return {
    enabled: !!raw.enabled,
    endpoint: typeof raw.endpoint === 'string' ? raw.endpoint : '',
    token: (raw.token as EncryptedField | null | undefined) ?? null,
    clientId: typeof raw.clientId === 'string' && raw.clientId ? raw.clientId : generateId(),
    suppressDeletions: raw.suppressDeletions === true,
  };
}

export async function writeCloudConfig(config: CloudConfig): Promise<void> {
  await platform.storage.local.set({ [CONFIG_KEY]: config });
}

export async function clearCloudConfig(): Promise<void> {
  await platform.storage.local.remove([CONFIG_KEY, BASELINE_KEY, STATUS_KEY]);
}

export async function readBaseline(): Promise<CloudBaseline | null> {
  const result = await platform.storage.local.get(BASELINE_KEY);
  const raw = result[BASELINE_KEY] as Partial<CloudBaseline> | undefined;
  if (!raw) return null;
  return {
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
    syncedAt: typeof raw.syncedAt === 'number' ? raw.syncedAt : 0,
    index: { ...emptySnapshotIndex(), ...(raw.index ?? {}) },
  };
}

export async function writeBaseline(baseline: CloudBaseline): Promise<void> {
  await platform.storage.local.set({ [BASELINE_KEY]: baseline });
}

export async function readStatus(): Promise<CloudStatus> {
  const result = await platform.storage.local.get(STATUS_KEY);
  const raw = result[STATUS_KEY] as Partial<CloudStatus> | undefined;
  return {
    state: raw?.state ?? 'disabled',
    checkedAt: raw?.checkedAt,
    lastSyncAt: raw?.lastSyncAt,
    revision: raw?.revision,
    latencyMs: raw?.latencyMs,
    error: raw?.error,
  };
}

export async function writeStatus(patch: Partial<CloudStatus>): Promise<CloudStatus> {
  const next = { ...(await readStatus()), ...patch };
  await platform.storage.local.set({ [STATUS_KEY]: next });
  return next;
}

function isIpLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(':') && /^[0-9a-f:.]+$/i.test(host);
}

function inputLooksLikeIp(raw: string): boolean {
  const hostPart = raw.split('/')[0] ?? '';
  if (hostPart.startsWith('[')) return true;
  const host = hostPart.split(':')[0] ?? '';
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.toLowerCase() === 'localhost';
}

export function normalizeEndpoint(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('请填写云端地址');

  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = inputLooksLikeIp(candidate) ? `http://${candidate}` : `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('云端地址格式不正确');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('云端地址只支持 http/https');
  }
  const isLoopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLoopback && !isIpLiteral(url.hostname)) {
    throw new Error('域名地址必须使用 HTTPS；IP 地址可使用 HTTP');
  }
  if (url.username || url.password) throw new Error('云端地址不能包含账号密码');
  if (url.search || url.hash) throw new Error('云端地址不能包含查询参数或锚点');
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path}`;
}
