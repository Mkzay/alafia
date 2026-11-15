import type { Intensity, QuestId } from './types';

/** Every tunable number in the engine lives here. */

export const INTENSITY_MULTIPLIER: Record<Intensity, number> = {
  light: 1.0,
  moderate: 1.5,
  vigorous: 2.0,
};

export const MOVE_MINUTES_MIN = 1;
export const MOVE_MINUTES_MAX = 300;

export const EAT_BASE_XP = 5;
export const EAT_XP_PER_CHECK = 10;
export const EAT_LOGS_PER_DAY_WITH_XP = 5;

export const REST_XP_IDEAL = 40;
export const REST_XP_OK = 25;
export const REST_XP_LOW = 10;
export const REST_IDEAL_MIN_HOURS = 7;
export const REST_IDEAL_MAX_HOURS = 9;
export const REST_OK_MIN_HOURS = 6;
export const REST_OK_MAX_HOURS = 10;
export const REST_QUALITY_NEUTRAL = 3;
export const REST_QUALITY_BONUS_PER_STEP = 5;
export const REST_QUALITY_MAX_STEPS = 2;

/** Streak multiplier is 1 + 0.02 x min(streak, 7), stored as percent for integer math. */
export const STREAK_BONUS_PERCENT_PER_DAY = 2;
export const STREAK_BONUS_MAX_DAYS = 7;

export const DAILY_XP_CAP = 300;
export const QUEST_BONUS_XP = 20;
export const QUESTS_PER_DAY = 3;

export const LEVEL_XP_BASE = 60;
export const LEVEL_XP_EXPONENT = 1.7;
export const MAX_LEVEL = 99;

export const STAT_VALUE_DIVISOR = 10;

export const AVATAR_TIER_MIN_LEVELS = [1, 5, 10, 20] as const;

export const NOON_MINUTES = 720;
export const QUEST_MOVE_MINUTES = 20;
export const QUEST_STRETCH_MINUTES = 10;

export const QUEST_IDS: readonly QuestId[] = [
  'move20',
  'mealWithVeggies',
  'logSleep',
  'stretch10',
  'fullPlate',
  'beforeNoon',
  'twoTypes',
];
