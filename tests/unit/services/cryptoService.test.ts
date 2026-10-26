// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { cryptoService } from '../../../src/shared/services/cryptoService';
import { cryptoSession } from '../../../src/shared/crypto/session';
import { accountRepo } from '../../../src/shared/db/repositories/accountRepo';
import { serverRepo } from '../../../src/shared/db/repositories/serverRepo';
import { middlewareRepo } from '../../../src/shared/db/repositories/middlewareRepo';

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

  it('re-encrypts existing secrets when changing the master password', async () => {
    await cryptoService.setPassword('mysecret');
    const accountId = await accountRepo.create({
      systemId: 's1', role: 'root', username: 'root',
      password: await cryptoService.encryptField('account-secret'),
      isDefault: true,
    });
    const serverId = await serverRepo.create({
      name: 'srv', ip: '10.0.0.1', sshPort: 22, username: 'root',
      password: await cryptoService.encryptField('server-secret'),
      sshKey: await cryptoService.encryptField('ssh-secret'),
      environment: 'development', favorite: false,
    });
    const middlewareId = await middlewareRepo.create({
      type: 'redis', name: 'cache', host: '10.0.0.2', port: 6379,
      username: 'default', password: await cryptoService.encryptField('redis-secret'),
      favorite: false,
    });

    await cryptoService.changePassword('mysecret', 'newsecret');
    cryptoSession.lock();

    expect(await cryptoService.unlock('mysecret')).toBe(false);
    expect(await cryptoService.unlock('newsecret')).toBe(true);

    const account = await accountRepo.byId(accountId);
    const server = await serverRepo.byId(serverId);
    const middleware = await middlewareRepo.byId(middlewareId);
    expect(await cryptoService.decryptField(account!.password)).toBe('account-secret');
    expect(await cryptoService.decryptField(server!.password)).toBe('server-secret');
    expect(await cryptoService.decryptField(server!.sshKey!)).toBe('ssh-secret');
    expect(await cryptoService.decryptField(middleware!.password!)).toBe('redis-secret');
  });

  it('decrypts secrets to plaintext when disabling the master password', async () => {
    await cryptoService.setPassword('mysecret');
    const accountId = await accountRepo.create({
      systemId: 's1', role: 'root', username: 'root',
      password: await cryptoService.encryptField('account-secret'),
      isDefault: true,
    });

    await cryptoService.disablePassword('mysecret');

    expect(await cryptoService.isEnabled()).toBe(false);
    const account = await accountRepo.byId(accountId);
    expect(account?.password.__encrypted).toBe(false);
    if (account && !account.password.__encrypted) {
      expect(account.password.value).toBe('account-secret');
    }
  });
});
