import type { CoachEvent } from './types';

/**
 * Every user-facing coach line lives in this file (COACH-19). Review here.
 *
 * Rules, checked by tests in templates.test.ts:
 * - One or two short sentences, 240 characters or fewer after rendering.
 * - Only the tokens {xp}, {level} and {streak}.
 * - No dashes of any kind, no banned terms, no pressure words.
 * - Never judge missed days, sleep or food.
 */
export const TEMPLATE_LINES: Readonly<Record<CoachEvent, readonly string[]>> = {
  move: [
    '+{xp} XP for moving. Your body says thank you.',
    'Nice move! That is {xp} XP in the bag.',
    'You showed up and moved. Well done o.',
    'Movement logged. Every step counts.',
    'Oya, {xp} XP added. Keep that energy flowing.',
    'Good work getting moving today. Your character felt that one.',
  ],
  eat: [
    'Meal logged, {xp} XP earned. Enjoy your food.',
    'Nice plate check. Small choices add up.',
    'Food logged. Your vitality is growing.',
    '+{xp} XP for checking in with your plate. Well done.',
    'Thanks for logging that meal. Every log helps your character grow.',
    'Chop well! Another meal on the board.',
  ],
  rest: [
    'Rest logged. Recovery is part of the game.',
    '+{xp} XP for rest. Your character is recharging.',
    'Sleep counts as training too. Nice log.',
    'Thanks for logging your rest. Every night helps.',
    'Rest noted. Your recovery stat is listening.',
    'Rest is in the book. Gentle days build good habits.',
  ],
  level_up: [
    'Level {level}! Your character just grew stronger.',
    'Level up! Welcome to level {level}.',
    'Ding! You reached level {level}.',
    'New level unlocked: {level}. Keep the quests coming.',
    'Level {level} reached. Look at you go!',
    'You levelled up to {level}. Your habits are paying off.',
  ],
  streak: [
    '{streak} days in a row. That is a real habit forming.',
    'Streak: {streak} days! You keep showing up.',
    'Day {streak} of your streak. Steady wins.',
    'Your streak hit {streak}. Nice and consistent.',
    '{streak} day streak! Your character is proud of you.',
    'Look at that streak, {streak} days strong. Keep it easy and steady.',
  ],
  quest_done: [
    'Quest complete! Bonus XP is yours.',
    'Quest cleared. Your character gives you a high five.',
    'Another quest done. Nice work, hero.',
    'Quest finished, bonus earned. On to the next one.',
    'You completed a quest today. That is how heroes grow.',
    'Quest done! Your quest board is looking good.',
  ],
  welcome_back: [
    'Welcome back! Good to see you again.',
    'Fresh start, fresh XP. Welcome back.',
    'You are back, and that is what counts.',
    'Welcome back, hero. Pick up right where you are.',
    'Good to see you again. One log at a time.',
    'Every return is a win. Welcome back o.',
  ],
};

/** Used only if everything else fails. */
export const FALLBACK_LINE = 'Logged. Nice one, keep it going.';
