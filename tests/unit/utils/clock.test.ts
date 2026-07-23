import { describe, it, expect } from 'vitest';
import { formatClockHHMMSS } from '../../../src/shared/utils/clock';

describe('formatClockHHMMSS', () => {
  it('pads hours, minutes, seconds to two digits', () => {
    expect(formatClockHHMMSS(new Date(2026, 0, 1, 9, 5, 3))).toBe('09:05:03');
  });
  it('formats midnight and end-of-day', () => {
    expect(formatClockHHMMSS(new Date(2026, 0, 1, 0, 0, 0))).toBe('00:00:00');
    expect(formatClockHHMMSS(new Date(2026, 0, 1, 23, 59, 59))).toBe('23:59:59');
  });
});
