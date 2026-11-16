import { describe, it, expect } from 'vitest';
import { applyPaging, buildUpdateSql, normalizeCell, trimSemicolon, useDatabaseSql } from '../src/db/drivers/shared';import { assertSafeIdentifier } from '../src/db/drivers/sqlite';
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

  it('pages SQL Server with OFFSET/FETCH (no LIMIT in T-SQL)', () => {
    const paged = applyPaging('SELECT * FROM users ORDER BY id', 100, 200, 'mssql');
    expect(paged.sql).toBe('SELECT * FROM users ORDER BY id OFFSET 200 ROWS FETCH NEXT 101 ROWS ONLY');
    // 没有 ORDER BY 时要补一个，否则 T-SQL 不允许 OFFSET
    const unordered = applyPaging('SELECT * FROM users', 100, 0, 'mssql');
    expect(unordered.sql).toBe('SELECT * FROM users ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 101 ROWS ONLY');
    // 已经带 OFFSET/FETCH 就不再追加
    const manual = applyPaging('SELECT * FROM users ORDER BY id OFFSET 5 ROWS', 100, 0, 'mssql');
    expect(manual.wrapped).toBe(false);
  });

  it('builds a parameterized UPDATE for cell editing', () => {
    const update = {
      schema: 'cors_3.0.0',
      table: 'orders',
      column: 'status',
      value: 'paid',
      keys: [{ column: 'id', value: '7' }],
    };
    const pg = buildUpdateSql(update, 'postgres', index => `$${index + 1}`);
    expect(pg.sql).toBe('UPDATE "cors_3.0.0"."orders" SET "status" = $1 WHERE "id" = $2');
    expect(pg.values).toEqual(['paid', '7']);

    const mysql = buildUpdateSql(update, 'mysql', () => '?');
    expect(mysql.sql).toBe('UPDATE `cors_3.0.0`.`orders` SET `status` = ? WHERE `id` = ?');

    const mssql = buildUpdateSql(update, 'mssql', index => `@p${index}`);
    expect(mssql.sql).toBe('UPDATE [cors_3.0.0].[orders] SET [status] = @p0 WHERE [id] = @p1');

    const sqlite = buildUpdateSql({ ...update, schema: undefined }, 'sqlite', () => '?');
    expect(sqlite.sql).toBe('UPDATE "orders" SET "status" = ? WHERE "id" = ?');
  });

  it('keeps cell values out of the SQL text', () => {
    const injected = buildUpdateSql({
      schema: 'db',
      table: 't',
      column: 'c',
      value: "'; DROP TABLE t; --",
      keys: [{ column: 'id', value: '1' }],
    }, 'postgres', index => `$${index + 1}`);
    expect(injected.sql).not.toContain('DROP TABLE');
    expect(injected.values[0]).toBe("'; DROP TABLE t; --");
  });

  it('escapes identifiers in the UPDATE statement', () => {
    const evil = buildUpdateSql({
      table: 't" ; DROP TABLE x; --',
      column: 'c',
      value: '1',
      keys: [{ column: 'id', value: '1' }],
    }, 'postgres', index => `$${index + 1}`);
    expect(evil.sql).toBe('UPDATE "t"" ; DROP TABLE x; --" SET "c" = $1 WHERE "id" = $2');
  });

  it('rejects unsafe sqlite identifiers', () => {
    expect(assertSafeIdentifier('users')).toBe('"users"');
    expect(() => assertSafeIdentifier('users; DROP TABLE x')).toThrowError();
    expect(() => assertSafeIdentifier('')).toThrowError();
  });

  it('builds the statement that switches the current database', () => {
    expect(useDatabaseSql('postgres', 'public')).toBe('SET search_path TO "public"');
    expect(useDatabaseSql('mysql', 'cors_3.0.0')).toBe('USE `cors_3.0.0`');
    expect(useDatabaseSql('mssql', 'cors')).toBe('USE [cors]');
    expect(useDatabaseSql('clickhouse', 'cors')).toBe('USE cors');
    // SQLite 只有单文件，没有可切换的库
    expect(useDatabaseSql('sqlite', 'main')).toBeNull();
    expect(useDatabaseSql('mysql', '  ')).toBeNull();
  });

  it('refuses database names that could break out of the statement', () => {
    expect(useDatabaseSql('mysql', 'a`; DROP TABLE x; --')).toBeNull();
    expect(useDatabaseSql('postgres', 'a"; DROP TABLE x; --')).toBeNull();
    expect(useDatabaseSql('mssql', 'a]; DROP TABLE x; --')).toBeNull();
    expect(useDatabaseSql('mysql', 'db; SELECT 1')).toBeNull();
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
