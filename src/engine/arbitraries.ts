import fc from 'fast-check';
import { addDays } from './dates';
import type { EatLog, Log, MoveLog, RestLog } from './types';

export const WINDOW_START = '2026-11-01';
export const WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

const dayOffset = fc.integer({ min: 0, max: WINDOW_DAYS - 1 });
const minuteOfDay = fc.integer({ min: 0, max: 1439 });

type Draft<T extends Log> = Omit<T, 'id' | 'loggedAt' | 'localDate' | 'localMinutes'>;

export const moveDraft: fc.Arbitrary<Draft<MoveLog>> = fc.record({
  type: fc.constant('move' as const),
  kind: fc.constantFrom('cardio', 'strength', 'mobility', 'sport'),
  minutes: fc.integer({ min: 1, max: 300 }),
  intensity: fc.constantFrom('light', 'moderate', 'vigorous'),
});

export const eatDraft: fc.Arbitrary<Draft<EatLog>> = fc.record({
  type: fc.constant('eat' as const),
  slot: fc.constantFrom('breakfast', 'lunch', 'dinner', 'snack'),
  checks: fc.record({
    protein: fc.boolean(),
    veggies: fc.boolean(),
    fiberCarb: fc.boolean(),
    water: fc.boolean(),
  }),
});

export const restDraft: fc.Arbitrary<Draft<RestLog>> = fc.record({
  type: fc.constant('rest' as const),
  hours: fc.integer({ min: 0, max: 28 }).map((n) => n / 2),
  quality: fc.constantFrom(1, 2, 3, 4, 5),
});

const draft = fc.oneof(moveDraft, eatDraft, restDraft);

/** Builds a log whose loggedAt matches its date and minute, with the given id. */
export function makeLog(d: Draft<Log>, dayIndex: number, minutes: number, id: string): Log {
  const localDate = addDays(WINDOW_START, dayIndex);
  const loggedAt = Date.UTC(2026, 10, 1) + dayIndex * DAY_MS + minutes * 60_000;
  return { ...d, id, loggedAt, localDate, localMinutes: minutes } as Log;
}

/** Up to maxLength valid logs inside a small date window, with unique ids. */
export function logsArb(maxLength = 30): fc.Arbitrary<Log[]> {
  return fc
    .array(fc.tuple(draft, dayOffset, minuteOfDay), { maxLength })
    .map((rows) => rows.map(([d, day, min], i) => makeLog(d, day, min, `log-${String(i).padStart(3, '0')}`)));
}

/** A single valid log with a fixed id. */
export function logArb(id = 'single'): fc.Arbitrary<Log> {
  return fc.tuple(draft, dayOffset, minuteOfDay).map(([d, day, min]) => makeLog(d, day, min, id));
}
