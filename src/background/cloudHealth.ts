import { normalizeEndpoint, readCloudConfig, readStatus, writeStatus } from '../shared/sync/syncStorage';

const ALARM = 'cloud-health';
const TIMEOUT_MS = 5000;

async function checkHealth(): Promise<void> {
  const config = await readCloudConfig();
  if (!config?.enabled || !config.endpoint) {
    await writeStatus({ state: 'disabled', checkedAt: Date.now(), error: undefined });
    return;
  }

  const current = await readStatus();
  const keepSyncState = ['syncing', 'waiting-unlock', 'auth-error'].includes(current.state);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const endpoint = normalizeEndpoint(config.endpoint);
    const response = await fetch(`${endpoint}/api/health`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
    });
    const ok = response.ok && (await response.json() as { ok?: boolean }).ok === true;
    await writeStatus({
      state: keepSyncState ? current.state : (ok ? 'healthy' : 'unhealthy'),
      checkedAt: Date.now(),
      error: ok ? undefined : '云端健康检查失败',
    });
  } catch {
    await writeStatus({
      state: keepSyncState ? current.state : 'unhealthy',
      checkedAt: Date.now(),
      error: '无法连接云端',
    });
  } finally {
    clearTimeout(timer);
  }
}

function schedule(): void {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}

export function setupCloudHealth(): void {
  chrome.runtime.onInstalled.addListener(() => schedule());
  chrome.runtime.onStartup.addListener(() => schedule());
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void checkHealth();
  });
  schedule();
  void checkHealth();
}
