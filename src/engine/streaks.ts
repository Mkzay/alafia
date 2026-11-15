import { addDays } from './dates';
import type { Log } from './types';

export function activeDates(logs: readonly Log[]): Set<string> {
  return new Set(logs.map((l) => l.localDate));
}

/** Count of consecutive active days ending on `date` (0 if `date` is not active). */
export function streakEndingOn(active: ReadonlySet<string>, date: string): number {
  let count = 0;
  let d = date;
  while (active.has(d)) {
    count++;
    d = addDays(d, -1);
  }
  return count;
}

export interface StreakResult {
  streak: number;
  atRisk: boolean;
}

export function streakAsOf(active: ReadonlySet<string>, today: string): StreakResult {
  if (active.has(today)) return { streak: streakEndingOn(active, today), atRisk: false };
  const yesterday = addDays(today, -1);
  if (active.has(yesterday)) return { streak: streakEndingOn(active, yesterday), atRisk: true };
  return { streak: 0, atRisk: false };
}
