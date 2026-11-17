/** Every coach number lives here. */

export const PROVIDER_TIMEOUT_MS = 3000;
export const TOTAL_BUDGET_MS = 4000;

export const MAX_TEXT_LENGTH = 240;
export const MAX_SENTENCES = 2;

export const XP_GAINED_MAX = 360;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 99;
export const STREAK_MAX = 999;

export const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30];
export const WELCOME_BACK_DAYS = 3;

/** Minutes since local midnight where each bucket starts. Night wraps past midnight. */
export const MORNING_START = 5 * 60;
export const AFTERNOON_START = 12 * 60;
export const EVENING_START = 17 * 60;
export const NIGHT_START = 21 * 60;
export const MINUTES_PER_DAY = 24 * 60;
