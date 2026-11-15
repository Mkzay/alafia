import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { logArb, logsArb, makeLog, moveDraft, eatDraft, restDraft, WINDOW_DAYS, WINDOW_START } from './arbitraries';
import { DAILY_XP_CAP, QUESTS_PER_DAY, QUEST_BONUS_XP } from './constants';
import { addDays } from './dates';
import { replay, replayDetailed } from './replay';
import { STAT_ORDER } from './types';
import type { Log } from './types';

const asOf = { localDate: addDays(WINDOW_START, WINDOW_DAYS + 2) };
const maxDate = (logs: Log[]) => logs.reduce((m, l) => (l.localDate > m ? l.localDate : m), WINDOW_START);
const maxLoggedAt = (logs: Log[]) => logs.reduce((m, l) => Math.max(m, l.loggedAt), 0);

describe('replay properties', () => {
  it('is deterministic and ignores input order', () => {
    fc.assert(
      fc.property(
        logsArb().chain((logs) =>
          fc
            .shuffledSubarray(logs, { minLength: logs.length, maxLength: logs.length })
            .map((shuffled) => ({ logs, shuffled })),
        ),
        ({ logs, shuffled }) => {
          const a = replay(logs, asOf);
          expect(replay(logs, asOf)).toEqual(a);
          expect(replay(shuffled, asOf)).toEqual(a);
        },
      ),
    );
  });

  it('keeps log XP under the cap and xpByDate under cap plus quest bonuses', () => {
    fc.assert(
      fc.property(logsArb(60), (logs) => {
        const d = replayDetailed(logs, asOf);
        for (const date of Object.keys(d.state.xpByDate)) {
          expect(d.logXpByDate[date]).toBeLessThanOrEqual(DAILY_XP_CAP);
          expect(d.state.xpByDate[date]).toBeLessThanOrEqual(
            DAILY_XP_CAP + QUESTS_PER_DAY * QUEST_BONUS_XP,
          );
        }
      }),
    );
  });

  it('stat XP sums to total XP and never goes negative', () => {
    fc.assert(
      fc.property(logsArb(), (logs) => {
        const s = replay(logs, asOf);
        const sum = STAT_ORDER.reduce((a, k) => a + s.stats[k].xp, 0);
        expect(sum).toBe(s.totalXp);
        expect(s.totalXp).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(s.totalXp)).toBe(true);
        STAT_ORDER.forEach((k) => expect(s.stats[k].xp).toBeGreaterThanOrEqual(0));
      }),
    );
  });

  it('a valid log awards an integer of 0 or more', () => {
    fc.assert(
      fc.property(logArb(), (log) => {
        const d = replayDetailed([log], asOf);
        const xp = d.logXpByDate[log.localDate];
        expect(Number.isInteger(xp)).toBe(true);
        expect(xp).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('appending a log never lowers total XP or any stat', () => {
    const draft = fc.oneof(moveDraft, eatDraft, restDraft);
    fc.assert(
      fc.property(logsArb(), draft, fc.integer({ min: 0, max: 2 }), (logs, d, delta) => {
        const date = addDays(maxDate(logs), delta);
        const dayIndex = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${WINDOW_START}T00:00:00Z`)) / 86_400_000);
        const next = { ...makeLog(d, dayIndex, 0, 'zz-new'), loggedAt: maxLoggedAt(logs) + 1 + delta * 86_400_000 };
        const before = replay(logs, asOf);
        const after = replay([...logs, next], asOf);
        expect(after.totalXp).toBeGreaterThanOrEqual(before.totalXp);
        STAT_ORDER.forEach((k) => expect(after.stats[k].xp).toBeGreaterThanOrEqual(before.stats[k].xp));
      }),
    );
  });

  it('removing a log leaves earlier dates unchanged', () => {
    fc.assert(
      fc.property(logsArb().filter((l) => l.length > 0), fc.nat(), (logs, pick) => {
        const removed = logs[pick % logs.length];
        const rest = logs.filter((l) => l !== removed);
        const before = replay(logs, asOf).xpByDate;
        const after = replay(rest, asOf).xpByDate;
        for (const date of Object.keys(before)) {
          if (date < removed.localDate) expect(after[date]).toBe(before[date]);
        }
      }),
    );
  });
});
