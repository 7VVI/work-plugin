import { platform } from '../platform';
import { cryptoService } from '../services/cryptoService';
import { readCloudConfig, readBaseline, writeStatus } from './syncStorage';
import { checkCloudHealth, pushToCloud } from './syncService';
import { readDirty } from './dirtyTracker';
import { VaultLockedError } from './snapshotBuilder';

let started = false;
let stopFn: (() => void) | null = null;

export function startSyncScheduler(): () => void {
  if (platform.isWeb) return () => {};
  if (started && stopFn) return stopFn;
  started = true;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let healthTimer: ReturnType<typeof setInterval> | null = null;
  let syncing = false;
  let pending = false;

  const scheduleSync = (delay = 2500) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void runSync(false), delay);
  };

  const runSync = async (force: boolean) => {
    if (syncing) {
      pending = true;
      return;
    }

    const config = await readCloudConfig();
    if (!config?.enabled || !config.endpoint) {
      await writeStatus({ state: 'disabled', checkedAt: Date.now() });
      return;
    }

    if (!force) {
      const dirty = await readDirty();
      if (!dirty) {
        const baseline = await readBaseline();
        if (baseline) return;
      }
    }

    if (await cryptoService.isEnabled() && !cryptoService.isUnlocked()) {
      await writeStatus({ state: 'waiting-unlock', checkedAt: Date.now() });
      return;
    }

    syncing = true;
    pending = false;
    try {
      await pushToCloud();
    } catch (error) {
      if (!(error instanceof VaultLockedError)) {
        // 状态已由 syncService 写入，这里只保留重试机会
      }
    } finally {
      syncing = false;
      if (pending) {
        pending = false;
        scheduleSync(800);
      }
    }
  };

  const checkHealth = async () => {
    const config = await readCloudConfig();
    await checkCloudHealth(config);
    if (config?.enabled && config.endpoint) {
      const dirty = await readDirty();
      const baseline = await readBaseline();
      if (dirty || !baseline) scheduleSync(1200);
    }
  };

  const unsubscribe = platform.storage.onChanged((key) => {
    if (key === 'cloud.dirty') scheduleSync();
    if (key === 'cloud.config') void checkHealth();
  });

  void (async () => {
    const config = await readCloudConfig();
    if (config?.enabled && config.endpoint) await checkHealth();
  })();

  healthTimer = setInterval(() => void checkHealth(), 30_000);

  const stop = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (healthTimer) clearInterval(healthTimer);
    unsubscribe();
    started = false;
    stopFn = null;
  };
  stopFn = stop;
  return stop;
}
