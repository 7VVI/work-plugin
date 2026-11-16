import { describe, it, expect } from 'vitest';
import { quoteIdent, qualifiedTable } from '../../../src/shared/db/sql';

describe('sql identifier quoting', () => {
  it('uses backticks for mysql', () => {
    expect(quoteIdent('users', 'mysql')).toBe('`users`');
    expect(quoteIdent('cors_3.0.0', 'mysql')).toBe('`cors_3.0.0`');
    expect(quoteIdent('we`ird', 'mysql')).toBe('`we``ird`');
  });

  it('uses double quotes for other dialects', () => {
    expect(quoteIdent('users', 'postgres')).toBe('"users"');
    expect(quoteIdent('users', 'sqlite')).toBe('"users"');
    expect(quoteIdent('users', 'mssql')).toBe('"users"');
    expect(quoteIdent('users', 'clickhouse')).toBe('"users"');
    expect(quoteIdent('we"ird', 'postgres')).toBe('"we""ird"');
  });

  it('builds a qualified table name', () => {
    expect(qualifiedTable('cors_3.0.0', 'users', 'mysql')).toBe('`cors_3.0.0`.`users`');
    expect(qualifiedTable('public', 'users', 'postgres')).toBe('"public"."users"');
    expect(qualifiedTable(undefined, 'users', 'sqlite')).toBe('"users"');
  });
});
