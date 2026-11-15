import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from './constants';
import { avatarTier, levelFromXp, levelProgress, xpForLevel } from './levels';

const levelArb = fc.integer({ min: 1, max: MAX_LEVEL });

describe('level properties', () => {
  it('xpForLevel is strictly increasing', () => {
    for (let l = 1; l < MAX_LEVEL; l++) {
      expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    }
  });

  it('levelFromXp inverts xpForLevel', () => {
    fc.assert(
      fc.property(levelArb, (l) => {
        expect(levelFromXp(xpForLevel(l))).toBe(l);
      }),
    );
  });

  it('levelFromXp is non-decreasing in XP', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(levelFromXp(lo)).toBeLessThanOrEqual(levelFromXp(hi));
        },
      ),
    );
  });

  it('progress is consistent with the level thresholds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500_000 }), (xp) => {
        const { level, xpIntoLevel, xpForNext } = levelProgress(xp);
        expect(xpForLevel(level) + xpIntoLevel).toBe(xp);
        if (level < MAX_LEVEL) expect(xpIntoLevel).toBeLessThan(xpForNext);
      }),
    );
  });

  it('avatarTier is 1 to 4 and never decreases', () => {
    let prev = 1;
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const tier = avatarTier(l);
      expect(tier).toBeGreaterThanOrEqual(1);
      expect(tier).toBeLessThanOrEqual(4);
      expect(tier).toBeGreaterThanOrEqual(prev);
      prev = tier;
    }
  });
});
