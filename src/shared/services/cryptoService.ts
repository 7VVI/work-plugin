import { cryptoStorage, cryptoSession, VERIFIER_PLAINTEXT } from '../crypto';
import { deriveKey, generateSalt, importRawKey } from '../crypto/masterKey';
import { encrypt, decrypt } from '../crypto/cipher';
import type { EncryptedField } from '../types/entities';

export const cryptoService = {
  async isEnabled(): Promise<boolean> {
    return cryptoStorage.hasMasterPassword();
  },

  isUnlocked(): boolean {
    return cryptoSession.isUnlocked();
  },

  async setPassword(password: string): Promise<void> {
    const salt = generateSalt();
    await cryptoStorage.setSalt(salt);
    const key = await deriveKey(password, salt);
    await cryptoStorage.setVerifier(key, VERIFIER_PLAINTEXT);
    cryptoSession.setKey(key);
    await cryptoSession.syncToBackground();
  },

  async unlock(password: string): Promise<boolean> {
    const salt = await cryptoStorage.getSalt();
    if (!salt) return false;
    const key = await deriveKey(password, salt);
    const ok = await cryptoStorage.verifyKey(key, VERIFIER_PLAINTEXT);
    if (ok) {
      cryptoSession.setKey(key);
      await cryptoSession.syncToBackground();
    }
    return ok;
  },

  lock(): void {
    cryptoSession.lock();
    chrome.runtime.sendMessage({ type: 'LOCK_CRYPTO' }).catch(() => {});
  },

  async encryptField(plaintext: string): Promise<EncryptedField> {
    const key = cryptoSession.getKey();
    if (!key) {
      return { __encrypted: false, value: plaintext };
    }
    cryptoSession.touchActivity();
    const result = await encrypt(plaintext, key);
    return { __encrypted: true, ...result };
  },

  async decryptField(field: EncryptedField): Promise<string> {
    if (!field.__encrypted) return field.value;
    const key = cryptoSession.getKey();
    if (!key) {
      throw new Error('Crypto locked - cannot decrypt');
    }
    cryptoSession.touchActivity();
    return decrypt(field.iv, field.ciphertext, key);
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const ok = await this.unlock(oldPassword);
    if (!ok) throw new Error('Old password incorrect');
    const newSalt = generateSalt();
    const newKey = await deriveKey(newPassword, newSalt);
    await cryptoStorage.setSalt(newSalt);
    await cryptoStorage.setVerifier(newKey, VERIFIER_PLAINTEXT);
    cryptoSession.setKey(newKey);
    await cryptoSession.syncToBackground();
  },

  async disablePassword(password: string): Promise<void> {
    const ok = await this.unlock(password);
    if (!ok) throw new Error('Password incorrect');
    this.lock();
    await cryptoStorage.clear();
  },

  async setKeyFromBackground(rawKey: ArrayBuffer): Promise<void> {
    const key = await importRawKey(rawKey);
    cryptoSession.setKey(key);
  },
};
