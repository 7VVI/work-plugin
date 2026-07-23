import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Environment } from '../types/entities';

interface Prefs {
  theme: 'light' | 'dark' | 'system';
  autoLockMinutes: number;
  defaultEnvironment: Environment;
  popupLayout: 'compact' | 'expanded';
}

const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  autoLockMinutes: 5,
  defaultEnvironment: 'development',
  popupLayout: 'compact',
};

const STORAGE_KEY = 'prefs';

export const usePrefStore = defineStore('pref', () => {
  const theme = ref<Prefs['theme']>(DEFAULT_PREFS.theme);
  const autoLockMinutes = ref(DEFAULT_PREFS.autoLockMinutes);
  const defaultEnvironment = ref<Prefs['defaultEnvironment']>(DEFAULT_PREFS.defaultEnvironment);
  const popupLayout = ref<Prefs['popupLayout']>(DEFAULT_PREFS.popupLayout);
  const loaded = ref(false);

  async function load() {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as Partial<Prefs> | undefined;
    if (stored) {
      theme.value = stored.theme ?? DEFAULT_PREFS.theme;
      autoLockMinutes.value = stored.autoLockMinutes ?? DEFAULT_PREFS.autoLockMinutes;
      defaultEnvironment.value = stored.defaultEnvironment ?? DEFAULT_PREFS.defaultEnvironment;
      popupLayout.value = stored.popupLayout ?? DEFAULT_PREFS.popupLayout;
    }
    loaded.value = true;
  }

  async function persist() {
    const prefs: Prefs = { theme: theme.value, autoLockMinutes: autoLockMinutes.value, defaultEnvironment: defaultEnvironment.value, popupLayout: popupLayout.value };
    await chrome.storage.sync.set({ [STORAGE_KEY]: prefs });
  }

  watch([theme, autoLockMinutes, defaultEnvironment, popupLayout], () => {
    if (loaded.value) persist();
  });

  return { theme, autoLockMinutes, defaultEnvironment, popupLayout, loaded, load, persist };
});
