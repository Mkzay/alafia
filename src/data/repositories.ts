import { openDatabase } from './db';
import type { AlafiaDb } from './db';
import { DexieRepository } from './dexie-repository';
import { MemoryRepository } from './memory-repository';
import type { Clock, Repository } from './repository';

/**
 * Returns an IndexedDB repository, or a memory repository when IndexedDB
 * cannot be opened. The caller checks `repo.mode` to show a notice.
 */
export async function createRepository(
  clock: Clock,
  open: () => Promise<AlafiaDb | null> = openDatabase,
): Promise<Repository> {
  let db: AlafiaDb | null = null;
  try {
    db = await open();
  } catch {
    db = null;
  }
  return db ? new DexieRepository(db, clock) : new MemoryRepository(clock);
}
