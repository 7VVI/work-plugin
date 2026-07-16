// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveKey, generateSalt } from '../../../src/shared/crypto/masterKey';
import { encrypt, decrypt } from '../../../src/shared/crypto/cipher';

describe('cipher', () => {
  async function getKey() {
    return deriveKey('test-password', generateSalt());
  }

  it('encrypts plaintext to iv+ciphertext', async () => {
    const key = await getKey();
    const result = await encrypt('hello world', key);
    expect(result.iv).toBeTruthy();
    expect(result.ciphertext).toBeTruthy();
    expect(result.iv).not.toBe('hello world');
  });

  it('decrypts back to original plaintext', async () => {
    const key = await getKey();
    const encrypted = await encrypt('secret123', key);
    const decrypted = await decrypt(encrypted.iv, encrypted.ciphertext, key);
    expect(decrypted).toBe('secret123');
  });

  it('produces different IVs for same plaintext', async () => {
    const key = await getKey();
    const e1 = await encrypt('same', key);
    const e2 = await encrypt('same', key);
    expect(e1.iv).not.toBe(e2.iv);
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
  });

  it('fails decryption with wrong key', async () => {
    const key1 = await deriveKey('pass1', generateSalt());
    const key2 = await deriveKey('pass2', generateSalt());
    const encrypted = await encrypt('data', key1);
    await expect(decrypt(encrypted.iv, encrypted.ciphertext, key2)).rejects.toThrow();
  });
});
