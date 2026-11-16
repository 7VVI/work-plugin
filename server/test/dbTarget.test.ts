import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MiddlewareRec } from '@protocol/index';
import { resolveDbTarget, parseAllowedParams, dialectForType } from '../src/db/target';
import { DbError } from '../src/db/errors';

function rec(patch: Partial<MiddlewareRec> = {}): MiddlewareRec {
  return {
    id: 'mw_1',
    type: 'postgresql',
    name: 'db',
    host: '10.0.0.9',
    port: 5432,
    database: 'app',
    username: 'app',
    password: 'pwd',
    extra: { environment: 'development' },
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    tagIds: [],
    ...patch,
  };
}

describe('resolveDbTarget', () => {
  it('maps middleware types to dialects', () => {
    expect(dialectForType('mysql')).toBe('mysql');
    expect(dialectForType('postgresql')).toBe('postgres');
    expect(dialectForType('mssql')).toBe('mssql');
    expect(dialectForType('sqlite')).toBe('sqlite');
    expect(dialectForType('clickhouse')).toBe('clickhouse');
    expect(dialectForType('redis')).toBeNull();
  });

  it('rejects unsupported types', () => {
    expect(() => resolveDbTarget(rec({ type: 'redis' }), { sqliteRoots: [] }))
      .toThrowError(DbError);
  });

  it('takes the connection parameters from the snapshot record', () => {
    const target = resolveDbTarget(rec(), { sqliteRoots: [] });
    expect(target).toMatchObject({
      dialect: 'postgres',
      host: '10.0.0.9',
      port: 5432,
      database: 'app',
      username: 'app',
      password: 'pwd',
    });
  });

  it('rejects records without a username', () => {
    expect(() => resolveDbTarget(rec({ username: undefined }), { sqliteRoots: [] }))
      .toThrowError(/账号/);
  });

  it('rejects invalid ports', () => {
    expect(() => resolveDbTarget(rec({ port: 0 }), { sqliteRoots: [] })).toThrowError(DbError);
  });

  it('keeps sqlite files inside the allowed roots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dock-sqlite-'));
    try {
      const file = join(dir, 'app.db');
      const target = resolveDbTarget(
        rec({ type: 'sqlite', host: '', port: 0, extra: { filePath: file } }),
        { sqliteRoots: [dir] },
      );
      expect(target.dialect).toBe('sqlite');
      expect(target.file).toContain('app.db');

      expect(() => resolveDbTarget(
        rec({ type: 'sqlite', host: '', port: 0, extra: { filePath: join(dir, '..', 'outside.db') } }),
        { sqliteRoots: [dir] },
      )).toThrowError(/目录/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters extra params by the allowlist', () => {
    expect(parseAllowedParams('application_name=dock,evil=1,charset=utf8')).toEqual({
      application_name: 'dock',
      charset: 'utf8',
    });
    expect(parseAllowedParams('')).toEqual({});
    expect(parseAllowedParams(undefined)).toEqual({});
  });
});
