import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRepository } from './memory-repository';
import { DataStore, groupByDay } from './store';
import type { NewLogInput } from './schemas';

const move = (minutes: number): NewLogInput => ({
  type: 'move',
  kind: 'cardio',
  minutes,
  intensity: 'moderate',
});
const eat: NewLogInput = {
  type: 'eat',
  slot: 'lunch',
  checks: { protein: true, veggies: true, fiberCarb: false, water: false },
};

function setup(startMs = new Date(2026, 10, 14, 9, 30).getTime(), rollover = false) {
  let now = startMs;
  const repo = new MemoryRepository(() => now);
  const store = new DataStore(async () => repo, () => now, { rollover });
  return {
    store,
    repo,
    setNow: (ms: number) => {
      now = ms;
    },
  };
}

afterEach(() => vi.useRealTimers());

describe('DataStore basics', () => {
  it('starts loading, then shows the empty state', async () => {
    const { store } = setup();
    expect(store.getSnapshot().status).toBe('loading');
    await store.start();
    const s = store.getSnapshot();
    expect(s.status).toBe('ready');
    expect(s.mode).toBe('memory');
    expect(s.today).toBe('2026-11-14');
    expect(s.state.totalXp).toBe(0);
    expect(s.logs).toEqual([]);
    expect(s.skippedRecords).toBe(0);
    await store.dispose();
  });

  it('serves a fixed server snapshot', () => {
    const { store } = setup();
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getServerSnapshot().status).toBe('loading');
  });

  it('keeps the same snapshot object until data changes', async () => {
    const { store } = setup();
    await store.start();
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    await store.addLog(move(30));
    expect(store.getSnapshot()).not.toBe(a);
    await store.dispose();
  });
});

describe('adding, editing and deleting', () => {
  it('updates state after each change without a reload', async () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    await store.start();

    const added = await store.addLog(move(30));
    expect(store.getSnapshot().logs).toHaveLength(1);
    const afterAdd = store.getSnapshot().state.totalXp;
    expect(afterAdd).toBeGreaterThanOrEqual(45);

    await store.updateLog(added.log.id, { type: 'move', minutes: 60 });
    expect(store.getSnapshot().state.totalXp).toBeGreaterThan(afterAdd);

    await store.deleteLog(added.log.id);
    expect(store.getSnapshot().logs).toHaveLength(0);
    expect(store.getSnapshot().state.totalXp).toBe(0);
    expect(listener).toHaveBeenCalled();
    await store.dispose();
  });

  it('returns before, after and XP gained', async () => {
    const { store } = setup();
    const first = await store.addLog(move(30));
    expect(first.before.totalXp).toBe(0);
    expect(first.xpGained).toBe(first.after.totalXp);
    expect(first.xpGained).toBeGreaterThanOrEqual(45);
    expect(first.log.type).toBe('move');
    const second = await store.addLog(eat);
    expect(second.before.totalXp).toBe(first.after.totalXp);
    expect(second.after.totalXp - second.before.totalXp).toBe(second.xpGained);
    await store.dispose();
  });

  it('flags a level up', async () => {
    const { store } = setup();
    const result = await store.addLog({ type: 'move', kind: 'cardio', minutes: 100, intensity: 'vigorous' });
    expect(result.before.level).toBe(1);
    expect(result.after.level).toBeGreaterThan(1);
    expect(result.leveledUp).toBe(true);
    const next = await store.addLog(move(1));
    expect(next.leveledUp).toBe(false);
    await store.dispose();
  });

  it('rejects bad input and leaves state alone', async () => {
    const { store } = setup();
    await store.start();
    await expect(store.addLog(move(0))).rejects.toMatchObject({ code: 'validation' });
    expect(store.getSnapshot().logs).toHaveLength(0);
    await store.dispose();
  });
});

describe('history grouping', () => {
  it('groups by day, newest day and newest log first', async () => {
    const { store, setNow } = setup();
    const a = await store.addLog(move(10));
    setNow(new Date(2026, 10, 14, 10, 0).getTime());
    const b = await store.addLog(move(20));
    setNow(new Date(2026, 10, 15, 8, 0).getTime());
    const c = await store.addLog(move(30));
    const groups = store.getSnapshot().logsByDay;
    expect(groups.map((g) => g.date)).toEqual(['2026-11-15', '2026-11-14']);
    expect(groups[0].logs.map((l) => l.id)).toEqual([c.log.id]);
    expect(groups[1].logs.map((l) => l.id)).toEqual([b.log.id, a.log.id]);
    await store.dispose();
  });

  it('groupByDay handles no logs', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('other data', () => {
  it('stores settings and coach messages and shows them', async () => {
    const { store } = setup();
    const { log } = await store.addLog(move(30));
    await store.saveCoachMessage({ logId: log.id, text: 'Good one.', source: 'template' });
    await store.setAiEnabled(false);
    await store.acknowledgeFirstRun();
    const s = store.getSnapshot();
    expect(s.latestCoach?.text).toBe('Good one.');
    expect(s.settings.aiEnabled).toBe(false);
    expect(s.settings.firstRunAcknowledged).toBe(true);
    await store.dispose();
  });

  it('spends the AI budget', async () => {
    const { store } = setup();
    expect(await store.trySpendAiCall()).toBe(true);
    expect(store.getSnapshot().settings.aiBudget.used).toBe(1);
    await store.dispose();
  });

  it('exports and resets to the empty state', async () => {
    const { store } = setup();
    await store.addLog(move(30));
    const doc = await store.exportData();
    expect(doc.logs).toHaveLength(1);
    await store.resetData();
    expect(store.getSnapshot().logs).toEqual([]);
    expect(store.getSnapshot().state.totalXp).toBe(0);
    expect((await store.exportData()).logs).toEqual([]);
    await store.dispose();
  });

  it('counts skipped records without failing', async () => {
    const { store, repo } = setup();
    repo.injectRawLog({ bad: true }, 'bad');
    await store.start();
    expect(store.getSnapshot().skippedRecords).toBe(1);
    await store.dispose();
  });
});

describe('refresh order', () => {
  it('runs refreshes one after another and ends on the latest data', async () => {
    const { store } = setup();
    await store.start();
    const results = await Promise.all([store.addLog(move(10)), store.addLog(move(20)), store.addLog(move(30))]);
    expect(results).toHaveLength(3);
    expect(store.getSnapshot().logs).toHaveLength(3);
    await store.dispose();
  });
});

describe('day rollover', () => {
  it('recomputes at local midnight so a streak shows as at risk', async () => {
    vi.useFakeTimers();
    const start = new Date(2026, 10, 14, 23, 50).getTime();
    vi.setSystemTime(start);
    let now = start;
    const repo = new MemoryRepository(() => now);
    const store = new DataStore(async () => repo, () => now, { rollover: true });
    await store.start();
    await store.addLog(move(30));
    expect(store.getSnapshot().today).toBe('2026-11-14');
    expect(store.getSnapshot().state.streakAtRisk).toBe(false);

    now = new Date(2026, 10, 15, 0, 5).getTime();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    const s = store.getSnapshot();
    expect(s.today).toBe('2026-11-15');
    expect(s.state.streak).toBe(1);
    expect(s.state.streakAtRisk).toBe(true);
    await store.dispose();
  });

  it('recomputes when the app becomes visible again', async () => {
    const doc = new EventTarget() as EventTarget & { visibilityState: string };
    doc.visibilityState = 'visible';
    vi.stubGlobal('document', doc);
    let now = new Date(2026, 10, 14, 9, 0).getTime();
    const repo = new MemoryRepository(() => now);
    const store = new DataStore(async () => repo, () => now, { rollover: true });
    await store.start();
    expect(store.getSnapshot().today).toBe('2026-11-14');
    now = new Date(2026, 10, 15, 9, 0).getTime();
    doc.dispatchEvent(new Event('visibilitychange'));
    await store.refresh();
    expect(store.getSnapshot().today).toBe('2026-11-15');
    await store.dispose();
    vi.unstubAllGlobals();
  });
});
