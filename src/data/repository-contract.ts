import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_DAILY_BUDGET, COACH_MESSAGE_LIMIT } from './constants';
import { DataError } from './errors';
import type { Repository } from './repository';
import { exportSchema } from './schemas';
import type { NewLogInput } from './schemas';

export interface Harness {
  repo: Repository;
  injectRawLog(raw: unknown, id: string): Promise<void>;
  injectRawSetting(key: string, value: unknown): Promise<void>;
  close(): Promise<void>;
}

export interface Clock {
  now: number;
  fn: () => number;
}

export type HarnessFactory = (clock: () => number) => Promise<Harness>;

const DAY1 = () => new Date(2026, 10, 14, 9, 30).getTime();
const DAY2 = () => new Date(2026, 10, 15, 8, 0).getTime();

const moveInput: Extract<NewLogInput, { type: 'move' }> = { type: 'move', kind: 'cardio', minutes: 30, intensity: 'moderate' };
const restInput: NewLogInput = { type: 'rest', hours: 8, quality: 4 };
const eatInput: NewLogInput = {
  type: 'eat',
  slot: 'lunch',
  checks: { protein: true, veggies: true, fiberCarb: false, water: false },
};

async function failure(promise: Promise<unknown>): Promise<DataError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    return e as DataError;
  }
  throw new Error('Expected the promise to reject');
}

/** One suite, run against every Repository implementation. */
export function runRepositoryContract(name: string, makeHarness: HarnessFactory): void {
  describe(`repository contract: ${name}`, () => {
    let now = DAY1();
    let h: Harness;
    let repo: Repository;

    beforeEach(async () => {
      now = DAY1();
      h = await makeHarness(() => now);
      repo = h.repo;
      await repo.resetAll();
    });

    afterEach(async () => {
      await h.close();
    });

    describe('adding logs', () => {
      it('assigns id and local time fields from the clock', async () => {
        const log = await repo.addLog(moveInput);
        expect(log.id).toBeTruthy();
        expect(log.loggedAt).toBe(now);
        expect(log.localDate).toBe('2026-11-14');
        expect(log.localMinutes).toBe(570);
        expect((await repo.readLogs()).items).toEqual([log]);
      });

      it('is committed when the promise resolves', async () => {
        await repo.addLog(restInput);
        await repo.addLog(eatInput);
        expect((await repo.readLogs()).items).toHaveLength(2);
      });

      it('rejects invalid input with field paths and writes nothing', async () => {
        const error = await failure(repo.addLog({ ...moveInput, minutes: 301 }));
        expect(error.code).toBe('validation');
        expect(error.issues.map((i) => i.path)).toContain('minutes');
        expect((await repo.readLogs()).items).toHaveLength(0);
      });

      it('rejects calories and other unknown keys', async () => {
        const bad = { ...eatInput, calories: 500 } as unknown as NewLogInput;
        expect((await failure(repo.addLog(bad))).code).toBe('validation');
        expect((await repo.readLogs()).items).toHaveLength(0);
      });
    });

    describe('editing logs', () => {
      it('changes type fields and keeps id and time fields', async () => {
        const log = await repo.addLog(moveInput);
        now = DAY2();
        const updated = await repo.updateLog(log.id, { type: 'move', minutes: 45 });
        expect(updated).toEqual({ ...log, minutes: 45 });
        expect((await repo.readLogs()).items).toEqual([updated]);
      });

      it('rejects a different type, a bad value and a missing id', async () => {
        const log = await repo.addLog(moveInput);
        expect((await failure(repo.updateLog(log.id, { type: 'rest', hours: 8 }))).code).toBe('validation');
        expect((await failure(repo.updateLog(log.id, { type: 'move', minutes: 0 }))).code).toBe('validation');
        expect((await failure(repo.updateLog('nope', { type: 'move', minutes: 5 }))).code).toBe('not_found');
        expect((await repo.readLogs()).items[0]).toEqual(log);
      });
    });

    describe('deleting logs', () => {
      it('removes the log and its coach messages only', async () => {
        const a = await repo.addLog(moveInput);
        const b = await repo.addLog(restInput);
        await repo.addCoachMessage({ logId: a.id, text: 'One.', source: 'template' });
        now += 1;
        await repo.addCoachMessage({ logId: b.id, text: 'Two.', source: 'template' });
        await repo.deleteLog(a.id);
        const doc = await repo.exportAll();
        expect(doc.logs.map((l) => l.id)).toEqual([b.id]);
        expect(doc.coachMessages.map((m) => m.text)).toEqual(['Two.']);
      });

      it('ignores a missing id', async () => {
        await expect(repo.deleteLog('nope')).resolves.toBeUndefined();
      });
    });

    describe('corrupt records', () => {
      it('skips and counts them, keeps valid ones, and leaves them stored', async () => {
        const good = await repo.addLog(moveInput);
        await h.injectRawLog({ id: 'bad1', type: 'move', minutes: -5 }, 'bad1');
        await h.injectRawLog('garbage', 'bad2');
        const first = await repo.readLogs();
        expect(first.items).toEqual([good]);
        expect(first.skipped).toBe(2);
        expect((await repo.readLogs()).skipped).toBe(2);
        expect((await repo.exportAll()).logs).toEqual([good]);
      });

      it('removes them on reset', async () => {
        await h.injectRawLog({ nope: true }, 'bad');
        await repo.resetAll();
        expect(await repo.readLogs()).toEqual({ items: [], skipped: 0 });
      });
    });

    describe('settings', () => {
      it('returns defaults for a fresh store', async () => {
        expect(await repo.readSettings()).toEqual({
          aiEnabled: true,
          aiBudget: { date: '2026-11-14', used: 0 },
          firstRunAcknowledged: false,
        });
      });

      it('stores a changed value', async () => {
        await repo.writeSetting('aiEnabled', false);
        await repo.writeSetting('firstRunAcknowledged', true);
        const s = await repo.readSettings();
        expect(s.aiEnabled).toBe(false);
        expect(s.firstRunAcknowledged).toBe(true);
      });

      it('falls back to the default for an invalid stored value', async () => {
        await h.injectRawSetting('aiEnabled', 'maybe');
        await h.injectRawSetting('aiBudget', { date: 'x', used: -3 });
        const s = await repo.readSettings();
        expect(s.aiEnabled).toBe(true);
        expect(s.aiBudget).toEqual({ date: '2026-11-14', used: 0 });
      });
    });

    describe('AI budget', () => {
      it('allows 20 calls a day, then refuses', async () => {
        const results: boolean[] = [];
        for (let i = 0; i < AI_DAILY_BUDGET + 3; i++) results.push(await repo.trySpendAiCall());
        expect(results.filter(Boolean)).toHaveLength(AI_DAILY_BUDGET);
        expect(results.slice(0, AI_DAILY_BUDGET).every(Boolean)).toBe(true);
        expect(results.slice(AI_DAILY_BUDGET).some(Boolean)).toBe(false);
        expect((await repo.readSettings()).aiBudget.used).toBe(AI_DAILY_BUDGET);
      });

      it('never over-spends under concurrent calls', async () => {
        const results = await Promise.all(Array.from({ length: 30 }, () => repo.trySpendAiCall()));
        expect(results.filter(Boolean)).toHaveLength(AI_DAILY_BUDGET);
      });

      it('resets on a new local day', async () => {
        for (let i = 0; i < AI_DAILY_BUDGET; i++) await repo.trySpendAiCall();
        expect(await repo.trySpendAiCall()).toBe(false);
        now = DAY2();
        expect((await repo.readSettings()).aiBudget).toEqual({ date: '2026-11-15', used: 0 });
        expect(await repo.trySpendAiCall()).toBe(true);
      });
    });

    describe('coach messages', () => {
      it('returns the latest message', async () => {
        const log = await repo.addLog(moveInput);
        expect(await repo.latestCoachMessage()).toBeNull();
        await repo.addCoachMessage({ logId: log.id, text: 'First.', source: 'template' });
        now += 10;
        await repo.addCoachMessage({ logId: log.id, text: 'Second.', source: 'ai' });
        expect((await repo.latestCoachMessage())?.text).toBe('Second.');
      });

      it('rejects text over 240 characters', async () => {
        const error = await failure(
          repo.addCoachMessage({ logId: 'x', text: 'a'.repeat(241), source: 'ai' }),
        );
        expect(error.code).toBe('validation');
      });

      it('keeps only the newest 200', async () => {
        const total = COACH_MESSAGE_LIMIT + 5;
        for (let i = 0; i < total; i++) {
          now += 1;
          await repo.addCoachMessage({ logId: 'x', text: `m${i}`, source: 'template' });
        }
        const doc = await repo.exportAll();
        expect(doc.coachMessages).toHaveLength(COACH_MESSAGE_LIMIT);
        expect(doc.coachMessages[0].text).toBe('m5');
        expect((await repo.latestCoachMessage())?.text).toBe(`m${total - 1}`);
      }, 30_000);
    });

    describe('export and reset', () => {
      it('exports a document that passes its schema', async () => {
        const log = await repo.addLog(eatInput);
        await repo.addCoachMessage({ logId: log.id, text: 'Nice plate.', source: 'template' });
        await repo.writeSetting('aiEnabled', false);
        const doc = await repo.exportAll();
        expect(exportSchema.safeParse(doc).success).toBe(true);
        expect(doc.logs).toEqual([log]);
        expect(doc.coachMessages).toHaveLength(1);
        expect(doc.settings.aiEnabled).toBe(false);
        expect(doc.exportedAt).toBe(now);
      });

      it('reset empties everything', async () => {
        const log = await repo.addLog(moveInput);
        await repo.addCoachMessage({ logId: log.id, text: 'Hi.', source: 'template' });
        await repo.writeSetting('aiEnabled', false);
        await repo.resetAll();
        expect(await repo.readLogs()).toEqual({ items: [], skipped: 0 });
        expect(await repo.latestCoachMessage()).toBeNull();
        expect((await repo.readSettings()).aiEnabled).toBe(true);
      });
    });

    describe('change notifications', () => {
      it('fires on every kind of change and stops after unsubscribe', async () => {
        const listener = vi.fn();
        const unsubscribe = repo.subscribe(listener);
        const log = await repo.addLog(moveInput);
        await repo.updateLog(log.id, { type: 'move', minutes: 31 });
        await repo.addCoachMessage({ logId: log.id, text: 'Hi.', source: 'template' });
        await repo.writeSetting('aiEnabled', false);
        await repo.deleteLog(log.id);
        await repo.resetAll();
        expect(listener.mock.calls.length).toBeGreaterThanOrEqual(6);
        unsubscribe();
        const before = listener.mock.calls.length;
        await repo.addLog(moveInput);
        expect(listener.mock.calls.length).toBe(before);
      });
    });
  });
}
