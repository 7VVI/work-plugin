// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { cryptoService } from '../../../src/shared/services/cryptoService';
import { cryptoSession } from '../../../src/shared/crypto/session';

describe('cryptoService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    cryptoSession.lock();
  });

  it('reports disabled when no master password set', async () => {
    expect(await cryptoService.isEnabled()).toBe(false);
  });

  it('sets up master password and unlocks', async () => {
    await cryptoService.setPassword('mysecret');
    expect(await cryptoService.isEnabled()).toBe(true);
    expect(cryptoService.isUnlocked()).toBe(true);
  });

  it('unlocks with correct password', async () => {
    await cryptoService.setPassword('mysecret');
    cryptoSession.lock();
    expect(cryptoService.isUnlocked()).toBe(false);
    const ok = await cryptoService.unlock('mysecret');
    expect(ok).toBe(true);
    expect(cryptoService.isUnlocked()).toBe(true);
  });

  it('rejects wrong password on unlock', async () => {
    await cryptoService.setPassword('mysecret');
    cryptoSession.lock();
    const ok = await cryptoService.unlock('wrong');
    expect(ok).toBe(false);
    expect(cryptoService.isUnlocked()).toBe(false);
  });

  it('encrypts and decrypts fields when enabled', async () => {
    await cryptoService.setPassword('mysecret');
    const encrypted = await cryptoService.encryptField('password123');
    expect(encrypted.__encrypted).toBe(true);
    if (encrypted.__encrypted) {
      expect(encrypted.ciphertext).not.toBe('password123');
    }
    const decrypted = await cryptoService.decryptField(encrypted);
    expect(decrypted).toBe('password123');
  });

  it('stores plaintext when disabled', async () => {
    const result = await cryptoService.encryptField('password123');
    expect(result.__encrypted).toBe(false);
    if (!result.__encrypted) {
      expect(result.value).toBe('password123');
    }
    const decrypted = await cryptoService.decryptField(result);
    expect(decrypted).toBe('password123');
  });
});
