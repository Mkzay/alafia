import type { Log } from '@/engine/types';
import type {
  CoachMessage,
  ExportDocument,
  LogPatch,
  NewCoachMessage,
  NewLogInput,
  SettingKey,
  SettingValue,
  Settings,
} from './schemas';

/** Returns the current time as epoch milliseconds. Injected so tests control time. */
export type Clock = () => number;

export interface ReadResult<T> {
  items: T[];
  /** Records that failed validation and were left out. */
  skipped: number;
}

export interface Repository {
  readonly mode: 'indexeddb' | 'memory';
  addLog(input: NewLogInput): Promise<Log>;
  updateLog(id: string, patch: LogPatch): Promise<Log>;
  deleteLog(id: string): Promise<void>;
  readLogs(): Promise<ReadResult<Log>>;
  addCoachMessage(message: NewCoachMessage): Promise<CoachMessage>;
  latestCoachMessage(): Promise<CoachMessage | null>;
  readSettings(): Promise<Settings>;
  writeSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>;
  /** Spends one AI call from today's budget. Returns false when the budget is used up. */
  trySpendAiCall(): Promise<boolean>;
  exportAll(): Promise<ExportDocument>;
  resetAll(): Promise<void>;
  /** Called after any change made through this repository or by another tab. */
  subscribe(listener: () => void): () => void;
}

export interface SettingRow {
  key: string;
  value: unknown;
}
