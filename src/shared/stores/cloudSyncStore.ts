import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { generateId } from '../utils/id';
import { platform } from '../platform';
import { cryptoService } from '../services/cryptoService';
import { VaultLockedError } from '../sync/snapshotBuilder';
import {
  checkCloudHealth,
  overwriteCloud,
  pushToCloud,
  restoreFromCloud,
  testCloudConnection,
} from '../sync/syncService';
import {
  normalizeEndpoint,
  readCloudConfig,
  readStatus,
  writeCloudConfig,
  writeStatus,
  type CloudConfig,
  type CloudStatus,
} from '../sync/syncStorage';

export const useCloudSyncStore = defineStore('cloudSync', () => {
  const config = ref<CloudConfig | null>(null);
  const status = ref<CloudStatus>({ state: 'disabled' });
  const loading = ref(false);
  const hasToken = computed(() => !!config.value?.token);

  let stopWatching: (() => void) | null = null;

  async function refresh() {
    config.value = await readCloudConfig();
    status.value = await readStatus();
  }

  async function load() {
    await refresh();
    if (!stopWatching) {
      stopWatching = platform.storage.onChanged((key) => {
        void (async () => {
          if (key === 'cloud.status') status.value = await readStatus();
          if (key === 'cloud.config') config.value = await readCloudConfig();
        })();
      });
    }
  }

  async function save(input: { enabled: boolean; endpoint: string; token?: string }) {
    const current = config.value;
    const enabling = input.enabled && !current?.enabled;
    const endpoint = input.endpoint.trim() ? normalizeEndpoint(input.endpoint) : '';
    let token = current?.token ?? null;

    if (input.token?.trim()) {
      if (await cryptoService.isEnabled() && !cryptoService.isUnlocked()) {
        throw new VaultLockedError();
      }
      token = await cryptoService.encryptField(input.token.trim());
    }

    if (input.enabled && (!endpoint || !token)) {
      throw new Error('启用云端同步需要填写云端地址和 API Token');
    }

    const next: CloudConfig = {
      enabled: input.enabled,
      endpoint,
      token,
      clientId: current?.clientId ?? generateId(),
      suppressDeletions: enabling ? true : (current?.suppressDeletions ?? false),
    };
    await writeCloudConfig(next);
    config.value = next;
    await writeStatus({ state: next.enabled ? 'unknown' : 'disabled', error: undefined });
    if (next.enabled) await checkCloudHealth(next);
    status.value = await readStatus();
    return next;
  }

  async function testConnection(endpoint: string, token?: string) {
    let actualToken = token?.trim();
    if (!actualToken && config.value?.token) {
      try {
        actualToken = await cryptoService.decryptField(config.value.token);
      } catch {
        throw new Error('云端 Token 无法解密，请重新输入');
      }
    }
    return testCloudConnection(endpoint, actualToken);
  }

  async function syncNow() {
    loading.value = true;
    try {
      const result = await pushToCloud();
      status.value = await readStatus();
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function restore() {
    loading.value = true;
    try {
      const result = await restoreFromCloud();
      status.value = await readStatus();
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function overwrite() {
    loading.value = true;
    try {
      const result = await overwriteCloud();
      status.value = await readStatus();
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function refreshHealth() {
    status.value = await checkCloudHealth(config.value);
  }

  return {
    config,
    status,
    loading,
    hasToken,
    load,
    refresh,
    save,
    testConnection,
    syncNow,
    restore,
    overwrite,
    refreshHealth,
  };
});
