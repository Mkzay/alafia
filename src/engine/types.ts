export type StatId = 'strength' | 'endurance' | 'agility' | 'vitality' | 'recovery';

export const STAT_ORDER: readonly StatId[] = [
  'strength',
  'endurance',
  'agility',
  'vitality',
  'recovery',
];

export type QuestId =
  | 'move20'
  | 'mealWithPlants'
  | 'logSleep'
  | 'stretch10'
  | 'fullPlate'
  | 'beforeNoon'
  | 'twoTypes';

export type LogType = 'move' | 'eat' | 'rest';

export interface BaseLog {
  id: string;
  type: LogType;
  /** Epoch milliseconds. */
  loggedAt: number;
  /** 'YYYY-MM-DD' on the device at log time. */
  localDate: string;
  /** Minutes since local midnight at log time, 0 to 1439. */
  localMinutes: number;
}

export type MoveKind = 'cardio' | 'strength' | 'mobility' | 'sport';
export type Intensity = 'light' | 'moderate' | 'vigorous';

export interface MoveLog extends BaseLog {
  type: 'move';
  kind: MoveKind;
  /** 1 to 300. */
  minutes: number;
  intensity: Intensity;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlateChecks {
  protein: boolean;
  plants: boolean;
  fiberCarb: boolean;
  water: boolean;
}

export interface EatLog extends BaseLog {
  type: 'eat';
  slot: MealSlot;
  checks: PlateChecks;
  presetId?: string;
}

export interface RestLog extends BaseLog {
  type: 'rest';
  /** 0 to 14, in steps of 0.5. */
  hours: number;
  quality: 1 | 2 | 3 | 4 | 5;
}

export type Log = MoveLog | EatLog | RestLog;

export interface StatState {
  xp: number;
  value: number;
}

export interface QuestState {
  id: QuestId;
  done: boolean;
  bonusAwarded: boolean;
}

export interface CharacterState {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  stats: Record<StatId, StatState>;
  streak: number;
  streakAtRisk: boolean;
  xpByDate: Record<string, number>;
  quests: QuestState[];
}
