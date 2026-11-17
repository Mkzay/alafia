export type CoachEvent =
  | 'move'
  | 'eat'
  | 'rest'
  | 'level_up'
  | 'streak'
  | 'quest_done'
  | 'welcome_back';

export type CoachStat = 'strength' | 'endurance' | 'agility' | 'vitality' | 'recovery';
export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';
export type Tone = 'warm' | 'hype';

export interface CoachInput {
  event: CoachEvent;
  /** Integer 0..360 (300 daily log cap plus up to 3 quest bonuses of 20). */
  xpGained: number;
  /** Integer 1..99. */
  level: number;
  /** Integer 0..999. */
  streak: number;
  topStat: CoachStat;
  timeBucket: TimeBucket;
  tone: Tone;
}

export interface CoachOutput {
  /** 1 to 2 sentences, max 240 characters. */
  text: string;
  source: 'template' | 'ai';
  provider?: string;
}

export interface CoachProvider {
  readonly name: string;
  generate(input: CoachInput, opts: { signal: AbortSignal }): Promise<string>;
}

export const COACH_EVENTS: readonly CoachEvent[] = [
  'move',
  'eat',
  'rest',
  'level_up',
  'streak',
  'quest_done',
  'welcome_back',
];

/** Same order as the engine's STAT_ORDER. Checked by a test. */
export const COACH_STATS: readonly CoachStat[] = [
  'strength',
  'endurance',
  'agility',
  'vitality',
  'recovery',
];

export const TIME_BUCKETS: readonly TimeBucket[] = ['morning', 'afternoon', 'evening', 'night'];
export const TONES: readonly Tone[] = ['warm', 'hype'];
