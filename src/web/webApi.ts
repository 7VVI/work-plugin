import type {
  SyncPushRequest,
  SyncPushResponse,
  SyncSnapshot,
  TombstoneMap,
} from '@protocol/types';
import type { SshTicketResponse } from '@protocol/ssh';

export class WebApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'WebApiError';
  }
}

export class UnauthorizedError extends WebApiError {
  constructor(message = '登录已过期') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export interface WebSession {
  authenticated: boolean;
  expiresAt: number;
  sessionDays: number;
}

export interface LoginResult {
  expiresAt: number;
  sessionDays: number;
}

export interface WebStateResponse {
  revision: number;
  serverTime: number;
  snapshot: SyncSnapshot;
  tombstones: TombstoneMap;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { silentUnauthorized?: boolean; keepalive?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers['content-type']) headers['content-type'] = 'application/json';
  if (init.method && init.method !== 'GET') headers['x-dock-csrf'] = '1';

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    keepalive: options.keepalive,
  });

  const text = await response.text();
  let data: Record<string, unknown> | null = null;
  if (text) {
    try { data = JSON.parse(text) as Record<string, unknown>; } catch { data = null; }
  }

  if (!response.ok) {
    if (response.status === 401) {
      if (!options.silentUnauthorized) {
        window.dispatchEvent(new CustomEvent('dock-unauthorized'));
      }
      throw new UnauthorizedError();
    }
    throw new WebApiError(
      response.status,
      typeof data?.error === 'string' ? data.error : 'HTTP_ERROR',
      typeof data?.message === 'string' ? data.message : undefined,
    );
  }
  return data as T;
}

export const webApi = {
  async login(secret: string): Promise<LoginResult> {
    return request<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ secret }),
    }, { silentUnauthorized: true });
  },

  async getSession(): Promise<WebSession | null> {
    try {
      return await request<WebSession>('/api/auth/session', { method: 'GET' }, { silentUnauthorized: true });
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    await request('/api/auth/logout', { method: 'POST' });
  },

  async getState(): Promise<WebStateResponse> {
    return request<WebStateResponse>('/api/sync/state', { method: 'GET' });
  },

  async push(payload: SyncPushRequest, keepalive = false): Promise<SyncPushResponse> {
    return request<SyncPushResponse>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { keepalive });
  },

  async createSshTicket(serverId: string): Promise<SshTicketResponse> {
    return request<SshTicketResponse>('/api/ssh/ticket', {
      method: 'POST',
      body: JSON.stringify({ serverId }),
    });
  },

  async getSettings(): Promise<{ sessionDays: number; serverTime: number; version: string }> {
    return request('/api/settings', { method: 'GET' });
  },

  async updateSessionDays(sessionDays: number): Promise<{ sessionDays: number }> {
    return request('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ sessionDays }),
    });
  },

  async revokeSessions(): Promise<void> {
    await request('/api/settings/revoke-sessions', { method: 'POST' });
  },
};
