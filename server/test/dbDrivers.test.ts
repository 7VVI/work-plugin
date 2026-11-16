import { describe, it, expect } from 'vitest';
import { applyPaging, normalizeCell, trimSemicolon } from '../src/db/drivers/shared';import { assertSafeIdentifier } from '../src/db/drivers/sqlite';
import { PG_LIST_SQL, PG_DESCRIBE_SQL, PG_INDEX_SQL, PG_FOREIGN_KEY_SQL, PG_TRIGGER_SQL } from '../src/db/drivers/postgres';
import { MYSQL_LIST_SQL, MYSQL_DESCRIBE_SQL, MYSQL_INDEX_SQL, MYSQL_FOREIGN_KEY_SQL, MYSQL_TRIGGER_SQL } from '../src/db/drivers/mysql';
import { MSSQL_LIST_SQL, MSSQL_DESCRIBE_SQL, MSSQL_INDEX_SQL, MSSQL_FOREIGN_KEY_SQL, MSSQL_TRIGGER_SQL } from '../src/db/drivers/mssql';
import { CH_LIST_SQL, CH_DESCRIBE_SQL, CH_INDEX_SQL } from '../src/db/drivers/clickhouse';
import { statementKind, isReadOnlyStatement, assertSingleStatement, stripLiterals } from '../src/db/sqlGuard';

describe('db driver SQL construction', () => {
  it('wraps select statements with LIMIT/OFFSET for paging', () => {
    const first = applyPaging('SELECT * FROM users ORDER BY id', 100, 0);
    expect(first.wrapped).toBe(true);
    expect(first.sql).toContain('LIMIT 101');
    expect(first.sql).toContain('OFFSET 0');

    const second = applyPaging('SELECT * FROM users ORDER BY id', 100, 200);
    expect(second.sql).toContain('OFFSET 200');
  });

  it('leaves write statements untouched', () => {
    const write = applyPaging("INSERT INTO users (name) VALUES ('a')", 100, 0);
    expect(write.wrapped).toBe(false);
    expect(write.sql).toBe("INSERT INTO users (name) VALUES ('a')");
  });

  it('drops a trailing semicolon', () => {
    expect(trimSemicolon('SELECT 1;  ')).toBe('SELECT 1');
  });

  it('only wraps plain queries for paging', () => {
    // SHOW / DESCRIBE / EXPLAIN 不能放进 FROM 子句
    expect(applyPaging('SHOW TABLES', 10).wrapped).toBe(false);
    expect(applyPaging('SHOW TABLES', 10).sql).toBe('SHOW TABLES');
    expect(applyPaging('DESCRIBE users', 10).wrapped).toBe(false);
    expect(applyPaging('EXPLAIN SELECT 1', 10).wrapped).toBe(false);
    // 普通查询才会被包成子查询
    expect(applyPaging('SELECT 1', 10).wrapped).toBe(true);
    expect(applyPaging('WITH c AS (SELECT 1) SELECT * FROM c', 10, 0, 'sqlite').sql)
      .toBe('WITH c AS (SELECT 1) SELECT * FROM c LIMIT 11 OFFSET 0');
  });

  it('appends LIMIT/OFFSET for sqlite instead of wrapping (sqlite forbids WITH in a subquery)', () => {
    const cte = applyPaging('WITH c(x) AS (SELECT 1) SELECT x FROM c', 50, 10, 'sqlite');
    expect(cte.sql).toBe('WITH c(x) AS (SELECT 1) SELECT x FROM c LIMIT 51 OFFSET 10');
    expect(cte.sql).not.toContain('__dock_page');
  });

  it('keeps a user supplied LIMIT untouched', () => {
    const limited = applyPaging('SELECT * FROM users LIMIT 3', 50, 0, 'sqlite');
    expect(limited.sql).toBe('SELECT * FROM users LIMIT 3');
    expect(limited.wrapped).toBe(false);
  });

  it('cleans trailing comments before appending LIMIT', () => {
    const withComment = applyPaging('SELECT 1 -- note', 50, 0, 'sqlite');
    expect(withComment.sql).toBe('SELECT 1 LIMIT 51 OFFSET 0');
  });

  it('rejects unsafe sqlite identifiers', () => {
    expect(assertSafeIdentifier('users')).toBe('"users"');
    expect(() => assertSafeIdentifier('users; DROP TABLE x')).toThrowError();
    expect(() => assertSafeIdentifier('')).toThrowError();
  });

  it('keeps metadata queries parameterized', () => {
    expect(PG_LIST_SQL.tables).toContain('$1');
    expect(PG_DESCRIBE_SQL).toContain('$1');
    expect(PG_DESCRIBE_SQL).toContain('$2');
    expect(MYSQL_LIST_SQL.tables).toContain('?');
    expect(MSSQL_LIST_SQL.tables).toContain('@schema');
    expect(CH_LIST_SQL.tables).toContain('{database:String}');
  });

  it('never uses reserved words as column aliases', () => {
    // MySQL 8 / SQL Server 把 SCHEMA、PRIMARY、NULLABLE 当保留字，AS schema 会直接语法错误
    const reserved = /\bAS\s+(schema|primary|nullable|order|group|table|index|key|select)\b/i;
    const statements = [
      ...Object.values(PG_LIST_SQL),
      PG_DESCRIBE_SQL,
      PG_INDEX_SQL,
      PG_FOREIGN_KEY_SQL,
      PG_TRIGGER_SQL,
      ...Object.values(MYSQL_LIST_SQL),
      MYSQL_DESCRIBE_SQL,
      MYSQL_INDEX_SQL,
      MYSQL_FOREIGN_KEY_SQL,
      MYSQL_TRIGGER_SQL,
      ...Object.values(MSSQL_LIST_SQL),
      MSSQL_DESCRIBE_SQL,
      MSSQL_INDEX_SQL,
      MSSQL_FOREIGN_KEY_SQL,
      MSSQL_TRIGGER_SQL,
      ...Object.values(CH_LIST_SQL),
      CH_DESCRIBE_SQL,
      CH_INDEX_SQL,
    ];
    for (const sql of statements) {
      expect(sql).not.toMatch(reserved);
    }
  });

  it('normalizes cells: binary marker, null and long text', () => {
    expect(normalizeCell(null, 10)).toBeNull();
    expect(normalizeCell(123, 10)).toBe(123);
    expect(normalizeCell('abcdefghijk', 5)).toBe('abcde…[truncated]');
    const binary = normalizeCell(Buffer.alloc(4), 10);
    expect(binary).toMatchObject({ __bin: true, bytes: 4 });
  });
});

describe('sql guard', () => {
  it('classifies statements', () => {
    expect(statementKind('SELECT 1')).toBe('select');
    expect(statementKind('  with x as (select 1) select * from x')).toBe('select');
    expect(statementKind('INSERT INTO t VALUES (1)')).toBe('insert');
    expect(statementKind('UPDATE t SET a = 1')).toBe('update');
    expect(statementKind('DELETE FROM t')).toBe('delete');
    expect(statementKind('DROP TABLE t')).toBe('ddl');
  });

  it('treats only reads as read-only', () => {
    expect(isReadOnlyStatement('SELECT 1')).toBe(true);
    expect(isReadOnlyStatement('SHOW TABLES')).toBe(true);
    expect(isReadOnlyStatement('UPDATE t SET a = 1')).toBe(false);
    expect(isReadOnlyStatement('DELETE FROM t')).toBe(false);
  });

  it('rejects multi statement SQL but allows semicolons inside literals', () => {
    expect(() => assertSingleStatement('SELECT 1; SELECT 2')).toThrowError(/单条/);
    expect(() => assertSingleStatement("SELECT ';'")).not.toThrow();
    expect(() => assertSingleStatement('SELECT 1;')).not.toThrow();
    expect(stripLiterals("SELECT 'a;b'")).not.toContain(';');
  });
});
