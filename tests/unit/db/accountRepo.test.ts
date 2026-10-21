import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { accountRepo } from '../../../src/shared/db/repositories/accountRepo';
import type { Account } from '../../../src/shared/types/entities';

function account(
  id: string,
  systemId: string,
  username: string,
  isDefault: boolean,
  createdAt: number,
): Account {
  return {
    id,
    systemId,
    role: 'admin',
    username,
    password: { __encrypted: false, value: `${username}-password` },
    isDefault,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('accountRepo', () => {
  beforeEach(async () => {
    await db.accounts.clear();
  });

  it('lists accounts by creation time', async () => {
    await db.accounts.bulkAdd([
      account('b', 's1', 'second', false, 2000),
      account('a', 's1', 'first', false, 1000),
    ]);

    const accounts = await accountRepo.bySystemId('s1');
    expect(accounts.map(a => a.username)).toEqual(['first', 'second']);
  });

  it('keeps only the earliest default when normalizing', async () => {
    await db.accounts.bulkAdd([
      account('a', 's1', 'first', false, 1000),
      account('b', 's1', 'second', true, 2000),
      account('c', 's1', 'third', true, 3000),
    ]);

    await accountRepo.normalizeDefault('s1');

    const accounts = await accountRepo.bySystemId('s1');
    expect(accounts.filter(a => a.isDefault).map(a => a.username)).toEqual(['second']);
  });

  it('assigns the first account as default when none is marked', async () => {
    await db.accounts.bulkAdd([
      account('a', 's1', 'first', false, 1000),
      account('b', 's1', 'second', false, 2000),
    ]);

    await accountRepo.normalizeDefault('s1');

    const accounts = await accountRepo.bySystemId('s1');
    expect(accounts.filter(a => a.isDefault).map(a => a.username)).toEqual(['first']);
  });

  it('promotes another account after deleting the default', async () => {
    await db.accounts.bulkAdd([
      account('a', 's1', 'first', true, 1000),
      account('b', 's1', 'second', false, 2000),
    ]);

    await accountRepo.delete('a');

    const accounts = await accountRepo.bySystemId('s1');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].username).toBe('second');
    expect(accounts[0].isDefault).toBe(true);
  });
});
