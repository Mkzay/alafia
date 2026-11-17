import { z } from 'zod';
import { LEVEL_MAX, LEVEL_MIN, MAX_TEXT_LENGTH, STREAK_MAX, XP_GAINED_MAX } from './constants';

export const coachEventSchema = z.enum([
  'move',
  'eat',
  'rest',
  'level_up',
  'streak',
  'quest_done',
  'welcome_back',
]);

/** Strict: unknown keys are rejected, so nothing extra can reach a provider. */
export const coachInputSchema = z.strictObject({
  event: coachEventSchema,
  xpGained: z.number().int().min(0).max(XP_GAINED_MAX),
  level: z.number().int().min(LEVEL_MIN).max(LEVEL_MAX),
  streak: z.number().int().min(0).max(STREAK_MAX),
  topStat: z.enum(['strength', 'endurance', 'agility', 'vitality', 'recovery']),
  timeBucket: z.enum(['morning', 'afternoon', 'evening', 'night']),
  tone: z.enum(['warm', 'hype']),
});

export const coachOutputSchema = z.strictObject({
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  source: z.enum(['template', 'ai']),
  provider: z.string().min(1).optional(),
});
