import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { logArb, logsArb, WINDOW_DAYS, WINDOW_START } from '@/engine/arbitraries';
import { addDays } from '@/engine/dates';
import { replay } from '@/engine/replay';
import type { CharacterState } from '@/engine/types';
import { buildCoachInput } from './sanitize';
import type { LogType } from './sanitize';
import { coachInputSchema } from './schemas';

const KEYS = ['event', 'level', 'streak', 'timeBucket', 'tone', 'topStat', 'xpGained'];
const asOf = { localDate: addDays(WINDOW_START, WINDOW_DAYS + 2) };

function check(state: ReturnType<typeof buildCoachInput>) {
  expect(Object.keys(state).sort()).toEqual(KEYS);
  expect(coachInputSchema.safeParse(state).success).toBe(true);
}

describe('sanitizer properties (property 9)', () => {
  it('replayed states always give a valid CoachInput', () => {
    fc.assert(
      fc.property(logsArb(25), logArb('zz-new'), fc.integer({ min: 0, max: 1439 }), (logs, next, minutes) => {
        const before = replay(logs, asOf);
        const after = replay([...logs, next], asOf);
        const input = buildCoachInput({
          before,
          after,
          logType: next.type,
          logDate: next.localDate,
          localMinutes: minutes,
        });
        check(input);
        expect(input.xpGained).toBe(Math.min(360, Math.max(0, after.totalXp - before.totalXp)));
      }),
    );
  });

  it('raw states with junk numbers still give a valid CoachInput', () => {
    const junk = fc.oneof(
      fc.double(),
      fc.integer({ min: -1e9, max: 1e9 }),
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0),
    );
    const stat = fc.record({ xp: junk, value: junk });
    const rawState = fc.record({
      totalXp: junk,
      level: junk,
      xpIntoLevel: junk,
      xpForNext: junk,
      stats: fc.record({ strength: stat, endurance: stat, agility: stat, vitality: stat, recovery: stat }),
      streak: junk,
      streakAtRisk: fc.boolean(),
      xpByDate: fc.dictionary(fc.string({ maxLength: 12 }), junk, { maxKeys: 5 }),
      quests: fc.array(
        fc.record({ id: fc.constant('move20' as const), done: fc.boolean(), bonusAwarded: fc.boolean() }),
        { maxLength: 4 },
      ),
    }) as unknown as fc.Arbitrary<CharacterState>;
    const logType = fc.constantFrom<LogType[]>('move', 'eat', 'rest');
    fc.assert(
      fc.property(rawState, rawState, logType, junk, fc.string(), (before, after, type, minutes, logDate) => {
        const logType = type;
        check(buildCoachInput({ before, after, logType, logDate, localMinutes: minutes }));
      }),
      { numRuns: 500 },
    );
  });
});
