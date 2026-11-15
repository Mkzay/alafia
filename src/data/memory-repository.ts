import type { Log } from '@/engine/types';
import { localParts } from '@/lib/dates';
import { DataError } from './errors';
import type { Clock, ReadResult, Repository, SettingRow } from './repository';
import {
  buildCoachMessage,
  buildExport,
  buildLog,
  Emitter,
  mergePatch,
  messageIdsToPrune,
  newestMessage,
  parseCoachRows,
  parseLogRows,
  resolveSettings,
  spendBudget,
} from './repository-core';
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

/** In-memory repository. Used when IndexedDB is unavailable, and in tests. */
export class MemoryRepository implements Repository {
  readonly mode = 'memory' as const;
  private logs = new Map<string, unknown>();
  private messages = new Map<string, unknown>();
  private settings = new Map<string, unknown>();
  private emitter = new Emitter();

  constructor(private readonly clock: Clock) {}

  private today(): string {
    return localParts(new Date(this.clock())).localDate;
  }

  subscribe = this.emitter.subscribe;

  async addLog(input: NewLogInput): Promise<Log> {
    const log = buildLog(input, new Date(this.clock()));
    this.logs.set(log.id, log);
    this.emitter.notify();
    return log;
  }

  async updateLog(id: string, patch: LogPatch): Promise<Log> {
    const current = parseLogRows([this.logs.get(id)]).items[0];
    if (!current) throw new DataError('not_found', 'That log was not found');
    const next = mergePatch(current, patch);
    this.logs.set(id, next);
    this.emitter.notify();
    return next;
  }

  async deleteLog(id: string): Promise<void> {
    if (!this.logs.has(id)) return;
    this.logs.delete(id);
    for (const [mid, raw] of this.messages) {
      if ((raw as CoachMessage | undefined)?.logId === id) this.messages.delete(mid);
    }
    this.emitter.notify();
  }

  async readLogs(): Promise<ReadResult<Log>> {
    return parseLogRows([...this.logs.values()]);
  }

  async addCoachMessage(input: NewCoachMessage): Promise<CoachMessage> {
    const message = buildCoachMessage(input, this.clock());
    this.messages.set(message.id, message);
    const all = parseCoachRows([...this.messages.values()]);
    for (const id of messageIdsToPrune(all)) this.messages.delete(id);
    this.emitter.notify();
    return message;
  }

  async latestCoachMessage(): Promise<CoachMessage | null> {
    return newestMessage(parseCoachRows([...this.messages.values()]));
  }

  private settingRows(): SettingRow[] {
    return [...this.settings].map(([key, value]) => ({ key, value }));
  }

  async readSettings(): Promise<Settings> {
    return resolveSettings(this.settingRows(), this.today());
  }

  async writeSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
    this.settings.set(key, value);
    this.emitter.notify();
  }

  async trySpendAiCall(): Promise<boolean> {
    const current = resolveSettings(this.settingRows(), this.today());
    const { allowed, next } = spendBudget(current.aiBudget);
    if (allowed) {
      this.settings.set('aiBudget', next);
      this.emitter.notify();
    }
    return allowed;
  }

  async exportAll(): Promise<ExportDocument> {
    const logs = parseLogRows([...this.logs.values()]).items;
    const messages = parseCoachRows([...this.messages.values()]);
    return buildExport(logs, messages, await this.readSettings(), this.clock());
  }

  async resetAll(): Promise<void> {
    this.logs.clear();
    this.messages.clear();
    this.settings.clear();
    this.emitter.notify();
  }

  /** Test helpers: put raw, possibly invalid, records into storage. */
  injectRawLog(raw: unknown, id: string): void {
    this.logs.set(id, raw);
  }
  injectRawSetting(key: string, value: unknown): void {
    this.settings.set(key, value);
  }
}
