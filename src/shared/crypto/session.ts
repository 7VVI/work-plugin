import { exportRawKey } from './masterKey';

const VERIFIER_PLAINTEXT = 'nav-portal-verifier-v1';

type LockHandler = () => void;

class CryptoSession {
  private key: CryptoKey | null = null;
  private lastActivityAt = 0;
  private lockTimer: ReturnType<typeof setInterval> | null = null;
  private autoLockMinutes = 5;
  private handlers: Set<LockHandler> = new Set();

  setKey(key: CryptoKey): void {
    this.key = key;
    this.lastActivityAt = Date.now();
    this.startLockTimer();
  }

  getKey(): CryptoKey | null {
    return this.key;
  }

  isUnlocked(): boolean {
    return this.key !== null;
  }

  touchActivity(): void {
    this.lastActivityAt = Date.now();
  }

  setAutoLockMinutes(minutes: number): void {
    this.autoLockMinutes = minutes;
  }

  onLock(handler: LockHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  lock(): void {
    this.key = null;
    if (this.lockTimer) {
      clearInterval(this.lockTimer);
      this.lockTimer = null;
    }
    this.handlers.forEach(h => h());
  }

  async syncToBackground(): Promise<void> {
    if (!this.key) return;
    const raw = await exportRawKey(this.key);
    await chrome.runtime.sendMessage({ type: 'CRYPTO_KEY_SYNC', keyBytes: raw });
  }

  private startLockTimer(): void {
    if (this.lockTimer) clearInterval(this.lockTimer);
    this.lockTimer = setInterval(() => {
      const idleMs = Date.now() - this.lastActivityAt;
      if (idleMs >= this.autoLockMinutes * 60 * 1000) {
        this.lock();
      }
    }, 30_000);
  }
}

export const cryptoSession = new CryptoSession();
export { VERIFIER_PLAINTEXT };
