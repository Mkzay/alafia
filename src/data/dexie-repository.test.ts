import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { COACH_MESSAGE_LIMIT } from './constants';
import { AlafiaDb } from './db';
import { DexieRepository } from './dexie-repository';
import { createRepository } from './repositories';
import { runRepositoryContract } from './repository-contract';

let counter = 0;

runRepositoryContract('dexie', async (clock) => {
  const name = `alafia-test-${counter++}`;
  const db = new AlafiaDb(name);
  await db.open();
  const repo = new DexieRepository(db, clock);
  return {
    repo,
    injectRawLog: async (raw, id) => {
      const row = typeof raw === 'object' && raw !== null ? { ...raw, id } : { id, value: raw };
      await db.logs.put(row as Record<string, unknown>);
    },
    injectRawSetting: async (key, value) => {
      await db.settings.put({ key, value });
    },
    close: async () => {
      await repo.close();
      await Dexie.delete(name);
    },
  };
});

describe('dexie transactions are all-or-nothing', () => {
  const clock = () => new Date(2026, 10, 14, 9, 30).getTime();

  async function open() {
    const name = `alafia-tx-${counter++}`;
    const db = new AlafiaDb(name);
    await db.open();
    const repo = new DexieRepository(db, clock);
    return {
      db,
      repo,
      done: async () => {
        await repo.close();
        await Dexie.delete(name);
      },
    };
  }

  it('deleteLog keeps the log when removing its coach messages fails', async () => {
    const { db, repo, done } = await open();
    const log = await repo.addLog({ type: 'rest', hours: 8, quality: 3 });
    await repo.addCoachMessage({ logId: log.id, text: 'Hi.', source: 'template' });
    vi.spyOn(db.coachMessages, 'where').mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(repo.deleteLog(log.id)).rejects.toMatchObject({ code: 'storage' });
    vi.restoreAllMocks();
    expect((await repo.readLogs()).items).toEqual([log]);
    expect((await repo.latestCoachMessage())?.text).toBe('Hi.');
    await done();
  });

  it('resetAll leaves everything in place when the last table clear fails', async () => {
    const { db, repo, done } = await open();
    const log = await repo.addLog({ type: 'rest', hours: 8, quality: 3 });
    await repo.addCoachMessage({ logId: log.id, text: 'Hi.', source: 'template' });
    await repo.writeSetting('aiEnabled', false);
    vi.spyOn(db.settings, 'clear').mockRejectedValue(new Error('boom'));
    await expect(repo.resetAll()).rejects.toMatchObject({ code: 'storage' });
    vi.restoreAllMocks();
    expect((await repo.readLogs()).items).toEqual([log]);
    expect((await repo.latestCoachMessage())?.text).toBe('Hi.');
    expect((await repo.readSettings()).aiEnabled).toBe(false);
    await done();
  });

  it('addCoachMessage does not keep the new message when pruning fails', async () => {
    const { db, repo, done } = await open();
    for (let i = 0; i < COACH_MESSAGE_LIMIT; i++) {
      await db.coachMessages.put({ id: `m${i}`, logId: 'x', text: 't', source: 'template', createdAt: i + 1 });
    }
    vi.spyOn(db.coachMessages, 'bulkDelete').mockRejectedValue(new Error('boom'));
    await expect(
      repo.addCoachMessage({ logId: 'x', text: 'new one', source: 'template' }),
    ).rejects.toMatchObject({ code: 'storage' });
    vi.restoreAllMocks();
    expect(await db.coachMessages.count()).toBe(COACH_MESSAGE_LIMIT);
    expect((await repo.latestCoachMessage())?.text).not.toBe('new one');
    await done();
  });

  // A single failed put has nothing to roll back, so this test passes even without a
  // transaction. The transaction in trySpendAiCall is proven by the contract test
  // "never over-spends under concurrent calls", which fails (30 of 30 granted) without it.
  it('trySpendAiCall reports a storage error and spends nothing when the write fails', async () => {
    const { db, repo, done } = await open();
    vi.spyOn(db.settings, 'put').mockRejectedValue(new Error('boom'));
    await expect(repo.trySpendAiCall()).rejects.toMatchObject({ code: 'storage' });
    vi.restoreAllMocks();
    expect((await repo.readSettings()).aiBudget.used).toBe(0);
    await done();
  });
});

describe('createRepository', () => {
  it('uses IndexedDB when it opens', async () => {
    const repo = await createRepository(() => 1, async () => new AlafiaDb('alafia-open-ok'));
    expect(repo.mode).toBe('indexeddb');
    await (repo as DexieRepository).close();
  });

  it('falls back to memory when opening returns null', async () => {
    const repo = await createRepository(() => 1, async () => null);
    expect(repo.mode).toBe('memory');
  });

  it('falls back to memory when opening throws', async () => {
    const repo = await createRepository(
      () => 1,
      async () => {
        throw new Error('blocked');
      },
    );
    expect(repo.mode).toBe('memory');
    await expect(repo.addLog({ type: 'rest', hours: 8, quality: 3 })).resolves.toBeDefined();
  });
});
