import {
  DAILY_XP_CAP,
  EAT_BASE_XP,
  EAT_LOGS_PER_DAY_WITH_XP,
  EAT_XP_PER_CHECK,
  INTENSITY_MULTIPLIER,
  MOVE_MINUTES_MAX,
  MOVE_MINUTES_MIN,
  REST_IDEAL_MAX_HOURS,
  REST_IDEAL_MIN_HOURS,
  REST_OK_MAX_HOURS,
  REST_OK_MIN_HOURS,
  REST_QUALITY_BONUS_PER_STEP,
  REST_QUALITY_MAX_STEPS,
  REST_QUALITY_NEUTRAL,
  REST_XP_IDEAL,
  REST_XP_LOW,
  REST_XP_OK,
  STREAK_BONUS_MAX_DAYS,
  STREAK_BONUS_PERCENT_PER_DAY,
} from './constants';
import type { EatLog, Log, MoveLog, RestLog } from './types';

/** What has already happened earlier on the same local day. */
export interface XpContext {
  eatLogsSoFar: number;
  restSeen: boolean;
}

export const EMPTY_XP_CONTEXT: XpContext = { eatLogsSoFar: 0, restSeen: false };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function moveXp(log: MoveLog): number {
  const minutes = clamp(log.minutes, MOVE_MINUTES_MIN, MOVE_MINUTES_MAX);
  return Math.round(minutes * INTENSITY_MULTIPLIER[log.intensity]);
}

function eatXp(log: EatLog): number {
  const checks = Object.values(log.checks).filter(Boolean).length;
  return EAT_BASE_XP + EAT_XP_PER_CHECK * checks;
}

function restXp(log: RestLog): number {
  const h = log.hours;
  let base = REST_XP_LOW;
  if (h >= REST_IDEAL_MIN_HOURS && h <= REST_IDEAL_MAX_HOURS) base = REST_XP_IDEAL;
  else if (
    (h >= REST_OK_MIN_HOURS && h < REST_IDEAL_MIN_HOURS) ||
    (h > REST_IDEAL_MAX_HOURS && h <= REST_OK_MAX_HOURS)
  )
    base = REST_XP_OK;
  const steps = clamp(log.quality - REST_QUALITY_NEUTRAL, 0, REST_QUALITY_MAX_STEPS);
  return base + REST_QUALITY_BONUS_PER_STEP * steps;
}

/** XP for one log before the streak multiplier and the daily cap. */
export function baseXp(log: Log, ctx: XpContext): number {
  switch (log.type) {
    case 'move':
      return moveXp(log);
    case 'eat':
      return ctx.eatLogsSoFar >= EAT_LOGS_PER_DAY_WITH_XP ? 0 : eatXp(log);
    case 'rest':
      return ctx.restSeen ? 0 : restXp(log);
  }
}

export function advanceContext(ctx: XpContext, log: Log): XpContext {
  return {
    eatLogsSoFar: ctx.eatLogsSoFar + (log.type === 'eat' ? 1 : 0),
    restSeen: ctx.restSeen || log.type === 'rest',
  };
}

/** Multiplier is 1 + 0.02 x min(streak, 7). Integer math avoids float drift. */
export function applyStreakMultiplier(base: number, streak: number): number {
  const days = clamp(streak, 0, STREAK_BONUS_MAX_DAYS);
  return Math.round((base * (100 + STREAK_BONUS_PERCENT_PER_DAY * days)) / 100);
}

/** Returns the part of `xp` that still fits under the daily cap. */
export function applyCap(xp: number, usedToday: number): number {
  return Math.max(0, Math.min(xp, DAILY_XP_CAP - usedToday));
}
