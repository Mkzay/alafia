import { describe, expect, it } from 'vitest';
import { routeTargets, splitEvenly, statsForLog, statValue } from './stats';
import type { Log } from './types';

const base = { id: 'a', loggedAt: 0, localDate: '2026-11-14', localMinutes: 600 };
const move = (kind: 'cardio' | 'strength' | 'mobility' | 'sport'): Log => ({
  ...base,
  type: 'move',
  kind,
  minutes: 30,
  intensity: 'moderate',
});

describe('routing', () => {
  it('routes every log kind', () => {
    expect(routeTargets(move('cardio'))).toEqual(['endurance']);
    expect(routeTargets(move('strength'))).toEqual(['strength']);
    expect(routeTargets(move('mobility'))).toEqual(['agility']);
    expect(routeTargets(move('sport'))).toEqual(['endurance', 'agility']);
    expect(
      routeTargets({
        ...base,
        type: 'eat',
        slot: 'lunch',
        checks: { protein: true, veggies: true, fiberCarb: true, water: true },
      }),
    ).toEqual(['vitality']);
    expect(routeTargets({ ...base, type: 'rest', hours: 8, quality: 3 })).toEqual(['recovery']);
  });
});

describe('splitEvenly', () => {
  it('splits sport XP between endurance and agility', () => {
    expect(statsForLog(move('sport'), 45)).toEqual({ endurance: 23, agility: 22 });
  });
  it('gives remainders to the first stats in fixed order', () => {
    expect(splitEvenly(7, ['recovery', 'strength', 'agility'])).toEqual({
      strength: 3,
      agility: 2,
      recovery: 2,
    });
  });
  it('handles zero XP and no targets', () => {
    expect(splitEvenly(0, ['strength'])).toEqual({});
    expect(splitEvenly(10, [])).toEqual({});
  });
});

describe('statValue', () => {
  it('follows 1 + floor(sqrt(xp / 10))', () => {
    expect(statValue(0)).toBe(1);
    expect(statValue(9)).toBe(1);
    expect(statValue(10)).toBe(2);
    expect(statValue(40)).toBe(3);
    expect(statValue(1000)).toBe(11);
  });
});
