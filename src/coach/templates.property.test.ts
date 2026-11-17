import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { pickTemplate, renderTemplate, TEMPLATE_LINES } from './templates';
import { COACH_EVENTS, COACH_STATS, TIME_BUCKETS, TONES } from './types';
import type { CoachInput } from './types';
import { validateCoachText } from './validate';

const inputArb: fc.Arbitrary<CoachInput> = fc.record({
  event: fc.constantFrom(...COACH_EVENTS),
  xpGained: fc.integer({ min: 0, max: 360 }),
  level: fc.integer({ min: 1, max: 99 }),
  streak: fc.integer({ min: 0, max: 999 }),
  topStat: fc.constantFrom(...COACH_STATS),
  timeBucket: fc.constantFrom(...TIME_BUCKETS),
  tone: fc.constantFrom(...TONES),
});

describe('template properties (COACH-10)', () => {
  it('no rendered line has braces, NaN, undefined or null', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        for (const event of COACH_EVENTS) {
          for (const line of TEMPLATE_LINES[event]) {
            const out = renderTemplate(line, { ...input, event });
            expect(out, out).not.toMatch(/[{}]|NaN|undefined|null/);
          }
        }
      }),
    );
  });

  it('never shows an XP amount at 0 XP and never writes "1 days"', () => {
    fc.assert(
      fc.property(inputArb, fc.string(), (input, seed) => {
        const zero = pickTemplate({ ...input, xpGained: 0 }, seed);
        expect(zero, zero).not.toMatch(/\b0 XP\b|\+0\b/);
        const one = pickTemplate({ ...input, streak: 1 }, seed);
        expect(one, one).not.toMatch(/\b1 days\b/);
      }),
    );
  });

  it('every pick passes the validator', () => {
    fc.assert(
      fc.property(inputArb, fc.string(), fc.option(fc.string(), { nil: undefined }), (input, seed, last) => {
        const out = pickTemplate(input, seed, last);
        expect(validateCoachText(out).ok, out).toBe(true);
      }),
    );
  });
});
