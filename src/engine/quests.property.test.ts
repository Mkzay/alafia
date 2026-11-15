import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { questsForDate } from './quests';
import { QUEST_IDS } from './constants';

describe('quest properties', () => {
  it('returns 3 distinct quests for any date and is stable', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (offset) => {
        const date = addDays('2020-01-01', offset);
        const first = questsForDate(date);
        expect(first).toHaveLength(3);
        expect(new Set(first).size).toBe(3);
        first.forEach((q) => expect(QUEST_IDS).toContain(q));
        expect(questsForDate(date)).toEqual(first);
      }),
    );
  });
});
