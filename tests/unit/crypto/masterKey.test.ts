// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveKey, generateSalt, exportRawKey } from '../../../src/shared/crypto/masterKey';

describe('masterKey', () => {
  it('derives a CryptoKey from password + salt', async () => {
    const salt = generateSalt();
    const key = await deriveKey('mypassword', salt);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.type).toBe('secret');
    expect(key.extractable).toBe(true);
  });

  it('derives same key for same password + salt', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('mypassword', salt);
    const key2 = await deriveKey('mypassword', salt);
    const raw1 = await exportRawKey(key1);
    const raw2 = await exportRawKey(key2);
    expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2));
  });

  it('derives different keys for different passwords', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('password1', salt);
    const key2 = await deriveKey('password2', salt);
    const raw1 = await exportRawKey(key1);
    const raw2 = await exportRawKey(key2);
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
  });

  it('generates different salts each call', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).not.toBe(salt2);
  });

  it('generates 16-byte salts (base64 encoded)', () => {
    const salt = generateSalt();
    const decoded = atob(salt);
    expect(decoded.length).toBe(16);
  });
});
