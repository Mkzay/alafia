import { describe, expect, it } from 'vitest';
import { evaluateQuests, QUEST_DEFINITIONS, questsForDate } from './quests';
import type { EatLog, Log, MoveLog, QuestId, RestLog } from './types';

const base = { id: 'a', loggedAt: 0, localDate: '2026-11-14', localMinutes: 600 };
const move = (minutes: number, kind: MoveLog['kind'] = 'cardio', localMinutes = 600): MoveLog => ({
  ...base,
  localMinutes,
  type: 'move',
  kind,
  minutes,
  intensity: 'light',
});
const eat = (checks: Partial<EatLog['checks']>): EatLog => ({
  ...base,
  type: 'eat',
  slot: 'lunch',
  checks: { protein: false, plants: false, fiberCarb: false, water: false, ...checks },
});
const rest: RestLog = { ...base, type: 'rest', hours: 8, quality: 3 };

const done = (id: QuestId, logs: Log[]) => QUEST_DEFINITIONS[id].isDone(logs);

describe('quest conditions', () => {
  it('move20 needs 20 minutes', () => {
    expect(done('move20', [move(19)])).toBe(false);
    expect(done('move20', [move(20)])).toBe(true);
  });
  it('mealWithPlants needs the plants check', () => {
    expect(done('mealWithPlants', [eat({ protein: true })])).toBe(false);
    expect(done('mealWithPlants', [eat({ plants: true })])).toBe(true);
  });
  it('logSleep needs a Rest log', () => {
    expect(done('logSleep', [move(30)])).toBe(false);
    expect(done('logSleep', [rest])).toBe(true);
  });
  it('stretch10 needs 10 minutes of mobility', () => {
    expect(done('stretch10', [move(9, 'mobility')])).toBe(false);
    expect(done('stretch10', [move(10, 'cardio')])).toBe(false);
    expect(done('stretch10', [move(10, 'mobility')])).toBe(true);
  });
  it('fullPlate needs all four checks', () => {
    expect(done('fullPlate', [eat({ protein: true, plants: true, fiberCarb: true })])).toBe(false);
    expect(
      done('fullPlate', [eat({ protein: true, plants: true, fiberCarb: true, water: true })]),
    ).toBe(true);
  });
  it('beforeNoon uses localMinutes under 720', () => {
    expect(done('beforeNoon', [move(5, 'cardio', 720)])).toBe(false);
    expect(done('beforeNoon', [move(5, 'cardio', 719)])).toBe(true);
  });
  it('twoTypes needs two distinct log types', () => {
    expect(done('twoTypes', [move(5), move(10)])).toBe(false);
    expect(done('twoTypes', [move(5), rest])).toBe(true);
  });
});

describe('questsForDate', () => {
  it('returns 3 distinct known quests', () => {
    const quests = questsForDate('2026-11-14');
    expect(quests).toHaveLength(3);
    expect(new Set(quests).size).toBe(3);
    quests.forEach((q) => expect(QUEST_DEFINITIONS[q]).toBeDefined());
  });
  it('is stable for the same date and varies across dates', () => {
    expect(questsForDate('2026-11-14')).toEqual(questsForDate('2026-11-14'));
    const sets = new Set(
      Array.from({ length: 14 }, (_, i) => questsForDate(`2026-11-${String(i + 1).padStart(2, '0')}`).join()),
    );
    expect(sets.size).toBeGreaterThan(1);
  });
});

describe('evaluateQuests', () => {
  it('marks done quests and awards each bonus once', () => {
    const date = '2026-11-14';
    const logs = [move(30), rest];
    const result = evaluateQuests(date, logs);
    expect(result).toHaveLength(3);
    result.forEach((q) => {
      expect(q.done).toBe(QUEST_DEFINITIONS[q.id].isDone(logs));
      expect(q.bonusAwarded).toBe(q.done);
    });
  });
});
