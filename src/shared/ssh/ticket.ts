import { isWeb } from '@shared/platform';
import { readDirty } from '@shared/sync/dirtyTracker';
import {
  CloudNotConfiguredError,
  CloudTokenError,
  createSshCloudClient,
  pushToCloud,
} from '@shared/sync/syncService';
import { CloudHttpError } from '@shared/sync/cloudClient';
import { VaultLockedError } from '@shared/sync/snapshotBuilder';

export type SshErrorKind = 'settings' | 'sync' | 'upgrade' | 'disabled' | 'login' | 'unknown';

export interface SshErrorInfo {
  kind: SshErrorKind;
  message: string;
}

export function buildSshWsUrl(endpoint: string, ticket: string): string {
  const url = new URL(endpoint);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const prefix = url.pathname.replace(/\/+$/, '');
  url.pathname = `${prefix}/api/ssh/ws`;
  url.search = new URLSearchParams({ ticket }).toString();
  url.hash = '';
  return url.toString();
}

/**
 * 取一次性票据并推导出 WS 地址。
 * 扩展走云端 Bearer；Web 控制台走同源 Cookie + CSRF。
 */
export async function requestSshWsUrl(serverId: string): Promise<string> {
  if (isWeb) {
    const { webApi } = await import('@/web/webApi');
    const result = await webApi.createSshTicket(serverId);
    return buildSshWsUrl(window.location.origin, result.ticket);
  }

  // 本地服务器刚编辑过时先同步，避免服务端用旧密码/私钥连接
  if (await readDirty()) {
    await pushToCloud();
  }
  const { endpoint, client } = await createSshCloudClient();
  const result = await client.createSshTicket(serverId);
  return buildSshWsUrl(endpoint, result.ticket);
}

/** 服务器尚未同步到云端时的显式补救：先推送再重试 */
export async function syncBeforeSsh(): Promise<void> {
  if (!isWeb) await pushToCloud();
}

export function describeSshError(error: unknown): SshErrorInfo {
  if (error instanceof CloudNotConfiguredError) {
    return { kind: 'settings', message: '未启用云端同步，请先在设置中配置云端地址和 Token' };
  }
  if (error instanceof VaultLockedError) {
    return { kind: 'settings', message: '主密码未解锁，请先在设置中解锁' };
  }
  if (error instanceof CloudTokenError) {
    return { kind: 'settings', message: '云端 Token 无法解密，请在设置中重新保存' };
  }
  if (error instanceof CloudHttpError) {
    if (error.status === 404 && error.code === 'SERVER_NOT_FOUND') {
      return { kind: 'sync', message: '该服务器尚未同步到云端，请先同步后再连接' };
    }
    if (error.status === 503 && error.code === 'SSH_DISABLED') {
      return { kind: 'disabled', message: '服务端未启用 SSH 终端（DOCK_SSH_ENABLED=false）' };
    }
    if (error.status === 404 || error.status === 405 || error.status === 501) {
      return { kind: 'upgrade', message: '服务端版本过旧，请先升级服务端镜像' };
    }
    if (error.status === 401) {
      return { kind: 'login', message: '云端认证失败，请检查 Token 或重新登录' };
    }
    return { kind: 'unknown', message: error.message || '连接云端失败' };
  }
  const status = (error as { status?: unknown }).status;
  const code = (error as { code?: unknown }).code;
  if (status === 401) return { kind: 'login', message: '登录已过期，请重新登录' };
  if (status === 503 && code === 'SSH_DISABLED') {
    return { kind: 'disabled', message: '服务端未启用 SSH 终端（DOCK_SSH_ENABLED=false）' };
  }
  if (status === 404) return { kind: 'upgrade', message: '服务端版本过旧，请先升级服务端镜像' };
  return {
    kind: 'unknown',
    message: error instanceof Error ? error.message : '连接失败',
  };
}
