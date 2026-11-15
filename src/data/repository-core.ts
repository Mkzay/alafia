import type { ZodError } from 'zod';
import type { Log } from '@/engine/types';
import { localParts } from '@/lib/dates';
import { AI_DAILY_BUDGET, COACH_MESSAGE_LIMIT, EXPORT_FORMAT, EXPORT_FORMAT_VERSION } from './constants';
import { DataError } from './errors';
import type { ReadResult, SettingRow } from './repository';
import {
  coachMessageSchema,
  exportSchema,
  logPatchSchema,
  logSchema,
  newCoachMessageSchema,
  newLogInputSchema,
  SETTING_KEYS,
  settingDefaults,
  settingSchemas,
} from './schemas';
import type { CoachMessage, ExportDocument, LogPatch, NewCoachMessage, NewLogInput, Settings } from './schemas';
import { newId } from '@/lib/ids';

/** Logic shared by every repository implementation. Pure and free of storage code. */

export function toValidationError(error: ZodError): DataError {
  const issues = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  const fields = issues.map((i) => i.path || 'input').join(', ');
  return new DataError('validation', `Check these fields: ${fields}`, issues);
}

function parseOrThrow<T>(
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: ZodError } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw toValidationError(result.error);
  return result.data;
}

export function buildLog(input: NewLogInput | unknown, now: Date): Log {
  const parsed = parseOrThrow(newLogInputSchema, input);
  const { localDate, localMinutes } = localParts(now);
  return parseOrThrow(logSchema, {
    ...parsed,
    id: newId(),
    loggedAt: now.getTime(),
    localDate,
    localMinutes,
  });
}

/** Applies a patch to a stored log. Time fields and id never change. */
export function mergePatch(existing: Log, patch: LogPatch | unknown): Log {
  const parsed = parseOrThrow(logPatchSchema, patch);
  if (parsed.type !== existing.type) {
    throw new DataError('validation', 'The log type cannot be changed', [
      { path: 'type', message: 'Must match the stored log' },
    ]);
  }
  const defined = Object.fromEntries(
    Object.entries(parsed).filter(([key, v]) => key !== 'type' && v !== undefined),
  );
  return parseOrThrow(logSchema, { ...existing, ...defined });
}

export function parseLogRows(rows: readonly unknown[]): ReadResult<Log> {
  const items: Log[] = [];
  let skipped = 0;
  for (const row of rows) {
    const result = logSchema.safeParse(row);
    if (result.success) items.push(result.data);
    else skipped++;
  }
  return { items, skipped };
}

export function parseCoachRows(rows: readonly unknown[]): CoachMessage[] {
  const items: CoachMessage[] = [];
  for (const row of rows) {
    const result = coachMessageSchema.safeParse(row);
    if (result.success) items.push(result.data);
  }
  return items;
}

export function buildCoachMessage(input: NewCoachMessage | unknown, createdAt: number): CoachMessage {
  const parsed = parseOrThrow(newCoachMessageSchema, input);
  return { ...parsed, id: newId(), createdAt };
}

function compareMessagesNewestFirst(a: CoachMessage, b: CoachMessage): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export function newestMessage(messages: readonly CoachMessage[]): CoachMessage | null {
  return [...messages].sort(compareMessagesNewestFirst)[0] ?? null;
}

/** Ids of messages beyond the retention limit, oldest first. */
export function messageIdsToPrune(messages: readonly CoachMessage[]): string[] {
  return [...messages]
    .sort(compareMessagesNewestFirst)
    .slice(COACH_MESSAGE_LIMIT)
    .map((m) => m.id);
}

/** Settings with defaults for anything missing or invalid, and a budget for today. */
export function resolveSettings(rows: readonly SettingRow[], today: string): Settings {
  const defaults = settingDefaults(today);
  const out: Settings = { ...defaults };
  for (const key of SETTING_KEYS) {
    const row = rows.find((r) => r.key === key);
    if (!row) continue;
    const parsed = settingSchemas[key].safeParse(row.value);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  if (out.aiBudget.date !== today) out.aiBudget = { date: today, used: 0 };
  return out;
}

export function spendBudget(
  budget: Settings['aiBudget'],
): { allowed: boolean; next: Settings['aiBudget'] } {
  if (budget.used >= AI_DAILY_BUDGET) return { allowed: false, next: budget };
  return { allowed: true, next: { ...budget, used: budget.used + 1 } };
}

export function buildExport(
  logs: readonly Log[],
  coachMessages: readonly CoachMessage[],
  settings: Settings,
  now: number,
): ExportDocument {
  return parseOrThrow(exportSchema, {
    format: EXPORT_FORMAT,
    version: EXPORT_FORMAT_VERSION,
    exportedAt: now,
    logs: [...logs].sort((a, b) => a.loggedAt - b.loggedAt || (a.id < b.id ? -1 : 1)),
    coachMessages: [...coachMessages].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)),
    settings,
  });
}

/** Tiny change notifier shared by repository implementations. */
export class Emitter {
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  notify(): void {
    for (const l of [...this.listeners]) l();
  }
}
