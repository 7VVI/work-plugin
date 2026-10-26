export const isWeb = __APP_TARGET__ === 'web';

type StorageKeys = string | string[] | Record<string, unknown> | null | undefined;

export interface StorageArea {
  get(keys?: StorageKeys): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys?: string | string[]): Promise<void>;
}

function chromeArea(area: {
  get(keys?: StorageKeys): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys?: string | string[]): Promise<void>;
}): StorageArea {
  return {
    get: (keys) => area.get(keys),
    set: (items) => area.set(items),
    remove: (keys) => area.remove(keys),
  };
}

function notifyWebStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('dock-storage', { detail: { key, value } }));
}

function localStorageArea(prefix: string): StorageArea {
  const fullKey = (key: string) => `${prefix}${key}`;
  return {
    async get(keys) {
      const result: Record<string, unknown> = {};
      if (!keys) return result;
      if (typeof keys === 'string' || Array.isArray(keys)) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          const raw = localStorage.getItem(fullKey(key));
          if (raw !== null) {
            try { result[key] = JSON.parse(raw); } catch { result[key] = raw; }
          }
        }
        return result;
      }
      for (const [key, fallback] of Object.entries(keys)) {
        const raw = localStorage.getItem(fullKey(key));
        if (raw === null) {
          result[key] = fallback;
        } else {
          try { result[key] = JSON.parse(raw); } catch { result[key] = raw; }
        }
      }
      return result;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        localStorage.setItem(fullKey(key), JSON.stringify(value));
        notifyWebStorage(key, value);
      }
    },
    async remove(keys) {
      if (!keys) return;
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        localStorage.removeItem(fullKey(key));
        notifyWebStorage(key, undefined);
      }
    },
  };
}

function memoryArea(): StorageArea {
  const map = new Map<string, unknown>();
  return {
    async get(keys) {
      const result: Record<string, unknown> = {};
      if (!keys) return result;
      if (typeof keys === 'string' || Array.isArray(keys)) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          if (map.has(key)) result[key] = map.get(key);
        }
        return result;
      }
      for (const [key, fallback] of Object.entries(keys)) {
        result[key] = map.has(key) ? map.get(key) : fallback;
      }
      return result;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) map.set(key, value);
    },
    async remove(keys) {
      if (!keys) return;
      for (const key of Array.isArray(keys) ? keys : [keys]) map.delete(key);
    },
  };
}

const chromeApi = (globalThis as { chrome?: any }).chrome;

export const platform = {
  isWeb,
  storage: {
    sync: isWeb ? localStorageArea('dock.sync.') : chromeArea(chromeApi.storage.sync),
    local: isWeb ? localStorageArea('dock.local.') : chromeArea(chromeApi.storage.local),
    session: isWeb ? memoryArea() : chromeArea(chromeApi.storage.session),
    onChanged(listener: (key: string, value: unknown) => void): () => void {
      if (isWeb) {
        const handler = (event: Event) => {
          const detail = (event as CustomEvent<{ key: string; value: unknown }>).detail;
          listener(detail.key, detail.value);
        };
        window.addEventListener('dock-storage', handler);
        return () => window.removeEventListener('dock-storage', handler);
      }
      const handler = (
        changes: Record<string, { newValue?: unknown }>,
        areaName: string,
      ) => {
        if (areaName !== 'local') return;
        for (const key of Object.keys(changes)) listener(key, changes[key].newValue);
      };
      chromeApi.storage.onChanged.addListener(handler);
      return () => chromeApi.storage.onChanged.removeListener(handler);
    },
  },
  runtime: {
    sendMessage: isWeb
      ? async (_message: unknown) => ({})
      : (message: unknown) => chromeApi.runtime.sendMessage(message) as Promise<unknown>,
    getURL: (path: string) => isWeb ? `/${path}` : chromeApi.runtime.getURL(path) as string,
  },
  openTab(url: string): void {
    if (isWeb) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      chromeApi.tabs.create({ url });
    }
  },
};
