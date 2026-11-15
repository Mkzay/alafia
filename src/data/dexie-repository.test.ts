import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
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
