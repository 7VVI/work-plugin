import { cryptoService } from '../services/cryptoService';
import { buildLocalSnapshot, VaultLockedError } from './snapshotBuilder';
import { applyRemoteSnapshot, type ApplySummary } from './snapshotApply';
import { buildTombstones, pruneSyncedDeletions } from './tombstones';
import { CloudAuthError, CloudClient, CloudHttpError } from './cloudClient';
import {
  normalizeEndpoint,
  readBaseline,
  readCloudConfig,
  readStatus,
  writeBaseline,
  writeCloudConfig,
  writeStatus,
  type CloudConfig,
  type CloudStatus,
} from './syncStorage';
import { clearDirty, flushDirtyNow, readDirty, withDirtyTrackingSuspended } from './dirtyTracker';
import { clearDeletions } from '../db/deletionLog';
import {
  SNAPSHOT_TABLES,
  emptyTombstones,
  indexFromSnapshot,
  type SyncPushRequest,
  type SyncPushResponse,
} from '@protocol/index';

export class CloudNotConfiguredError extends Error {
  constructor() {
    super('云端同步未启用或未配置完整');
    this.name = 'CloudNotConfiguredError';
  }
}

export class CloudTokenError extends Error {
  constructor() {
    super('云端 Token 无法解密，请重新输入');
    this.name = 'CloudTokenError';
  }
}

async function ensureSecretsUnlocked(): Promise<void> {
  if (await cryptoService.isEnabled() && !cryptoService.isUnlocked()) {
    throw new VaultLockedError();
  }
}

async function resolveToken(config: CloudConfig): Promise<string> {
  if (!config.token) throw new CloudNotConfiguredError();
  if (await cryptoService.isEnabled() && !cryptoService.isUnlocked()) {
    throw new VaultLockedError();
  }
  try {
    return await cryptoService.decryptField(config.token);
  } catch {
    throw new CloudTokenError();
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return '云端请求超时';
    if (error instanceof TypeError) return '无法连接云端';
    return error.message;
  }
  return String(error);
}

async function markFailure(error: unknown): Promise<void> {
  if (error instanceof VaultLockedError) {
    await writeStatus({ state: 'waiting-unlock', checkedAt: Date.now(), error: error.message });
    return;
  }
  if (error instanceof CloudTokenError || error instanceof CloudAuthError) {
    await writeStatus({ state: 'auth-error', checkedAt: Date.now(), error: error.message });
    return;
  }
  if (error instanceof CloudNotConfiguredError) {
    await writeStatus({ state: 'disabled', checkedAt: Date.now(), error: error.message });
    return;
  }
  if (error instanceof CloudHttpError) {
    await writeStatus({ state: 'unhealthy', checkedAt: Date.now(), error: `${error.status} ${error.message}` });
    return;
  }
  await writeStatus({ state: 'unhealthy', checkedAt: Date.now(), error: errorMessage(error) });
}

export async function checkCloudHealth(config?: CloudConfig | null): Promise<CloudStatus> {
  const resolved = config ?? await readCloudConfig();
  if (!resolved?.enabled || !resolved.endpoint) {
    return writeStatus({ state: 'disabled', checkedAt: Date.now(), error: undefined });
  }

  try {
    const endpoint = normalizeEndpoint(resolved.endpoint);
    const client = new CloudClient(endpoint, '');
    const health = await client.health();

    if (resolved.token) {
      try {
        const token = await resolveToken(resolved);
        await new CloudClient(endpoint, token).ping();
      } catch (error) {
        if (error instanceof CloudAuthError || error instanceof CloudTokenError) {
          return writeStatus({ state: 'auth-error', checkedAt: Date.now(), latencyMs: health.latencyMs, error: error.message });
        }
        if (error instanceof VaultLockedError) {
          return writeStatus({ state: 'waiting-unlock', checkedAt: Date.now(), latencyMs: health.latencyMs });
        }
        // Token 校验失败不否定云端整体健康，交给同步时报错
      }
    }

    return writeStatus({
      state: 'healthy',
      checkedAt: Date.now(),
      latencyMs: health.latencyMs,
      error: undefined,
    });
  } catch (error) {
    await markFailure(error);
    return readStatus();
  }
}

export async function testCloudConnection(endpointInput: string, tokenInput?: string): Promise<{ latencyMs: number; revision?: number }> {
  const endpoint = normalizeEndpoint(endpointInput);
  const client = new CloudClient(endpoint, tokenInput ?? '');
  const health = await client.health();
  let revision: number | undefined;
  if (tokenInput) {
    const ping = await client.ping();
    revision = ping.revision;
  }
  return { latencyMs: health.latencyMs, revision };
}

async function doPushToCloud(): Promise<{ response: SyncPushResponse; summary: ApplySummary }> {
  const config = await readCloudConfig();
  if (!config?.enabled || !config.endpoint) throw new CloudNotConfiguredError();
  await ensureSecretsUnlocked();
  const token = await resolveToken(config);
  const endpoint = normalizeEndpoint(config.endpoint);

  await flushDirtyNow();
  const dirtyBefore = await readDirty();

  await writeStatus({ state: 'syncing', checkedAt: Date.now(), error: undefined });
  try {
    const client = new CloudClient(endpoint, token);
    await client.health();

    const snapshot = await buildLocalSnapshot();
    const currentIndex = indexFromSnapshot(snapshot);
    const baseline = await readBaseline();
    // 关闭持久化期间可能清空过本地：首次恢复同步不发送任何删除，
    // 也不根据旧基线推断删除，避免把本地清理传播到云端。
    const suppressDeletions = config.suppressDeletions === true;
    const tombstones = suppressDeletions
      ? emptyTombstones()
      : await buildTombstones(
        currentIndex,
        baseline?.index ?? null,
        baseline?.syncedAt ?? null,
      );

    const request: SyncPushRequest = {
      protocol: 1,
      clientId: config.clientId,
      baseRevision: baseline?.revision ?? 0,
      clientTime: Date.now(),
      snapshot,
      tombstones,
    };

    const response = await client.push(request);
    const summary = await withDirtyTrackingSuspended(
      () => applyRemoteSnapshot(response.snapshot, response.tombstones),
    );

    await writeBaseline({
      revision: response.revision,
      syncedAt: Date.now(),
      index: indexFromSnapshot(response.snapshot),
    });
    await pruneSyncedDeletions(request.clientTime);
    await flushDirtyNow();
    await clearDirty(dirtyBefore?.seq ?? 0);
    if (suppressDeletions) {
      await writeCloudConfig({ ...config, suppressDeletions: false });
    }
    await writeStatus({
      state: 'healthy',
      checkedAt: Date.now(),
      lastSyncAt: Date.now(),
      revision: response.revision,
      error: undefined,
    });
    return { response, summary };
  } catch (error) {
    await markFailure(error);
    throw error;
  }
}

let pushQueue: Promise<unknown> = Promise.resolve();

/** 串行化所有推送，避免设置页“立即同步”和后台调度并发写基线 */
function enqueuePush<T>(task: () => Promise<T>): Promise<T> {
  const run = pushQueue.then(task, task);
  pushQueue = run.then(() => undefined, () => undefined);
  return run;
}

export function pushToCloud(): Promise<{ response: SyncPushResponse; summary: ApplySummary }> {
  return enqueuePush(doPushToCloud);
}

/** 用本地快照镜像云端：本地记录刷新时间戳，云端独有记录写入墓碑 */
async function doOverwriteCloud(): Promise<{ response: SyncPushResponse; summary: ApplySummary }> {
  const config = await readCloudConfig();
  if (!config?.enabled || !config.endpoint) throw new CloudNotConfiguredError();
  await ensureSecretsUnlocked();
  const token = await resolveToken(config);
  const endpoint = normalizeEndpoint(config.endpoint);

  await flushDirtyNow();
  const dirtyBefore = await readDirty();

  await writeStatus({ state: 'syncing', checkedAt: Date.now(), error: undefined });
  try {
    const client = new CloudClient(endpoint, token);
    await client.health();
    const remote = await client.getState();

    const now = Date.now();
    const snapshot = await buildLocalSnapshot({ forceUpdatedAt: now });
    const currentIndex = indexFromSnapshot(snapshot);
    const remoteIndex = indexFromSnapshot(remote.snapshot);

    const tombstones = emptyTombstones();
    for (const table of SNAPSHOT_TABLES) {
      for (const id of Object.keys(remoteIndex[table])) {
        if (currentIndex[table][id] === undefined) tombstones[table][id] = now;
      }
    }
    const ledger = await buildTombstones(currentIndex, null, null);
    for (const table of SNAPSHOT_TABLES) {
      for (const [id, deletedAt] of Object.entries(ledger[table])) {
        tombstones[table][id] = Math.max(tombstones[table][id] ?? 0, deletedAt);
      }
    }

    const baseline = await readBaseline();
    const request: SyncPushRequest = {
      protocol: 1,
      clientId: config.clientId,
      baseRevision: baseline?.revision ?? remote.revision,
      clientTime: now,
      snapshot,
      tombstones,
    };

    const response = await client.push(request);
    const summary = await withDirtyTrackingSuspended(
      () => applyRemoteSnapshot(response.snapshot, response.tombstones),
    );

    await writeBaseline({
      revision: response.revision,
      syncedAt: Date.now(),
      index: indexFromSnapshot(response.snapshot),
    });
    await pruneSyncedDeletions(request.clientTime);
    await flushDirtyNow();
    await clearDirty(dirtyBefore?.seq ?? 0);
    await writeStatus({
      state: 'healthy',
      checkedAt: Date.now(),
      lastSyncAt: Date.now(),
      revision: response.revision,
      error: undefined,
    });
    return { response, summary };
  } catch (error) {
    await markFailure(error);
    throw error;
  }
}

export function overwriteCloud(): Promise<{ response: SyncPushResponse; summary: ApplySummary }> {
  return enqueuePush(doOverwriteCloud);
}

export async function restoreFromCloud(): Promise<{ revision: number; summary: ApplySummary }> {
  const config = await readCloudConfig();
  if (!config?.endpoint) throw new CloudNotConfiguredError();
  await ensureSecretsUnlocked();
  const token = await resolveToken(config);
  const endpoint = normalizeEndpoint(config.endpoint);

  await writeStatus({ state: 'syncing', checkedAt: Date.now(), error: undefined });
  try {
    const client = new CloudClient(endpoint, token);
    const state = await client.getState();
    const summary = await withDirtyTrackingSuspended(
      () => applyRemoteSnapshot(state.snapshot, state.tombstones),
    );
    await writeBaseline({
      revision: state.revision,
      syncedAt: Date.now(),
      index: indexFromSnapshot(state.snapshot),
    });
    // 恢复即新的同步基线，清掉恢复前的删除记录，避免下次推送误删刚恢复的数据
    await clearDeletions();
    await writeStatus({
      state: 'healthy',
      checkedAt: Date.now(),
      lastSyncAt: Date.now(),
      revision: state.revision,
      error: undefined,
    });
    return { revision: state.revision, summary };
  } catch (error) {
    await markFailure(error);
    throw error;
  }
}
