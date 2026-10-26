import { cryptoStorage, cryptoSession, VERIFIER_PLAINTEXT } from '../crypto';
import type { Verifier } from '../crypto';
import { deriveKey, generateSalt, importRawKey } from '../crypto/masterKey';
import { encrypt, decrypt } from '../crypto/cipher';
import { db } from '../db/schema';
import { toPlain } from '../utils/plain';
import { platform } from '../platform';
import type { EncryptedField } from '../types/entities';

interface SecretPatches {
  accounts: Array<{ id: string; password: EncryptedField }>;
  servers: Array<{ id: string; password: EncryptedField; sshKey?: EncryptedField }>;
  middlewares: Array<{ id: string; password?: EncryptedField }>;
}

interface KeyMaterial {
  salt: string;
  key: CryptoKey;
  verifier: Verifier;
}

async function makeKeyMaterial(password: string): Promise<KeyMaterial> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const verifier = await encrypt(VERIFIER_PLAINTEXT, key);
  return { salt, key, verifier: verifier as Verifier };
}

async function decryptValue(field: EncryptedField | undefined, key: CryptoKey | null): Promise<string | undefined> {
  if (!field) return undefined;
  if (!field.__encrypted) return field.value;
  if (!key) throw new Error('Crypto locked - cannot re-encrypt');
  return decrypt(field.iv, field.ciphertext, key);
}

async function encryptValue(value: string, key: CryptoKey | null): Promise<EncryptedField> {
  if (!key) return { __encrypted: false, value };
  return { __encrypted: true, ...(await encrypt(value, key)) };
}

/**
 * 先读出全部敏感字段并在事务外完成解密/加密，避免在 Dexie 事务内 await WebCrypto。
 * 任何一个旧字段无法解密都会中断，绝不吞错写空密码。
 */
async function prepareSecretPatches(
  decryptKey: CryptoKey | null,
  encryptKey: CryptoKey | null,
): Promise<SecretPatches> {
  const [accounts, servers, middlewares] = await Promise.all([
    db.accounts.toArray(),
    db.servers.toArray(),
    db.middlewares.toArray(),
  ]);

  const patches: SecretPatches = { accounts: [], servers: [], middlewares: [] };

  for (const account of accounts) {
    const plain = (await decryptValue(account.password, decryptKey)) ?? '';
    patches.accounts.push({ id: account.id, password: await encryptValue(plain, encryptKey) });
  }

  for (const server of servers) {
    const plain = (await decryptValue(server.password, decryptKey)) ?? '';
    const sshKey = server.sshKey
      ? await encryptValue((await decryptValue(server.sshKey, decryptKey)) ?? '', encryptKey)
      : undefined;
    patches.servers.push({ id: server.id, password: await encryptValue(plain, encryptKey), sshKey });
  }

  for (const middleware of middlewares) {
    const plain = await decryptValue(middleware.password, decryptKey);
    patches.middlewares.push({
      id: middleware.id,
      password: plain === undefined ? undefined : await encryptValue(plain, encryptKey),
    });
  }

  return patches;
}

async function applySecretPatches(patches: SecretPatches, keyMaterial: KeyMaterial | null): Promise<void> {
  await db.transaction('rw', db.accounts, db.servers, db.middlewares, db.meta, async () => {
    for (const patch of patches.accounts) {
      await db.accounts.update(patch.id, toPlain({ password: patch.password }));
    }
    for (const patch of patches.servers) {
      await db.servers.update(patch.id, toPlain({ password: patch.password, sshKey: patch.sshKey }));
    }
    for (const patch of patches.middlewares) {
      await db.middlewares.update(patch.id, toPlain({ password: patch.password }));
    }
    if (keyMaterial) {
      await cryptoStorage.writeKeyMaterial(keyMaterial.salt, keyMaterial.verifier);
    } else {
      await cryptoStorage.clearKeyMaterial();
    }
  });
}

export const cryptoService = {
  async isEnabled(): Promise<boolean> {
    return cryptoStorage.hasMasterPassword();
  },

  isUnlocked(): boolean {
    return cryptoSession.isUnlocked();
  },

  async setPassword(password: string): Promise<void> {
    const previousKey = cryptoSession.getKey();
    const material = await makeKeyMaterial(password);
    const patches = await prepareSecretPatches(previousKey, material.key);
    await applySecretPatches(patches, material);
    cryptoSession.setKey(material.key);
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
    platform.runtime.sendMessage({ type: 'LOCK_CRYPTO' }).catch(() => {});
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
    const oldSalt = await cryptoStorage.getSalt();
    if (!oldSalt) throw new Error('Master password not set');
    const oldKey = await deriveKey(oldPassword, oldSalt);
    if (!(await cryptoStorage.verifyKey(oldKey, VERIFIER_PLAINTEXT))) {
      throw new Error('Old password incorrect');
    }

    const material = await makeKeyMaterial(newPassword);
    const patches = await prepareSecretPatches(oldKey, material.key);
    await applySecretPatches(patches, material);
    cryptoSession.setKey(material.key);
    await cryptoSession.syncToBackground();
  },

  async disablePassword(password: string): Promise<void> {
    const oldSalt = await cryptoStorage.getSalt();
    if (oldSalt) {
      const oldKey = await deriveKey(password, oldSalt);
      if (!(await cryptoStorage.verifyKey(oldKey, VERIFIER_PLAINTEXT))) {
        throw new Error('Password incorrect');
      }
      const patches = await prepareSecretPatches(oldKey, null);
      await applySecretPatches(patches, null);
    }
    this.lock();
  },

  async setKeyFromBackground(rawKey: ArrayBuffer): Promise<void> {
    const key = await importRawKey(rawKey);
    cryptoSession.setKey(key);
  },
};
