import type { CharacterState } from '@/engine/types';
import {
  AFTERNOON_START,
  EVENING_START,
  LEVEL_MAX,
  LEVEL_MIN,
  MINUTES_PER_DAY,
  MORNING_START,
  NIGHT_START,
  STREAK_MAX,
  STREAK_MILESTONES,
  WELCOME_BACK_DAYS,
  XP_GAINED_MAX,
} from './constants';
import { coachInputSchema } from './schemas';
import { COACH_STATS } from './types';
import type { CoachEvent, CoachInput, CoachStat, TimeBucket, Tone } from './types';

export type LogType = 'move' | 'eat' | 'rest';

export interface BuildCoachInputArgs {
  before: CharacterState;
  after: CharacterState;
  logType: LogType;
  /** The new log's local date, 'YYYY-MM-DD'. */
  logDate: string;
  /** Minutes since local midnight when the log was made. */
  localMinutes: number;
  tone?: Tone;
}

const HYPE_EVENTS: readonly CoachEvent[] = ['level_up', 'quest_done', 'streak'];

/** Non-finite becomes lo. Otherwise truncate and clamp. */
function toInt(n: unknown, lo: number, hi: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

export function timeBucketFor(localMinutes: number): TimeBucket {
  const m = Number.isFinite(localMinutes)
    ? ((Math.trunc(localMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    : 0;
  if (m >= MORNING_START && m < AFTERNOON_START) return 'morning';
  if (m >= AFTERNOON_START && m < EVENING_START) return 'afternoon';
  if (m >= EVENING_START && m < NIGHT_START) return 'evening';
  return 'night';
}

export function topStatOf(state: CharacterState): CoachStat {
  let best: CoachStat = COACH_STATS[0];
  let bestXp = -Infinity;
  for (const stat of COACH_STATS) {
    const raw = state.stats?.[stat]?.xp;
    const xp = typeof raw === 'number' && Number.isFinite(raw) ? raw : -Infinity;
    if (xp > bestXp) {
      best = stat;
      bestXp = xp;
    }
  }
  return best;
}

/** Day number from 'YYYY-MM-DD' using Date.UTC only. Null for anything else. */
function dayNumber(date: unknown): number | null {
  if (typeof date !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mo < 1 || mo > 12 || d < 1 || d > monthDays[mo - 1]) return null;
  return Math.round(Date.UTC(y, mo - 1, d) / 86_400_000);
}

export function daysBetween(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a;
}

function doneCount(state: CharacterState): number {
  return (state.quests ?? []).filter((q) => q?.done === true).length;
}

/** Latest active date before logDate, from the keys of xpByDate (COACH-20). */
export function lastActiveBefore(state: CharacterState, logDate: string): string | null {
  let latest: string | null = null;
  for (const date of Object.keys(state.xpByDate ?? {})) {
    if (date < logDate && (latest === null || date > latest)) latest = date;
  }
  return latest;
}

export function chooseEvent(args: Omit<BuildCoachInputArgs, 'tone' | 'localMinutes'>): CoachEvent {
  const { before, after, logType, logDate } = args;
  if (toInt(after.level, LEVEL_MIN, LEVEL_MAX) > toInt(before.level, LEVEL_MIN, LEVEL_MAX)) return 'level_up';
  if (doneCount(after) > doneCount(before)) return 'quest_done';
  const streakAfter = toInt(after.streak, 0, STREAK_MAX);
  if (streakAfter > toInt(before.streak, 0, STREAK_MAX) && STREAK_MILESTONES.includes(streakAfter)) {
    return 'streak';
  }
  const last = lastActiveBefore(before, logDate);
  if (last !== null) {
    const gap = daysBetween(last, logDate);
    if (gap !== null && gap >= WELCOME_BACK_DAYS) return 'welcome_back';
  }
  return logType;
}

/** Turns engine state into the only data a provider may see. Never throws. */
export function buildCoachInput(args: BuildCoachInputArgs): CoachInput {
  const safe: CoachInput = {
    event: args.logType === 'eat' || args.logType === 'rest' ? args.logType : 'move',
    xpGained: 0,
    level: 1,
    streak: 0,
    topStat: 'strength',
    timeBucket: 'morning',
    tone: 'warm',
  };
  try {
    const event = chooseEvent(args);
    const candidate = {
      event,
      xpGained: toInt(Number(args.after.totalXp) - Number(args.before.totalXp), 0, XP_GAINED_MAX),
      level: toInt(args.after.level, LEVEL_MIN, LEVEL_MAX),
      streak: toInt(args.after.streak, 0, STREAK_MAX),
      topStat: topStatOf(args.after),
      timeBucket: timeBucketFor(args.localMinutes),
      tone: args.tone ?? (HYPE_EVENTS.includes(event) ? 'hype' : 'warm'),
    };
    const parsed = coachInputSchema.safeParse(candidate);
    return parsed.success ? parsed.data : safe;
  } catch {
    return safe;
  }
}

export function validateCoachInput(value: unknown): { ok: true; input: CoachInput } | { ok: false } {
  const parsed = coachInputSchema.safeParse(value);
  return parsed.success ? { ok: true, input: parsed.data } : { ok: false };
}
