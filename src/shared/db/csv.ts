import type { DbCell } from '@protocol/db';
import type { DbQueryOutcome } from './DbClient';

function escapeCell(value: DbCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** 结果集 → CSV 文本（含 BOM，Excel 打开中文不乱码） */
export function toCsv(result: DbQueryOutcome | null): string {
  if (!result) return '';
  const lines = [
    result.columns.map(col => escapeCell(col.name as DbCell)).join(','),
    ...result.rows.map(row => row.map(escapeCell).join(',')),
  ];
  return `﻿${lines.join('\r\n')}`;
}
