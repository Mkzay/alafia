import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { streakAsOf } from './streaks';

const START = '2026-11-01';
const dayIndex = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

describe('streak properties', () => {
  it('matches an index-based reference and stays within bounds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 20 }), { maxLength: 25 }),
        fc.integer({ min: 0, max: 22 }),
        (offsets, todayOffset) => {
          const dates = offsets.map((o) => addDays(START, o));
          const today = addDays(START, todayOffset);
          const eligible = new Set(dates.filter((d) => d <= today));
          const { streak, atRisk } = streakAsOf(eligible, today);

          const idx = new Set([...eligible].map(dayIndex));
          const t = dayIndex(today);
          const end = idx.has(t) ? t : idx.has(t - 1) ? t - 1 : null;
          let expected = 0;
          if (end !== null) while (idx.has(end - expected)) expected++;

          expect(streak).toBe(expected);
          expect(atRisk).toBe(!idx.has(t) && expected > 0);
          expect(streak).toBeGreaterThanOrEqual(0);
          expect(streak).toBeLessThanOrEqual(eligible.size);
        },
      ),
    );
  });
});
