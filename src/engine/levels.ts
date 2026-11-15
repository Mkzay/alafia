import {
  AVATAR_TIER_MIN_LEVELS,
  LEVEL_XP_BASE,
  LEVEL_XP_EXPONENT,
  MAX_LEVEL,
} from './constants';

export type AvatarTier = 1 | 2 | 3 | 4;

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP span of the current level (bar length). 0 at the maximum level. */
  xpForNext: number;
}

/** Index i holds the total XP needed to reach level i + 1. */
const LEVEL_TABLE: readonly number[] = Array.from({ length: MAX_LEVEL }, (_, i) =>
  Math.round(LEVEL_XP_BASE * i ** LEVEL_XP_EXPONENT),
);

function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
}

/** Total XP needed to reach level L. Level is clamped to 1..99. */
export function xpForLevel(level: number): number {
  return LEVEL_TABLE[clampLevel(level) - 1];
}

/** Highest level whose threshold is at or below xp. Capped at 99. */
export function levelFromXp(xp: number): number {
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (LEVEL_TABLE[mid - 1] <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelFromXp(totalXp);
  const floor = xpForLevel(level);
  const xpForNext = level >= MAX_LEVEL ? 0 : xpForLevel(level + 1) - floor;
  return { level, xpIntoLevel: Math.max(0, totalXp - floor), xpForNext };
}

export function avatarTier(level: number): AvatarTier {
  let tier = 1;
  AVATAR_TIER_MIN_LEVELS.forEach((min, i) => {
    if (level >= min) tier = i + 1;
  });
  return tier as AvatarTier;
}
