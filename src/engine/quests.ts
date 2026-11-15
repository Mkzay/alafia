import {
  NOON_MINUTES,
  QUEST_IDS,
  QUEST_MOVE_MINUTES,
  QUEST_STRETCH_MINUTES,
  QUESTS_PER_DAY,
} from './constants';
import { STAT_ORDER } from './types';
import type { Log, QuestId, QuestState, StatId } from './types';

export interface QuestDefinition {
  id: QuestId;
  /** User-facing text. Review by hand for tone. */
  title: string;
  /** Stats that receive the bonus XP, split evenly. */
  related: readonly StatId[];
  isDone(dayLogs: readonly Log[]): boolean;
}

export const QUEST_DEFINITIONS: Record<QuestId, QuestDefinition> = {
  move20: {
    id: 'move20',
    title: 'Move for 20 minutes',
    related: ['strength', 'endurance'],
    isDone: (logs) => logs.some((l) => l.type === 'move' && l.minutes >= QUEST_MOVE_MINUTES),
  },
  mealWithVeggies: {
    id: 'mealWithVeggies',
    title: 'Log a meal with veggies or fruit',
    related: ['vitality'],
    isDone: (logs) => logs.some((l) => l.type === 'eat' && l.checks.veggies),
  },
  logSleep: {
    id: 'logSleep',
    title: 'Log last night\u2019s sleep',
    related: ['recovery'],
    isDone: (logs) => logs.some((l) => l.type === 'rest'),
  },
  stretch10: {
    id: 'stretch10',
    title: 'Stretch for 10 minutes',
    related: ['agility'],
    isDone: (logs) =>
      logs.some((l) => l.type === 'move' && l.kind === 'mobility' && l.minutes >= QUEST_STRETCH_MINUTES),
  },
  fullPlate: {
    id: 'fullPlate',
    title: 'Tick all four plate checks in one meal',
    related: ['vitality'],
    isDone: (logs) =>
      logs.some((l) => l.type === 'eat' && Object.values(l.checks).every(Boolean)),
  },
  beforeNoon: {
    id: 'beforeNoon',
    title: 'Log something before noon',
    related: STAT_ORDER,
    isDone: (logs) => logs.some((l) => l.localMinutes < NOON_MINUTES),
  },
  twoTypes: {
    id: 'twoTypes',
    title: 'Log two different types today',
    related: STAT_ORDER,
    isDone: (logs) => new Set(logs.map((l) => l.type)).size >= 2,
  },
};

/** 32-bit FNV-1a hash of a string. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small seeded generator. Returns floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The 3 distinct quests for a local date. Depends on the date only. */
export function questsForDate(localDate: string): QuestId[] {
  const rand = mulberry32(fnv1a(localDate));
  const pool = [...QUEST_IDS];
  for (let i = 0; i < QUESTS_PER_DAY; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, QUESTS_PER_DAY);
}

/** Quest state for a date, judged from that date's logs only. */
export function evaluateQuests(localDate: string, dayLogs: readonly Log[]): QuestState[] {
  return questsForDate(localDate).map((id) => {
    const done = QUEST_DEFINITIONS[id].isDone(dayLogs);
    return { id, done, bonusAwarded: done };
  });
}
