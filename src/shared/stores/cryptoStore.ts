import { defineStore } from 'pinia';
import { ref } from 'vue';
import { cryptoService } from '../services/cryptoService';
import { cryptoSession } from '../crypto/session';

export const useCryptoStore = defineStore('crypto', () => {
  const enabled = ref(false);
  const unlocked = ref(false);
  const error = ref<string | null>(null);

  async function checkStatus() {
    enabled.value = await cryptoService.isEnabled();
    unlocked.value = cryptoService.isUnlocked();
  }

  async function setup(password: string) {
    try {
      await cryptoService.setPassword(password);
      enabled.value = true;
      unlocked.value = true;
      error.value = null;
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  async function unlock(password: string): Promise<boolean> {
    const ok = await cryptoService.unlock(password);
    unlocked.value = ok;
    error.value = ok ? null : '密码错误';
    return ok;
  }

  function lock() {
    cryptoService.lock();
    unlocked.value = false;
  }

  async function changePassword(oldPwd: string, newPwd: string) {
    await cryptoService.changePassword(oldPwd, newPwd);
  }

  async function disablePassword(password: string) {
    await cryptoService.disablePassword(password);
    enabled.value = false;
    unlocked.value = false;
  }

  cryptoSession.onLock(() => { unlocked.value = false; });

  return { enabled, unlocked, error, checkStatus, setup, unlock, lock, changePassword, disablePassword };
});
