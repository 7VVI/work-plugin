import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const AAD = Buffer.from('dock-cloud-state-v1', 'utf8');
const HKDF_SALT = Buffer.from('dock-cloud-v1', 'utf8');
const HKDF_INFO = Buffer.from('state-encryption', 'utf8');

export interface EncryptedState {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
  keyId: string;
}

export function deriveDataKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), HKDF_SALT, HKDF_INFO, 32));
}

export function keyId(key: Buffer): string {
  return createHash('sha256').update(key).digest().subarray(0, 8).toString('hex');
}

export function encryptState(plaintext: string, key: Buffer): EncryptedState {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext, keyId: keyId(key) };
}

export function decryptState(encrypted: Pick<EncryptedState, 'iv' | 'tag' | 'ciphertext'>, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, encrypted.iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(encrypted.tag);
  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]).toString('utf8');
}

export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a, 'utf8').digest();
  const right = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(left, right);
}

export function authEpoch(dataKey: Buffer, adminSecret: string): string {
  return createHmac('sha256', dataKey).update(`auth-epoch|${adminSecret}`).digest('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}
