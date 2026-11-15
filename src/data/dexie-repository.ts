import type { Log } from '@/engine/types';
import { localParts } from '@/lib/dates';
import { BROADCAST_CHANNEL } from './constants';
import type { AlafiaDb } from './db';
import { DataError } from './errors';
import type { Clock, ReadResult, Repository } from './repository';
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
  toValidationError,
} from './repository-core';
import { settingSchemas } from './schemas';
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

const STORAGE_MESSAGE = 'We could not save that. Try again.';

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DataError) throw error;
    throw new DataError('storage', STORAGE_MESSAGE);
  }
}

/** Repository over IndexedDB through Dexie. */
export class DexieRepository implements Repository {
  readonly mode = 'indexeddb' as const;
  private emitter = new Emitter();
  private channel: BroadcastChannel | null = null;

  constructor(
    private readonly db: AlafiaDb,
    private readonly clock: Clock,
  ) {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(BROADCAST_CHANNEL);
      this.channel.onmessage = () => this.emitter.notify();
    }
  }

  subscribe = this.emitter.subscribe;

  /** Releases the cross-tab channel and closes the database. */
  async close(): Promise<void> {
    this.channel?.close();
    this.channel = null;
    this.db.close();
  }

  private changed(): void {
    this.emitter.notify();
    this.channel?.postMessage('changed');
  }

  private today(): string {
    return localParts(new Date(this.clock())).localDate;
  }

  async addLog(input: NewLogInput): Promise<Log> {
    const log = buildLog(input, new Date(this.clock()));
    await guard(() => this.db.logs.put(log as unknown as Record<string, unknown>));
    this.changed();
    return log;
  }

  async updateLog(id: string, patch: LogPatch): Promise<Log> {
    // Errors are returned, not thrown, inside the transaction. Dexie would wrap them.
    const result = await guard(() =>
      this.db.transaction('rw', this.db.logs, async (): Promise<{ log: Log } | { error: DataError }> => {
        const raw = await this.db.logs.get(id);
        const current = parseLogRows(raw ? [raw] : []).items[0];
        if (!current) return { error: new DataError('not_found', 'That log was not found') };
        try {
          const merged = mergePatch(current, patch);
          await this.db.logs.put(merged as unknown as Record<string, unknown>);
          return { log: merged };
        } catch (error) {
          if (error instanceof DataError) return { error };
          throw error;
        }
      }),
    );
    if ('error' in result) throw result.error;
    this.changed();
    return result.log;
  }
  async deleteLog(id: string): Promise<void> {
    const existed = await guard(() =>
      this.db.transaction('rw', this.db.logs, this.db.coachMessages, async () => {
        const found = (await this.db.logs.get(id)) !== undefined;
        await this.db.logs.delete(id);
        await this.db.coachMessages.where('logId').equals(id).delete();
        return found;
      }),
    );
    if (existed) this.changed();
  }

  async readLogs(): Promise<ReadResult<Log>> {
    return guard(async () => parseLogRows(await this.db.logs.toArray()));
  }

  async addCoachMessage(input: NewCoachMessage): Promise<CoachMessage> {
    const message = buildCoachMessage(input, this.clock());
    await guard(() =>
      this.db.transaction('rw', this.db.coachMessages, async () => {
        await this.db.coachMessages.put(message as unknown as Record<string, unknown>);
        const all = parseCoachRows(await this.db.coachMessages.toArray());
        const stale = messageIdsToPrune(all);
        if (stale.length > 0) await this.db.coachMessages.bulkDelete(stale);
      }),
    );
    this.changed();
    return message;
  }

  async latestCoachMessage(): Promise<CoachMessage | null> {
    return guard(async () => newestMessage(parseCoachRows(await this.db.coachMessages.toArray())));
  }

  async readSettings(): Promise<Settings> {
    return guard(async () => resolveSettings(await this.db.settings.toArray(), this.today()));
  }

  async writeSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
    const parsed = settingSchemas[key].safeParse(value);
    if (!parsed.success) throw toValidationError(parsed.error);
    await guard(() => this.db.settings.put({ key, value: parsed.data }));
    this.changed();
  }

  async trySpendAiCall(): Promise<boolean> {
    const allowed = await guard(() =>
      this.db.transaction('rw', this.db.settings, async () => {
        const row = await this.db.settings.get('aiBudget');
        const current = resolveSettings(row ? [row] : [], this.today());
        const result = spendBudget(current.aiBudget);
        if (result.allowed) await this.db.settings.put({ key: 'aiBudget', value: result.next });
        return result.allowed;
      }),
    );
    if (allowed) this.changed();
    return allowed;
  }

  async exportAll(): Promise<ExportDocument> {
    return guard(() =>
      this.db.transaction('r', this.db.logs, this.db.coachMessages, this.db.settings, async () => {
        const logs = parseLogRows(await this.db.logs.toArray()).items;
        const messages = parseCoachRows(await this.db.coachMessages.toArray());
        const settings = resolveSettings(await this.db.settings.toArray(), this.today());
        return buildExport(logs, messages, settings, this.clock());
      }),
    );
  }

  async resetAll(): Promise<void> {
    await guard(() =>
      this.db.transaction('rw', this.db.logs, this.db.coachMessages, this.db.settings, async () => {
        await this.db.logs.clear();
        await this.db.coachMessages.clear();
        await this.db.settings.clear();
      }),
    );
    this.changed();
  }
}
