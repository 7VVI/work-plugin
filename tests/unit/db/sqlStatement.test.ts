import { describe, it, expect } from 'vitest';
import { splitSqlStatements, statementAtCursor } from '../../../src/shared/db/sqlStatement';

describe('splitSqlStatements', () => {
  it('splits on top level semicolons', () => {
    const sql = 'SELECT 1; SELECT 2;\nSELECT 3';
    const statements = splitSqlStatements(sql);
    expect(statements.map(item => item.text)).toEqual(['SELECT 1', 'SELECT 2', 'SELECT 3']);
  });

  it('ignores semicolons inside strings and comments', () => {
    const sql = `SELECT 'a;b' AS v -- ; c
FROM t; SELECT 2`;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0].text).toContain("'a;b'");
    expect(statements[1].text).toBe('SELECT 2');
  });

  it('ignores semicolons inside block comments', () => {
    const sql = 'SELECT 1 /* ; */ ; SELECT 2';
    expect(splitSqlStatements(sql).map(item => item.text)).toEqual(['SELECT 1 /* ; */', 'SELECT 2']);
  });

  it('ignores semicolons inside dollar quoted blocks', () => {
    const sql = `SELECT $$a;b$$ AS v; SELECT 2`;
    expect(splitSqlStatements(sql)).toHaveLength(2);
  });

  it('skips empty statements', () => {
    expect(splitSqlStatements(';;SELECT 1;;')).toHaveLength(1);
  });
});

describe('statementAtCursor', () => {
  const sql = 'SELECT 1;\nSELECT 2;\nSELECT 3';

  it('returns the statement containing the cursor', () => {
    expect(statementAtCursor(sql, 2)?.text).toBe('SELECT 1');
    expect(statementAtCursor(sql, 12)?.text).toBe('SELECT 2');
    expect(statementAtCursor(sql, 22)?.text).toBe('SELECT 3');
  });

  it('takes the next statement when the cursor sits between statements', () => {
    expect(statementAtCursor(sql, 9)?.text).toBe('SELECT 2');
  });

  it('falls back to the last statement', () => {
    expect(statementAtCursor(sql, 999)?.text).toBe('SELECT 3');
  });
});
