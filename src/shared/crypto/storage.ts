import { metaRepo } from '../db/repositories/metaRepo';
import { encrypt, decrypt } from './cipher';

const SALT_KEY = 'crypto.salt';
const VERIFIER_KEY = 'crypto.verifier';

export interface Verifier {
  iv: string;
  ciphertext: string;
}

export const cryptoStorage = {
  async getSalt(): Promise<string | undefined> {
    return metaRepo.get<string>(SALT_KEY);
  },

  async setSalt(salt: string): Promise<void> {
    await metaRepo.set(SALT_KEY, salt);
  },

  async setVerifier(key: CryptoKey, knownPlaintext: string): Promise<void> {
    const encrypted = await encrypt(knownPlaintext, key);
    await metaRepo.set(VERIFIER_KEY, encrypted as unknown as Verifier);
  },

  /** 在调用方事务内写入密钥材料，用于密码轮换的原子更新 */
  async writeKeyMaterial(salt: string, verifier: Verifier): Promise<void> {
    await metaRepo.set(SALT_KEY, salt);
    await metaRepo.set(VERIFIER_KEY, verifier);
  },

  async clearKeyMaterial(): Promise<void> {
    await metaRepo.remove(SALT_KEY);
    await metaRepo.remove(VERIFIER_KEY);
  },

  async verifyKey(key: CryptoKey, knownPlaintext: string): Promise<boolean> {
    const stored = await metaRepo.get<Verifier>(VERIFIER_KEY);
    if (!stored) return false;
    try {
      const decrypted = await decrypt(stored.iv, stored.ciphertext, key);
      return decrypted === knownPlaintext;
    } catch {
      return false;
    }
  },

  async clear(): Promise<void> {
    await this.clearKeyMaterial();
  },

  async hasMasterPassword(): Promise<boolean> {
    const salt = await this.getSalt();
    return !!salt;
  },
};
