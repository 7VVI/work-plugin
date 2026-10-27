import type {
  SyncPushRequest,
  SyncPushResponse,
  SyncSnapshot,
  SyncVersionDetail,
  SyncVersionMeta,
  TombstoneMap,
} from '@protocol/types';

export class CloudHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'CloudHttpError';
  }
}

export class CloudAuthError extends CloudHttpError {
  constructor(message = '云端 Token 无效') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'CloudAuthError';
  }
}

export interface CloudStateResponse {
  revision: number;
  serverTime: number;
  snapshot: SyncSnapshot;
  tombstones: TombstoneMap;
}

const TIMEOUT_MS = 10_000;

export class CloudClient {
  constructor(
    private readonly endpoint: string,
    private readonly token: string,
  ) {}

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${this.endpoint}/api/health`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok) throw new CloudHttpError(response.status, 'HEALTH_FAILED');
      const data = await response.json() as { ok?: boolean };
      if (!data.ok) throw new CloudHttpError(503, 'HEALTH_FAILED');
      return { ok: true, latencyMs: Date.now() - startedAt };
    } finally {
      clearTimeout(timer);
    }
  }

  async ping(): Promise<{ ok: boolean; revision: number; serverTime: number }> {
    return this.request('/api/sync/ping', { method: 'GET' });
  }

  async getState(): Promise<CloudStateResponse> {
    return this.request('/api/sync/state', { method: 'GET' });
  }

  async listVersions(limit = 30, before?: number): Promise<{ versions: SyncVersionMeta[] }> {
    const query = new URLSearchParams({ limit: String(limit) });
    if (before !== undefined) query.set('before', String(before));
    return this.request(`/api/sync/history?${query.toString()}`, { method: 'GET' });
  }

  async getVersion(revision: number): Promise<SyncVersionDetail> {
    return this.request(`/api/sync/history/${revision}`, { method: 'GET' });
  }

  async push(payload: SyncPushRequest): Promise<SyncPushResponse> {
    return this.request('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      });
      const text = await response.text();
      let data: Record<string, unknown> | null = null;
      if (text) {
        try { data = JSON.parse(text) as Record<string, unknown>; } catch { data = null; }
      }
      if (!response.ok) {
        if (response.status === 401) throw new CloudAuthError();
        throw new CloudHttpError(
          response.status,
          typeof data?.error === 'string' ? data.error : 'HTTP_ERROR',
          typeof data?.message === 'string' ? data.message : undefined,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
