import { exportRawKey } from './masterKey';
import { platform } from '../platform';

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
    if (minutes <= 0) {
      if (this.lockTimer) {
        clearInterval(this.lockTimer);
        this.lockTimer = null;
      }
      return;
    }
    this.lastActivityAt = Date.now();
    this.startLockTimer();
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
    await platform.runtime.sendMessage({ type: 'CRYPTO_KEY_SYNC', keyBytes: raw });
  }

  private startLockTimer(): void {
    if (this.lockTimer) clearInterval(this.lockTimer);
    if (this.autoLockMinutes <= 0) {
      this.lockTimer = null;
      return;
    }
    this.lockTimer = setInterval(() => {
      if (this.autoLockMinutes <= 0) return;
      const idleMs = Date.now() - this.lastActivityAt;
      if (idleMs >= this.autoLockMinutes * 60 * 1000) {
        this.lock();
      }
    }, 30_000);
  }
}

export const cryptoSession = new CryptoSession();
export { VERIFIER_PLAINTEXT };
