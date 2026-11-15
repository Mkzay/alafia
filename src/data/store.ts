import { replay } from '@/engine/replay';
import type { CharacterState, Log } from '@/engine/types';
import { localParts, msUntilNextLocalMidnight } from '@/lib/dates';
import type { Clock, Repository } from './repository';
import { settingDefaults } from './schemas';
import type {
  CoachMessage,
  ExportDocument,
  LogPatch,
  NewCoachMessage,
  NewLogInput,
  Settings,
} from './schemas';

export interface DayGroup {
  date: string;
  logs: Log[];
}

export interface DataSnapshot {
  status: 'loading' | 'ready';
  mode: 'indexeddb' | 'memory';
  /** Local date the state was computed for. */
  today: string;
  /** Valid logs, oldest first. */
  logs: Log[];
  /** Newest day first, newest log first inside a day. */
  logsByDay: DayGroup[];
  state: CharacterState;
  settings: Settings;
  latestCoach: CoachMessage | null;
  /** Stored records that failed validation and were left out. */
  skippedRecords: number;
}

export interface LogResult {
  log: Log;
  before: CharacterState;
  after: CharacterState;
  xpGained: number;
  leveledUp: boolean;
}

const SERVER_DATE = '1970-01-01';

/** Fixed snapshot for server rendering and before the first read. */
export const LOADING_SNAPSHOT: DataSnapshot = {
  status: 'loading',
  mode: 'indexeddb',
  today: SERVER_DATE,
  logs: [],
  logsByDay: [],
  state: replay([], { localDate: SERVER_DATE }),
  settings: settingDefaults(SERVER_DATE),
  latestCoach: null,
  skippedRecords: 0,
};

function compareLogsAsc(a: Log, b: Log): number {
  if (a.loggedAt !== b.loggedAt) return a.loggedAt - b.loggedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function groupByDay(logs: readonly Log[]): DayGroup[] {
  const map = new Map<string, Log[]>();
  for (const log of logs) {
    const list = map.get(log.localDate);
    if (list) list.push(log);
    else map.set(log.localDate, [log]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => ({ date, logs: [...list].sort(compareLogsAsc).reverse() }));
}

export interface StoreOptions {
  /** Turn off the midnight timer and the visibility listener. Tests only. */
  rollover?: boolean;
}

export class DataStore {
  private snapshot: DataSnapshot = LOADING_SNAPSHOT;
  private listeners = new Set<() => void>();
  private repo: Repository | null = null;
  private chain: Promise<void> = Promise.resolve();
  private readyPromise: Promise<void> | null = null;
  private unsubscribeRepo: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private readonly repoFactory: () => Promise<Repository>,
    private readonly clock: Clock,
    private readonly options: StoreOptions = {},
  ) {}

  getSnapshot = (): DataSnapshot => this.snapshot;

  getServerSnapshot = (): DataSnapshot => LOADING_SNAPSHOT;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    void this.start();
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Opens storage and loads the first snapshot. Safe to call many times. */
  start(): Promise<void> {
    if (!this.readyPromise) this.readyPromise = this.init();
    return this.readyPromise;
  }

  private async init(): Promise<void> {
    this.repo = await this.repoFactory();
    if (this.disposed) return;
    this.unsubscribeRepo = this.repo.subscribe(() => {
      void this.refresh();
    });
    await this.refresh();
    if (this.options.rollover !== false) this.startRollover();
  }

  private today(): string {
    return localParts(new Date(this.clock())).localDate;
  }

  /** Re-reads storage and publishes a new snapshot. Calls run one after another. */
  refresh(): Promise<void> {
    const run = this.chain.then(() => this.readAndPublish());
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async readAndPublish(): Promise<void> {
    const repo = this.repo;
    if (!repo || this.disposed) return;
    const today = this.today();
    const [{ items, skipped }, settings, latestCoach] = await Promise.all([
      repo.readLogs(),
      repo.readSettings(),
      repo.latestCoachMessage(),
    ]);
    const logs = [...items].sort(compareLogsAsc);
    this.snapshot = {
      status: 'ready',
      mode: repo.mode,
      today,
      logs,
      logsByDay: groupByDay(logs),
      state: replay(logs, { localDate: today }),
      settings,
      latestCoach,
      skippedRecords: skipped,
    };
    for (const l of [...this.listeners]) l();
  }

  private async repository(): Promise<Repository> {
    await this.start();
    if (!this.repo) throw new Error('Storage is not ready');
    return this.repo;
  }

  async addLog(input: NewLogInput): Promise<LogResult> {
    const repo = await this.repository();
    await this.refresh();
    const before = replay(this.snapshot.logs, { localDate: this.today() });
    const log = await repo.addLog(input);
    await this.refresh();
    const after = this.snapshot.state;
    return {
      log,
      before,
      after,
      xpGained: after.totalXp - before.totalXp,
      leveledUp: after.level > before.level,
    };
  }

  async updateLog(id: string, patch: LogPatch): Promise<void> {
    const repo = await this.repository();
    await repo.updateLog(id, patch);
    await this.refresh();
  }

  async deleteLog(id: string): Promise<void> {
    const repo = await this.repository();
    await repo.deleteLog(id);
    await this.refresh();
  }

  async saveCoachMessage(message: NewCoachMessage): Promise<CoachMessage> {
    const repo = await this.repository();
    const saved = await repo.addCoachMessage(message);
    await this.refresh();
    return saved;
  }

  async setAiEnabled(enabled: boolean): Promise<void> {
    const repo = await this.repository();
    await repo.writeSetting('aiEnabled', enabled);
    await this.refresh();
  }

  async acknowledgeFirstRun(): Promise<void> {
    const repo = await this.repository();
    await repo.writeSetting('firstRunAcknowledged', true);
    await this.refresh();
  }

  async trySpendAiCall(): Promise<boolean> {
    const repo = await this.repository();
    const allowed = await repo.trySpendAiCall();
    await this.refresh();
    return allowed;
  }

  async exportData(): Promise<ExportDocument> {
    const repo = await this.repository();
    return repo.exportAll();
  }

  async resetData(): Promise<void> {
    const repo = await this.repository();
    await repo.resetAll();
    await this.refresh();
  }

  private startRollover(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    this.armTimer();
  }

  private onVisibility = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void this.refresh();
    }
  };

  private armTimer(): void {
    if (this.disposed) return;
    const wait = msUntilNextLocalMidnight(new Date(this.clock())) + 1000;
    this.timer = setTimeout(() => {
      void this.refresh();
      this.armTimer();
    }, wait);
  }

  /** Stops timers and listeners and closes storage. */
  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.unsubscribeRepo?.();
    this.listeners.clear();
    const repo = this.repo as (Repository & { close?: () => Promise<void> }) | null;
    await repo?.close?.();
  }
}
