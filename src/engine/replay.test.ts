import { describe, expect, it } from 'vitest';
import { QUEST_IDS } from './constants';
import { addDays } from './dates';
import { questsForDate } from './quests';
import { replay, replayDetailed } from './replay';
import type { EatLog, Log, MoveLog, RestLog } from './types';

const DATE = '2026-11-14';
let counter = 0;
const meta = (localDate = DATE, localMinutes = 600) => ({
  id: `id-${String(counter++).padStart(4, '0')}`,
  loggedAt: Date.parse(`${localDate}T00:00:00Z`) + localMinutes * 60_000,
  localDate,
  localMinutes,
});
const move = (minutes: number, intensity: MoveLog['intensity'], localDate = DATE, lm = 600): MoveLog => ({
  ...meta(localDate, lm),
  type: 'move',
  kind: 'cardio',
  minutes,
  intensity,
});
const eat = (localDate = DATE, lm = 700): EatLog => ({
  ...meta(localDate, lm),
  type: 'eat',
  slot: 'lunch',
  checks: { protein: true, veggies: true, fiberCarb: false, water: false },
});
const rest = (localDate = DATE, lm = 800): RestLog => ({
  ...meta(localDate, lm),
  type: 'rest',
  hours: 8,
  quality: 3,
});

describe('replay', () => {
  it('returns a clean state for no logs', () => {
    const s = replay([], { localDate: DATE });
    expect(s.totalXp).toBe(0);
    expect(s.level).toBe(1);
    expect(s.streak).toBe(0);
    expect(s.streakAtRisk).toBe(false);
    expect(s.xpByDate).toEqual({});
    expect(s.quests).toHaveLength(3);
    expect(s.quests.every((q) => !q.done)).toBe(true);
    expect(Object.values(s.stats).every((x) => x.xp === 0 && x.value === 1)).toBe(true);
  });

  it('a walk and a meal reach level 2', () => {
    const logs: Log[] = [move(30, 'moderate'), eat()];
    const s = replay(logs, { localDate: DATE });
    const bonus = s.quests.filter((q) => q.bonusAwarded).length * 20;
    expect(s.totalXp).toBe(45 + 25 + bonus);
    expect(s.level).toBeGreaterThanOrEqual(2);
    expect(s.stats.endurance.xp).toBeGreaterThanOrEqual(45);
    expect(s.stats.vitality.xp).toBeGreaterThanOrEqual(25);
  });

  it('caps log XP at 300 and still saves later logs', () => {
    const logs = [move(300, 'vigorous'), move(60, 'vigorous', DATE, 650)];
    const d = replayDetailed(logs, { localDate: DATE });
    expect(d.logXpByDate[DATE]).toBe(300);
  });

  it('adds quest bonuses on top of the cap', () => {
    const date = findDateWithQuest('move20');
    const logs = [move(300, 'vigorous', date), move(60, 'vigorous', date, 650)];
    const d = replayDetailed(logs, { localDate: date });
    expect(d.logXpByDate[date]).toBe(300);
    expect(d.bonusXpByDate[date]).toBeGreaterThanOrEqual(20);
    expect(d.state.xpByDate[date]).toBe(300 + d.bonusXpByDate[date]);
  });

  it('applies the streak multiplier from the previous day', () => {
    const day1 = '2026-11-13';
    const logs = [move(100, 'light', day1), move(100, 'light', DATE)];
    const d = replayDetailed(logs, { localDate: DATE });
    expect(d.logXpByDate[day1]).toBe(100);
    expect(d.logXpByDate[DATE]).toBe(102);
  });

  it('ignores logs dated after asOf', () => {
    const future = addDays(DATE, 1);
    const s = replay([move(30, 'light', future)], { localDate: DATE });
    expect(s.totalXp).toBe(0);
    expect(s.xpByDate).toEqual({});
  });

  it('flags a streak at risk when today has no log', () => {
    const s = replay([move(10, 'light', addDays(DATE, -1))], { localDate: DATE });
    expect(s.streak).toBe(1);
    expect(s.streakAtRisk).toBe(true);
  });

  it('awards only the earliest Rest log of a day', () => {
    const early = { ...rest(), id: 'a', loggedAt: 1 };
    const late = { ...rest(), id: 'b', loggedAt: 2 };
    const d = replayDetailed([late, early], { localDate: DATE });
    expect(d.logXpByDate[DATE]).toBe(40);
    expect(d.state.stats.recovery.xp).toBeGreaterThanOrEqual(40);
  });

  it('is deterministic', () => {
    const logs = [move(30, 'moderate'), eat(), rest()];
    expect(replay(logs, { localDate: DATE })).toEqual(replay(logs, { localDate: DATE }));
  });
});

function findDateWithQuest(id: (typeof QUEST_IDS)[number]): string {
  for (let i = 0; i < 60; i++) {
    const d = addDays('2026-11-01', i);
    if (questsForDate(d).includes(id)) return d;
  }
  throw new Error(`no date found for quest ${id}`);
}
