import { describe, expect, it } from 'vitest';
import { addDays, compareDates } from './dates';

describe('addDays', () => {
  it('moves within a month', () => {
    expect(addDays('2026-11-14', 1)).toBe('2026-11-15');
    expect(addDays('2026-11-14', -1)).toBe('2026-11-13');
    expect(addDays('2026-11-14', 0)).toBe('2026-11-14');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('handles large offsets', () => {
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
  });
});

describe('compareDates', () => {
  it('orders dates', () => {
    expect(compareDates('2026-11-14', '2026-11-15')).toBeLessThan(0);
    expect(compareDates('2026-11-15', '2026-11-14')).toBeGreaterThan(0);
    expect(compareDates('2026-11-14', '2026-11-14')).toBe(0);
    expect(compareDates('2026-12-01', '2027-01-01')).toBeLessThan(0);
  });
});
