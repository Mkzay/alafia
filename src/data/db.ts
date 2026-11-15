import Dexie from 'dexie';
import type { Table } from 'dexie';
import { DB_NAME } from './constants';
import type { SettingRow } from './repository';

type RawRow = Record<string, unknown>;

export class AlafiaDb extends Dexie {
  logs!: Table<RawRow, string>;
  coachMessages!: Table<RawRow, string>;
  settings!: Table<SettingRow, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      logs: 'id, localDate, type, loggedAt',
      coachMessages: 'id, logId, createdAt',
      settings: 'key',
    });
  }
}

/**
 * Opens the database on the client. Returns null when IndexedDB is missing or
 * cannot be opened (for example in some private modes). The database object is
 * created here, never at import time, so server rendering never touches it.
 */
export async function openDatabase(name: string = DB_NAME): Promise<AlafiaDb | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = new AlafiaDb(name);
    await db.open();
    requestPersistentStorage();
    return db;
  } catch {
    return null;
  }
}

let persistRequested = false;

/** Best effort. Asks the browser not to evict our data. A refusal is fine. */
function requestPersistentStorage(): void {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => undefined);
    }
  } catch {
    // ignore
  }
}
