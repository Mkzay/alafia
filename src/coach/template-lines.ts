import type { CoachEvent } from './types';

/**
 * Every user-facing coach line lives in this file (COACH-19). Review here.
 *
 * Rules, checked by tests in templates.test.ts:
 * - One or two short sentences, 240 characters or fewer after rendering.
 * - Only the tokens {xp}, {level}, {streak} and {days}.
 *   {days} renders "1 day" or "N days". Use it wherever a count of days is a noun.
 *   "{streak} day streak" is fine because "day" is an adjective there.
 * - Contractions are fine. Use straight apostrophes.
 * - No dashes of any kind, no banned terms, no pressure words.
 * - Never judge missed days, sleep or food. Keep the voice in the game world.
 * - At most 2 lines in this file start with "Nice", and at most 2 use "every".
 * - Lines with {xp} are never shown when xpGained is 0 (see ZERO_XP_LINES).
 */
export const TEMPLATE_LINES: Readonly<Record<CoachEvent, readonly string[]>> = {
  move: [
    '+{xp} XP for moving. Your character just got a little stronger.',
    "Nice move! That's {xp} XP in the bag.",
    'You showed up and moved. Well done o.',
    'Movement logged. Your hero is warming up.',
    'Oya, {xp} XP added. Keep that energy flowing.',
    'Good work getting moving today. Your character felt that one.',
  ],
  eat: [
    'Meal logged, {xp} XP earned. Enjoy your food.',
    'Nice plate check. Small choices add up.',
    'Food logged. Your vitality is growing.',
    '+{xp} XP for checking in with your plate. Well done.',
    'Thanks for logging that meal. Your vitality bar just ticked up.',
    'Chop well! Another meal on the board.',
  ],
  rest: [
    'Rest logged. Recovery is part of the game.',
    '+{xp} XP for rest. Your character is recharging.',
    'Sleep counts as training too. Good log.',
    'Campfire break logged. Even heroes need to rest up.',
    'Rest noted. Your recovery stat is listening.',
    'Rest is in the book. Gentle days build good habits.',
  ],
  level_up: [
    'Level {level}! Your character just grew stronger.',
    'Level up! Welcome to level {level}.',
    'Ding! You reached level {level}.',
    'New level unlocked: {level}. Keep the quests coming.',
    'Level {level} reached. Look at you go!',
    "You levelled up to {level}. Your habits are paying off.",
  ],
  streak: [
    "{days} in a row. That's a real habit forming.",
    'Streak: {days}! You keep showing up.',
    'Day {streak} of your streak. Steady wins.',
    'Your streak hit {streak}. Nice and consistent.',
    '{streak} day streak! Your character is proud of you.',
    'Look at that streak, {days} strong. Keep it easy and steady.',
  ],
  quest_done: [
    'Quest complete! Bonus XP is yours.',
    'Quest cleared. Your character gives you a high five.',
    'Another quest done. Well played, hero.',
    'Quest finished, bonus earned. On to the next one.',
    "You completed a quest today. That's how heroes grow.",
    'Quest done! Your quest board is looking good.',
  ],
  welcome_back: [
    'Welcome back! Good to see you again.',
    'Fresh start, fresh XP. Welcome back.',
    "You're back, and that's what counts.",
    'Welcome back, hero. Pick up right where you are.',
    'Good to see you again. One log at a time.',
    'Every return is a win. Welcome back o.',
  ],
};

/**
 * Used instead of TEMPLATE_LINES when a Move, Eat or Rest log earns 0 XP. No line may use {xp}.
 * - Move earns 0 only at the 300 XP daily cap, so Move lines may mention a full XP bar.
 * - Eat earns 0 at the cap or on the 6th or later meal of a day.
 * - Rest earns 0 at the cap or on a second Rest log the same day.
 * CoachInput does not say which, so Eat and Rest lines must be true in both cases and
 * must not claim the XP bar is full.
 */
export const ZERO_XP_LINES: Readonly<Record<'move' | 'eat' | 'rest', readonly string[]>> = {
  move: [
    'Movement logged. No extra XP this time, but the habit still grows.',
    "Logged! You've hit today's XP limit, and that move still counts.",
    'Still moving, love it. Your XP is topped up for today.',
    'Movement saved. The XP bar has had its fill today.',
    'Logged. Your habit wins, even when the XP bar is full.',
  ],
  eat: [
    'Meal logged. No extra XP this time, enjoy your food.',
    'Logged. Your plate checks are saved, chop well.',
    'Food noted. Your habit still grows.',
    "Thanks for logging that meal. No new XP, but it still counts.",
    'Meal saved. Fresh XP comes back tomorrow.',
  ],
  rest: [
    'Rest logged. No extra XP this time, so just relax.',
    "Logged. Rest well, you've earned it.",
    'Rest noted. Fresh XP comes back tomorrow.',
    'Your habit still grows, even with no new XP. Sleep well.',
    'Rest saved. Your recovery is in good hands.',
  ],
};

/** Used only if everything else fails. */
export const FALLBACK_LINE = 'Logged. Nice one, keep it going.';
