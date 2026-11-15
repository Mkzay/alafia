import { describe, expect, it } from 'vitest';
import { activeDates, streakAsOf, streakEndingOn } from './streaks';
import type { Log } from './types';

const set = (...dates: string[]) => new Set(dates);

describe('streakEndingOn', () => {
  it('counts consecutive days', () => {
    const a = set('2026-11-12', '2026-11-13', '2026-11-14');
    expect(streakEndingOn(a, '2026-11-14')).toBe(3);
    expect(streakEndingOn(a, '2026-11-13')).toBe(2);
    expect(streakEndingOn(a, '2026-11-15')).toBe(0);
  });
  it('stops at a gap', () => {
    const a = set('2026-11-10', '2026-11-12', '2026-11-13');
    expect(streakEndingOn(a, '2026-11-13')).toBe(2);
  });
  it('crosses a month boundary', () => {
    const a = set('2026-10-31', '2026-11-01');
    expect(streakEndingOn(a, '2026-11-01')).toBe(2);
  });
});

describe('streakAsOf', () => {
  const a = set('2026-11-12', '2026-11-13');
  it('is active when today has a log', () => {
    expect(streakAsOf(set('2026-11-13', '2026-11-14'), '2026-11-14')).toEqual({
      streak: 2,
      atRisk: false,
    });
  });
  it('is at risk when only yesterday is active', () => {
    expect(streakAsOf(a, '2026-11-14')).toEqual({ streak: 2, atRisk: true });
  });
  it('resets after a full empty day', () => {
    expect(streakAsOf(a, '2026-11-15')).toEqual({ streak: 0, atRisk: false });
  });
  it('is 0 with no logs', () => {
    expect(streakAsOf(set(), '2026-11-15')).toEqual({ streak: 0, atRisk: false });
  });
});

describe('activeDates', () => {
  it('collects distinct local dates', () => {
    const logs = [
      { id: '1', localDate: '2026-11-14' },
      { id: '2', localDate: '2026-11-14' },
      { id: '3', localDate: '2026-11-15' },
    ] as Log[];
    expect([...activeDates(logs)].sort()).toEqual(['2026-11-14', '2026-11-15']);
  });
});
