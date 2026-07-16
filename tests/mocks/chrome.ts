const memoryStore: Record<string, unknown> = {};

const chrome = {
  storage: {
    sync: {
      get: async (keys?: string | string[]) => {
        if (!keys) return { ...memoryStore };
        const result: Record<string, unknown> = {};
        const keyArr = Array.isArray(keys) ? keys : [keys];
        for (const k of keyArr) if (k in memoryStore) result[k] = memoryStore[k];
        return result;
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(memoryStore, items);
      },
    },
    session: {
      _store: {} as Record<string, unknown>,
      get: async (keys?: string | string[]) => {
        if (!keys) return { ...chrome.storage.session._store };
        const result: Record<string, unknown> = {};
        const keyArr = Array.isArray(keys) ? keys : [keys];
        for (const k of keyArr) if (k in chrome.storage.session._store) result[k] = chrome.storage.session._store[k];
        return result;
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(chrome.storage.session._store, items);
      },
      remove: async (keys: string | string[]) => {
        const keyArr = Array.isArray(keys) ? keys : [keys];
        for (const k of keyArr) delete chrome.storage.session._store[k];
      },
    },
  },
  runtime: {
    sendMessage: async (msg: unknown) => { console.log('mock sendMessage', msg); return {}; },
    onMessage: { addListener: () => {}, removeListener: () => {} },
    id: 'test-extension-id',
    getURL: (path: string) => `chrome-extension://test/${path}`,
    onInstalled: { addListener: () => {} },
  },
  tabs: {
    query: async () => [{ id: 1, url: 'https://example.com' }],
    create: async () => ({ id: 1 }),
    get: async (id: number) => ({ id, url: 'https://example.com' }),
    onUpdated: { addListener: () => {} },
    onActivated: { addListener: () => {} },
    sendMessage: async () => {},
  },
  contextMenus: {
    create: () => {},
    removeAll: () => {},
    onClicked: { addListener: () => {} },
  },
  action: {
    setBadgeText: async () => {},
    setBadgeBackgroundColor: async () => {},
    setTitle: async () => {},
  },
  commands: {
    onCommand: { addListener: () => {} },
  },
  alarms: {
    create: () => {},
    clear: () => {},
    onAlarm: { addListener: () => {} },
  },
  notifications: {
    create: async () => {},
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome = chrome;

export default chrome;
