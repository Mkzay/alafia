import { describe, expect, it } from 'vitest';
import { localParts, msUntilNextLocalMidnight } from './dates';

describe('localParts', () => {
  it('reads local date and minutes', () => {
    expect(localParts(new Date(2026, 10, 14, 9, 30))).toEqual({
      localDate: '2026-11-14',
      localMinutes: 570,
    });
  });
  it('handles the minute before and at midnight', () => {
    expect(localParts(new Date(2026, 10, 14, 23, 59))).toEqual({
      localDate: '2026-11-14',
      localMinutes: 1439,
    });
    expect(localParts(new Date(2026, 10, 15, 0, 0))).toEqual({
      localDate: '2026-11-15',
      localMinutes: 0,
    });
  });
  it('handles a month end and a year end', () => {
    expect(localParts(new Date(2026, 10, 30, 23, 0)).localDate).toBe('2026-11-30');
    expect(localParts(new Date(2026, 11, 31, 12, 0)).localDate).toBe('2026-12-31');
  });
});

describe('msUntilNextLocalMidnight', () => {
  it('counts to the next local midnight', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 14, 23, 59, 0, 0))).toBe(60_000);
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 14, 0, 0, 0, 0))).toBeGreaterThanOrEqual(
      23 * 3_600_000,
    );
  });
  it('is always positive, including exactly at midnight', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 15, 0, 0, 0, 0))).toBeGreaterThan(0);
  });
});
