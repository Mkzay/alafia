import { describe, expect, it } from 'vitest';
import { avatarTier, levelFromXp, levelProgress, xpForLevel } from './levels';

describe('xpForLevel', () => {
  it('matches the reference values', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(60);
    expect(xpForLevel(3)).toBe(195);
    expect(xpForLevel(5)).toBe(633);
    expect(xpForLevel(10)).toBe(2514);
  });

  it('clamps out-of-range levels', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(500)).toBe(xpForLevel(99));
  });
});

describe('levelFromXp', () => {
  it('finds the level at and around thresholds', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(59)).toBe(1);
    expect(levelFromXp(60)).toBe(2);
    expect(levelFromXp(194)).toBe(2);
    expect(levelFromXp(195)).toBe(3);
    expect(levelFromXp(2514)).toBe(10);
  });

  it('caps at level 99 and treats negative XP as level 1', () => {
    expect(levelFromXp(xpForLevel(99))).toBe(99);
    expect(levelFromXp(10_000_000)).toBe(99);
    expect(levelFromXp(-5)).toBe(1);
  });

  it('puts a walk and a meal at level 2', () => {
    // 30 min moderate walk = 45 XP, plus a meal with 2 checks = 25 XP.
    expect(levelFromXp(45 + 25)).toBe(2);
  });
});

describe('levelProgress', () => {
  it('reports progress inside a level', () => {
    expect(levelProgress(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 60 });
    expect(levelProgress(70)).toEqual({ level: 2, xpIntoLevel: 10, xpForNext: 135 });
  });

  it('reports no next level at the maximum', () => {
    const top = xpForLevel(99);
    expect(levelProgress(top + 50)).toEqual({ level: 99, xpIntoLevel: 50, xpForNext: 0 });
  });
});

describe('avatarTier', () => {
  it('changes at levels 5, 10 and 20', () => {
    expect([1, 4].map(avatarTier)).toEqual([1, 1]);
    expect([5, 9].map(avatarTier)).toEqual([2, 2]);
    expect([10, 19].map(avatarTier)).toEqual([3, 3]);
    expect([20, 99].map(avatarTier)).toEqual([4, 4]);
  });
});
