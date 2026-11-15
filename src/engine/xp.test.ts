import { describe, expect, it } from 'vitest';
import {
  advanceContext,
  applyCap,
  applyStreakMultiplier,
  baseXp,
  EMPTY_XP_CONTEXT,
} from './xp';
import type { EatLog, MoveLog, RestLog } from './types';

const base = { id: 'a', loggedAt: 0, localDate: '2026-11-14', localMinutes: 600 };

const move = (minutes: number, intensity: MoveLog['intensity'], kind: MoveLog['kind'] = 'cardio'): MoveLog => ({
  ...base,
  type: 'move',
  kind,
  minutes,
  intensity,
});

const eat = (n: number): EatLog => ({
  ...base,
  type: 'eat',
  slot: 'lunch',
  checks: {
    protein: n > 0,
    plants: n > 1,
    fiberCarb: n > 2,
    water: n > 3,
  },
});

const rest = (hours: number, quality: RestLog['quality'] = 3): RestLog => ({
  ...base,
  type: 'rest',
  hours,
  quality,
});

const ctx = EMPTY_XP_CONTEXT;

describe('move XP', () => {
  it('30 min moderate is 45', () => {
    expect(baseXp(move(30, 'moderate'), ctx)).toBe(45);
  });
  it('applies each intensity', () => {
    expect(baseXp(move(20, 'light'), ctx)).toBe(20);
    expect(baseXp(move(20, 'vigorous'), ctx)).toBe(40);
  });
  it('rounds half up', () => {
    expect(baseXp(move(5, 'moderate'), ctx)).toBe(8);
  });
  it('clamps minutes to 1..300', () => {
    expect(baseXp(move(0, 'light'), ctx)).toBe(1);
    expect(baseXp(move(999, 'light'), ctx)).toBe(300);
  });
});

describe('eat XP', () => {
  it('is 5 plus 10 per check, up to 45', () => {
    expect([0, 1, 2, 3, 4].map((n) => baseXp(eat(n), ctx))).toEqual([5, 15, 25, 35, 45]);
  });
  it('awards XP for the first 5 Eat logs only', () => {
    let c = ctx;
    const awarded: number[] = [];
    for (let i = 0; i < 6; i++) {
      awarded.push(baseXp(eat(4), c));
      c = advanceContext(c, eat(4));
    }
    expect(awarded).toEqual([45, 45, 45, 45, 45, 0]);
  });
});

describe('rest XP', () => {
  it('uses the hour bands', () => {
    const xp = (h: number) => baseXp(rest(h), ctx);
    expect(xp(5.5)).toBe(10);
    expect(xp(6)).toBe(25);
    expect(xp(6.5)).toBe(25);
    expect(xp(7)).toBe(40);
    expect(xp(9)).toBe(40);
    expect(xp(9.5)).toBe(25);
    expect(xp(10)).toBe(25);
    expect(xp(10.5)).toBe(10);
    expect(xp(0)).toBe(10);
    expect(xp(14)).toBe(10);
  });
  it('adds the quality bonus', () => {
    const xp = (q: RestLog['quality']) => baseXp(rest(8, q), ctx);
    const qualities: RestLog['quality'][] = [1, 2, 3, 4, 5];
    expect(qualities.map(xp)).toEqual([40, 40, 40, 45, 50]);
  });
  it('awards only the first Rest log of the day', () => {
    const first = baseXp(rest(8), ctx);
    const second = baseXp(rest(8), advanceContext(ctx, rest(8)));
    expect([first, second]).toEqual([40, 0]);
  });
});

describe('streak multiplier', () => {
  it('scales by 2 percent per day up to 7', () => {
    expect(applyStreakMultiplier(100, 0)).toBe(100);
    expect(applyStreakMultiplier(100, 1)).toBe(102);
    expect(applyStreakMultiplier(100, 7)).toBe(114);
    expect(applyStreakMultiplier(100, 10)).toBe(114);
  });
  it('returns integers', () => {
    expect(Number.isInteger(applyStreakMultiplier(45, 3))).toBe(true);
  });
  it('ignores negative streaks', () => {
    expect(applyStreakMultiplier(50, -3)).toBe(50);
  });
});

describe('daily cap', () => {
  it('passes XP under the cap', () => {
    expect(applyCap(50, 100)).toBe(50);
  });
  it('trims XP that crosses the cap', () => {
    expect(applyCap(50, 280)).toBe(20);
  });
  it('awards 0 once the cap is reached', () => {
    expect(applyCap(50, 300)).toBe(0);
  });
});
