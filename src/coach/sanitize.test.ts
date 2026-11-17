import { describe, expect, it } from 'vitest';
import { replay } from '@/engine/replay';
import type { CharacterState } from '@/engine/types';
import { buildCoachInput, chooseEvent, daysBetween, timeBucketFor, topStatOf, validateCoachInput } from './sanitize';
import type { BuildCoachInputArgs } from './sanitize';

const empty = replay([], { localDate: '2026-11-14' });
const state = (patch: Partial<CharacterState> = {}): CharacterState => ({ ...empty, ...patch });
const withStats = (xp: Partial<Record<keyof CharacterState['stats'], number>>): CharacterState['stats'] => {
  const stats = structuredClone(empty.stats);
  for (const [k, v] of Object.entries(xp)) stats[k as keyof typeof stats].xp = v as number;
  return stats;
};
const quests = (done: number): CharacterState['quests'] =>
  (['move20', 'logSleep', 'twoTypes'] as const).map((id, i) => ({ id, done: i < done, bonusAwarded: i < done }));

const args = (patch: Partial<BuildCoachInputArgs> = {}): BuildCoachInputArgs => ({
  before: state({ totalXp: 100, level: 2, streak: 1, xpByDate: { '2026-11-13': 100 } }),
  after: state({ totalXp: 145, level: 2, streak: 2, xpByDate: { '2026-11-13': 100, '2026-11-14': 45 } }),
  logType: 'move',
  logDate: '2026-11-14',
  localMinutes: 600,
  ...patch,
});

describe('event precedence', () => {
  it('falls back to the log type', () => {
    expect(chooseEvent(args())).toBe('move');
    expect(chooseEvent(args({ logType: 'eat' }))).toBe('eat');
    expect(chooseEvent(args({ logType: 'rest' }))).toBe('rest');
  });

  it('level_up wins over everything', () => {
    const a = args();
    a.after = { ...a.after, level: 3, quests: quests(2), streak: 3 };
    a.before = { ...a.before, streak: 2 };
    expect(chooseEvent(a)).toBe('level_up');
  });

  it('quest_done beats streak', () => {
    const a = args();
    a.before = { ...a.before, streak: 2, quests: quests(0) };
    a.after = { ...a.after, streak: 3, quests: quests(1) };
    expect(chooseEvent(a)).toBe('quest_done');
  });

  it('streak fires on a milestone only', () => {
    for (const [from, to, expected] of [
      [2, 3, 'streak'],
      [6, 7, 'streak'],
      [13, 14, 'streak'],
      [29, 30, 'streak'],
      [3, 4, 'move'],
      [3, 3, 'move'],
    ] as const) {
      const a = args();
      a.before = { ...a.before, streak: from };
      a.after = { ...a.after, streak: to };
      expect(chooseEvent(a), `${from} to ${to}`).toBe(expected);
    }
  });

  it('welcome_back needs 3 or more days since the last earlier log', () => {
    const at = (last: string) =>
      chooseEvent(args({ before: state({ totalXp: 50, streak: 0, xpByDate: { [last]: 50 } }), after: state({ totalXp: 95, streak: 1 }) }));
    expect(at('2026-11-12')).toBe('move'); // 2 days
    expect(at('2026-11-11')).toBe('welcome_back'); // 3 days
    expect(at('2026-10-01')).toBe('welcome_back');
  });

  it('welcome_back uses the latest earlier date and ignores today', () => {
    const before = state({ level: 2, streak: 1, xpByDate: { '2026-11-01': 10, '2026-11-12': 10, '2026-11-14': 10 } });
    expect(chooseEvent(args({ before }))).toBe('move');
  });

  it('welcome_back reads a day key even when its XP is 0', () => {
    const before = state({ level: 2, streak: 1, xpByDate: { '2026-11-01': 10, '2026-11-12': 0 } });
    expect(chooseEvent(args({ before }))).toBe('move');
    const onlyOld = state({ level: 2, streak: 1, xpByDate: { '2026-11-01': 10 } });
    expect(chooseEvent(args({ before: onlyOld }))).toBe('welcome_back');
  });

  it('never fires welcome_back on the first ever log', () => {
    expect(chooseEvent(args({ before: empty, after: state({ totalXp: 45, streak: 1 }) }))).toBe('move');
  });

  it('ignores a bad log date', () => {
    const before = state({ level: 2, streak: 1, xpByDate: { '2026-01-01': 10 } });
    expect(chooseEvent(args({ before, logDate: '2026-13-45' }))).toBe('move');
  });
});

describe('numbers', () => {
  it('keeps xpGained up to 360', () => {
    expect(buildCoachInput(args({ after: state({ totalXp: 460 }), before: state({ totalXp: 100 }) })).xpGained).toBe(360);
    expect(buildCoachInput(args({ after: state({ totalXp: 145 }), before: state({ totalXp: 100 }) })).xpGained).toBe(45);
  });

  it('clamps corrupt values', () => {
    const input = buildCoachInput(
      args({
        before: state({ totalXp: 0 }),
        after: state({ totalXp: 5000, level: 500, streak: 5000 }),
      }),
    );
    expect(input).toMatchObject({ xpGained: 360, level: 99, streak: 999 });
    const low = buildCoachInput(args({ before: state({ totalXp: 10 }), after: state({ totalXp: Number.NaN, level: Number.NaN, streak: -4 }) }));
    expect(low).toMatchObject({ xpGained: 0, level: 1, streak: 0 });
    expect(buildCoachInput(args({ before: state({ totalXp: 200 }), after: state({ totalXp: 100 }) })).xpGained).toBe(0);
  });
});

describe('top stat', () => {
  it('picks the highest and breaks ties in fixed order', () => {
    expect(topStatOf(state({ stats: withStats({ vitality: 30, recovery: 20 }) }))).toBe('vitality');
    expect(topStatOf(state({ stats: withStats({ agility: 30, recovery: 30 }) }))).toBe('agility');
    expect(topStatOf(empty)).toBe('strength');
    expect(topStatOf(state({ stats: withStats({ strength: Number.NaN, endurance: 1 }) }))).toBe('endurance');
  });
});

describe('time buckets', () => {
  it('splits the day at 05:00, 12:00, 17:00 and 21:00', () => {
    const at = (h: number, m: number) => timeBucketFor(h * 60 + m);
    expect([at(4, 59), at(5, 0), at(11, 59), at(12, 0)]).toEqual(['night', 'morning', 'morning', 'afternoon']);
    expect([at(16, 59), at(17, 0), at(20, 59), at(21, 0)]).toEqual(['afternoon', 'evening', 'evening', 'night']);
    expect([at(0, 0), at(23, 59)]).toEqual(['night', 'night']);
    expect([timeBucketFor(Number.NaN), timeBucketFor(-60), timeBucketFor(1440 + 600)]).toEqual(['night', 'night', 'morning']);
  });
});

describe('tone', () => {
  it('defaults by event and can be overridden', () => {
    expect(buildCoachInput(args()).tone).toBe('warm');
    expect(buildCoachInput(args({ after: state({ totalXp: 200, level: 3 }) })).tone).toBe('hype');
    expect(buildCoachInput(args({ tone: 'hype' })).tone).toBe('hype');
  });
});

describe('output shape', () => {
  it('has exactly the seven CoachInput keys', () => {
    const input = buildCoachInput(args());
    expect(Object.keys(input).sort()).toEqual(['event', 'level', 'streak', 'timeBucket', 'tone', 'topStat', 'xpGained']);
    expect(input).toEqual({
      event: 'move',
      xpGained: 45,
      level: 2,
      streak: 2,
      topStat: 'strength',
      timeBucket: 'morning',
      tone: 'warm',
    });
  });

  it('validateCoachInput rejects extra keys', () => {
    const input = buildCoachInput(args());
    expect(validateCoachInput(input).ok).toBe(true);
    expect(validateCoachInput({ ...input, logId: 'x' }).ok).toBe(false);
    expect(validateCoachInput('nope').ok).toBe(false);
  });

  it('never throws on broken state', () => {
    const broken = { totalXp: 'x' } as unknown as CharacterState;
    const input = buildCoachInput(args({ before: broken, after: broken }));
    expect(validateCoachInput(input).ok).toBe(true);
  });
});

describe('daysBetween', () => {
  it('counts calendar days across months and leap days', () => {
    expect(daysBetween('2026-11-11', '2026-11-14')).toBe(3);
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('bad', '2026-11-01')).toBeNull();
    expect(daysBetween('2026-02-29', '2026-03-01')).toBeNull();
    expect(daysBetween('2026-11-01', '2026-11-31')).toBeNull();
    expect(daysBetween('2026-11-01', '2026-00-10')).toBeNull();
  });
});
