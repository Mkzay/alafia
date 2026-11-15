# Data layer: Design

Implements `requirements.md` in this folder. Decisions DL-1 to DL-7 are in `docs/04-decisions.md`.

## 1. Module map
| File | Responsibility |
|---|---|
| `src/lib/ids.ts` | `newId()` using `crypto.randomUUID`, with a `getRandomValues` fallback. |
| `src/lib/dates.ts` | `localParts(date)` returns `{ localDate, localMinutes }` from a `Date` in the device time zone. `msUntilNextLocalMidnight(date)`. |
| `src/data/constants.ts` | `AI_DAILY_BUDGET = 20`, `COACH_MESSAGE_LIMIT = 200`, `DB_NAME`, `EXPORT_FORMAT_VERSION = 1`. |
| `src/data/schemas.ts` | All Zod schemas and inferred types: stored logs, log inputs, coach message, settings, export document. |
| `src/data/errors.ts` | `DataError` with a `code`: `validation`, `storage`, `not_found`. `validation` errors carry `issues: { path, message }[]`. |
| `src/data/repository.ts` | The `Repository` interface and shared types. No implementation. |
| `src/data/db.ts` | Dexie subclass, schema version 1, lazy `openDatabase()`. |
| `src/data/dexie-repository.ts` | `Repository` over IndexedDB. |
| `src/data/memory-repository.ts` | `Repository` over in-memory maps. |
| `src/data/repositories.ts` | `createRepository(clock)` tries Dexie, falls back to memory. |
| `src/data/store.ts` | `DataStore`: holds the snapshot, calls `replay`, handles refresh and rollover. Framework-free. |
| `src/data/hooks.ts` | Thin React hooks over one `DataStore` (`'use client'`). |
| `src/data/repository-contract.ts` | Shared test suite run against both repositories. Test-only. |

Boundaries: `data` imports `engine` and `lib`. `components` import only `data/hooks.ts`. Only `db.ts` and `dexie-repository.ts` import Dexie.

## 2. Schemas (`schemas.ts`)
- `localDateSchema`: string matching `YYYY-MM-DD` and a real calendar date (a round trip through `Date.UTC` must match).
- Stored log schemas mirror the engine types, one per type, joined with `z.discriminatedUnion('type', [...])`.
  - Move: `kind` enum, `minutes` integer 1 to 300, `intensity` enum.
  - Eat: `slot` enum, `checks` object of four booleans (`protein`, `veggies`, `fiberCarb`, `water`), optional `presetId`.
  - Rest: `hours` number 0 to 14 where `hours * 2` is an integer, `quality` integer 1 to 5.
  - Base fields: `id` non-empty string, `loggedAt` positive integer, `localDate`, `localMinutes` integer 0 to 1439.
- Input schemas (`moveInputSchema`, `eatInputSchema`, `restInputSchema`) hold only the type-specific fields and use `.strict()`. An unknown key such as `calories` fails with a validation error (D2.5). Stored schemas use Zod's default of stripping unknown keys on read.
- `settingsSchemas`: `aiEnabled` boolean, `aiBudget` `{ date: localDate, used: integer 0..AI_DAILY_BUDGET }`, `firstRunAcknowledged` boolean. `SETTING_DEFAULTS(today)` returns the defaults.
- `coachMessageSchema`: `id`, `logId`, `text` (1 to 240 characters), `source` (`template` | `ai`), `createdAt`.
- `exportSchema`: `{ format: 'alafia-export', version: 1, exportedAt, logs, coachMessages, settings }`.
- A type test assigns `z.infer` of each log schema to and from the engine `Log` types, so the two cannot drift.

## 3. Dexie schema (`db.ts`)
```ts
this.version(1).stores({
  logs: 'id, localDate, type, loggedAt',
  coachMessages: 'id, logId, createdAt',
  settings: 'key',
});
```
`createdAt` gets an index so pruning and "latest" are one indexed read. The database object is created inside `openDatabase()`, never at module load, so server rendering never touches `indexedDB`. `openDatabase()` calls `db.open()` and, after success, calls `navigator.storage?.persist?.()` once inside a try block (DL-5). Any open error returns `null`, which makes `createRepository` choose memory mode.

## 4. Repository interface (`repository.ts`)
```ts
type Clock = () => number; // epoch ms

interface ReadResult<T> { items: T[]; skipped: number }

interface Repository {
  readonly mode: 'indexeddb' | 'memory';
  addLog(input: NewLogInput): Promise<Log>;
  updateLog(id: string, patch: LogPatch): Promise<Log>;
  deleteLog(id: string): Promise<void>;
  readLogs(): Promise<ReadResult<Log>>;
  addCoachMessage(msg: NewCoachMessage): Promise<CoachMessage>;
  latestCoachMessage(): Promise<CoachMessage | null>;
  readSettings(): Promise<Settings>;
  writeSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>;
  trySpendAiCall(): Promise<boolean>;
  exportAll(): Promise<ExportDocument>;
  resetAll(): Promise<void>;
  subscribe(listener: () => void): () => void;
}
```
`NewLogInput` is the discriminated union of the three input schemas' types. `LogPatch` is the same union with `type` required to match the stored log, and only type-specific fields allowed (DL-2).

Both implementations follow the same rules:
- `addLog`: parse input, take `Date` from the clock, build `{ id: newId(), loggedAt, ...localParts(date) }`, parse the full log, write, then notify subscribers.
- `updateLog`: read the stored record, parse it, reject if `patch.type` differs, merge, parse again, write, notify. A missing id throws `not_found`.
- `deleteLog`: in one transaction, delete the log and every coach message with that `logId`. A missing id is a no-op.
- `readLogs`: read all records, `safeParse` each, count failures as `skipped`. Bad records stay in storage (DL-3).
- `addCoachMessage`: write, then prune to the newest 200 by `createdAt` (DL-4).
- `readSettings`: for each key, parse the stored value and fall back to the default if missing or invalid. An `aiBudget` with an old date is returned as `{ date: today, used: 0 }`.
- `trySpendAiCall`: in one `rw` transaction on `settings`, read the budget, reset it for a new day, return false if `used >= 20`, otherwise increment, write and return true.
- `exportAll`: read valid records only, build the document, parse it with `exportSchema` before returning.
- `resetAll`: one transaction that clears all three tables, then notify.
- Dexie write failures are caught and rethrown as `DataError('storage')`. Nothing is swallowed.

`dexie-repository.ts` also exposes the same change events across browser tabs through a `BroadcastChannel` named `alafia-data`, so a second open tab refreshes. This is guarded by `typeof BroadcastChannel !== 'undefined'`.

## 5. Store and snapshot (`store.ts`)
```ts
interface DataSnapshot {
  status: 'loading' | 'ready';
  mode: 'indexeddb' | 'memory';
  today: string;                 // local date
  logs: Log[];                   // valid logs, oldest first
  logsByDay: { date: string; logs: Log[] }[]; // newest day first, newest log first
  state: CharacterState;
  settings: Settings;
  latestCoach: CoachMessage | null;
  skippedRecords: number;
}

class DataStore {
  constructor(repoFactory: () => Promise<Repository>, clock: Clock);
  getSnapshot(): DataSnapshot;       // stable reference until the next refresh
  subscribe(l: () => void): () => void;
  addLog(input: NewLogInput): Promise<LogResult>;
  updateLog(...): Promise<void>;
  deleteLog(id: string): Promise<void>;
  /* settings, coach message, export, reset pass through to the repository */
}

interface LogResult { log: Log; before: CharacterState; after: CharacterState;
                      xpGained: number; leveledUp: boolean }
```
- `useSyncExternalStore` needs a snapshot that keeps its identity until data changes. The store builds a new `DataSnapshot` only inside `refresh()`, and `getSnapshot()` returns the stored object. The server snapshot is a fixed `loading` object with the engine's empty state.
- `refresh()` reads logs, settings and the latest coach message, runs `replay(logs, { localDate: today })` where `today = localParts(new Date(clock())).localDate`, and publishes a new snapshot. Refreshes are serialized so a slow read cannot overwrite a newer one.
- `addLog` computes `before` from the current snapshot, writes through the repository, refreshes, and returns `after` and `xpGained = after.totalXp - before.totalXp`. `leveledUp` is `after.level > before.level`. The coach spec builds `CoachInput` from this result. This keeps the core loop to one call and lets the UI show XP at once.
- Day rollover (DL-7): the store listens for `visibilitychange` (when visible) and sets a timer for `msUntilNextLocalMidnight`, with a one-minute margin check on wake. Either triggers `refresh()`. The timer re-arms after each fire. `dispose()` removes both. Both are skipped when `window` is undefined.
- A repository `subscribe` notification (own writes or another tab) triggers `refresh()`.

## 6. Hooks (`hooks.ts`)
One module-level `DataStore` is created lazily on first client use. Hooks:
- `useCharacter()` returns `{ state, status }`.
- `useHistory()` returns `logsByDay` and `status`.
- `useSettings()` returns settings plus `setAiEnabled`, `acknowledgeFirstRun`.
- `useLatestCoachMessage()`.
- `useStorageStatus()` returns `{ mode, skippedRecords }` for the notices.
- `useDataActions()` returns stable `addLog`, `updateLog`, `deleteLog`, `exportData`, `resetData`, `trySpendAiCall`, `saveCoachMessage`.
Each read hook uses `useSyncExternalStore(store.subscribe, () => select(store.getSnapshot()), serverSnapshot)`. Selectors return parts of the snapshot, so they keep stable identities.

## 7. Error handling
- Validation errors list field paths so forms can point to the field. They never include the raw submitted value in the message.
- Storage errors tell the UI to show a plain message ("We could not save that. Try again."). The log is not lost silently, and the caller keeps its form data.
- Open failure leads to memory mode with `mode: 'memory'`, and the UI shows the "data will not be kept" notice.
- Corrupt records are counted in `skippedRecords` and never thrown.

## 8. Test plan
- **Schemas:** valid and invalid examples at every range edge; a `calories` key is rejected on input; the type-compatibility test with the engine.
- **`lib/dates`:** local date and minutes around midnight (23:59, 00:00) and a month end, built with local `Date` components so the test is timezone-independent; `msUntilNextLocalMidnight`.
- **Repository contract** (`repository-contract.ts`), run for memory and for Dexie over `fake-indexeddb`: add, read, edit keeps time fields, edit with a mismatched type fails, delete removes coach messages, corrupt record skipped and counted and still present, settings defaults and invalid values, budget spends 20 then refuses and resets on a new date, coach message pruning at 200, export parses, reset empties.
- **Store:** add then edit then delete updates the snapshot without a reload; `LogResult` values; day rollover with a fake clock and fake timers; stable snapshot identity between refreshes; serialized refresh order.
- **Hooks:** one test file using `jsdom` and `@testing-library/react` to show that a component using `useCharacter` re-renders after `addLog` (D10.5). This needs two dev dependencies: `jsdom` and `@testing-library/react`. All other tests run in the Node environment.
- **Open failure:** a Dexie that throws on open leads to memory mode.

## 9. Out of scope
Screens, the coach orchestrator, the `/api/coach` route, and the service worker. The coach spec reads `LogResult`, `Settings` and `trySpendAiCall` from this layer.
