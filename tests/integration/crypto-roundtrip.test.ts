// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/shared/db/schema';
import { cryptoService } from '../../src/shared/services/cryptoService';
import { accountService } from '../../src/shared/services/accountService';
import { systemRepo } from '../../src/shared/db/repositories/systemRepo';

describe('crypto round-trip', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('encrypts on write, decrypts on read', async () => {
    await cryptoService.setPassword('master123');
    const systemId = await systemRepo.create({ name: 'Test', url: 'https://test.com', environment: 'development', favorite: false, sort: 0 });
    const accountId = await accountService.create({
      systemId,
      role: 'admin',
      username: 'admin',
      password: 'secret_password',
      isDefault: true,
    });

    const account = await accountService.getDecrypted(accountId);
    expect(account.plainPassword).toBe('secret_password');
  });

  it('survives lock/unlock cycle', async () => {
    await cryptoService.setPassword('master123');
    const systemId = await systemRepo.create({ name: 'Test', url: 'https://test.com', environment: 'development', favorite: false, sort: 0 });
    const accountId = await accountService.create({
      systemId,
      role: 'admin',
      username: 'admin',
      password: 'secret_password',
      isDefault: true,
    });

    cryptoService.lock();
    expect(cryptoService.isUnlocked()).toBe(false);

    const ok = await cryptoService.unlock('master123');
    expect(ok).toBe(true);

    const account = await accountService.getDecrypted(accountId);
    expect(account.plainPassword).toBe('secret_password');
  });
});
