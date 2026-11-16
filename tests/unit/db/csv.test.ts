import { describe, it, expect } from 'vitest';
import { toCsv } from '../../../src/shared/db/csv';
import type { DbQueryOutcome } from '../../../src/shared/db/DbClient';

const result: DbQueryOutcome = {
  columns: [
    { name: 'id', ordinal: 1 },
    { name: 'name', ordinal: 2 },
  ],
  rows: [[1, 'alice'], [2, null]],
  rowCount: 2,
  truncated: false,
  elapsedMs: 3,
};

describe('toCsv', () => {
  it('writes a header and one line per row', () => {
    const csv = toCsv(result);
    expect(csv.replace(/^﻿/, '').split('\r\n')).toEqual(['id,name', '1,alice', '2,']);
  });

  it('starts with a BOM for excel', () => {
    expect(toCsv(result).charCodeAt(0)).toBe(0xfeff);
  });

  it('serializes binary cells as json', () => {
    const csv = toCsv({
      ...result,
      rows: [[1, { __bin: true, bytes: 3, base64: 'AAA' }]],
    });
    expect(csv).toContain('{"__bin":true,"bytes":3,"base64":"AAA"}');
  });

  it('returns an empty string without a result', () => {
    expect(toCsv(null)).toBe('');
  });
});
