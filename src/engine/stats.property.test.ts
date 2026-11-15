import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { splitEvenly } from './stats';
import { STAT_ORDER } from './types';

describe('splitEvenly properties', () => {
  it('parts sum to the input and stay within targets', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.subarray([...STAT_ORDER], { minLength: 1 }),
        (xp, targets) => {
          const parts = splitEvenly(xp, targets);
          const values = Object.values(parts);
          expect(values.reduce((a, b) => a + b, 0)).toBe(xp);
          for (const key of Object.keys(parts)) {
            expect(targets).toContain(key);
          }
          if (values.length > 0) {
            expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
          }
        },
      ),
    );
  });
});
