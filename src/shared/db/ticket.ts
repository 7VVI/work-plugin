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

export type DbErrorKind = 'settings' | 'sync' | 'upgrade' | 'disabled' | 'login' | 'unknown';

export interface DbErrorInfo {
  kind: DbErrorKind;
  message: string;
}

export function buildDbWsUrl(endpoint: string, ticket: string): string {
  const url = new URL(endpoint);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const prefix = url.pathname.replace(/\/+$/, '');
  url.pathname = `${prefix}/api/db/ws`;
  url.search = new URLSearchParams({ ticket }).toString();
  url.hash = '';
  return url.toString();
}

/**
 * 取一次性票据并推导出 WS 地址。
 * 扩展走云端 Bearer；Web 控制台走同源 Cookie + CSRF。
 */
export async function requestDbWsUrl(middlewareId: string): Promise<string> {
  if (isWeb) {
    const { webApi } = await import('@/web/webApi');
    const result = await webApi.createDbTicket(middlewareId);
    return buildDbWsUrl(window.location.origin, result.ticket);
  }

  // 本地刚编辑过中间件时先同步，避免服务端用旧密码连接
  if (await readDirty()) {
    await pushToCloud();
  }
  const { endpoint, client } = await createSshCloudClient();
  const result = await client.createDbTicket(middlewareId);
  return buildDbWsUrl(endpoint, result.ticket);
}

export function describeDbError(error: unknown): DbErrorInfo {
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
    if (error.status === 404 && error.code === 'DB_NOT_FOUND') {
      return { kind: 'sync', message: '该中间件尚未同步到云端，请先同步后再打开' };
    }
    if (error.status === 503 && error.code === 'DB_DISABLED') {
      return { kind: 'disabled', message: '服务端未启用数据库管理（DOCK_DB_ENABLED=false）' };
    }
    if (error.status === 400 && error.code === 'DB_TYPE_UNSUPPORTED') {
      return { kind: 'unknown', message: '该中间件类型不支持数据库管理' };
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
  if (status === 503 && code === 'DB_DISABLED') {
    return { kind: 'disabled', message: '服务端未启用数据库管理（DOCK_DB_ENABLED=false）' };
  }
  if (status === 404) return { kind: 'upgrade', message: '服务端版本过旧，请先升级服务端镜像' };
  return {
    kind: 'unknown',
    message: error instanceof Error ? error.message : '连接失败',
  };
}
