# Data layer: Requirements

Source: `docs/02-requirements.md` R8, R12, R14 (data parts), `docs/03-design.md` sections 2 and 10, `tech.md` rules 2, 3 and 7.
Scope: `src/data` (Dexie schema, Zod schemas, repositories, React hooks) and the small helpers in `src/lib` that it needs. No screens.

## Glossary
- **Repository**: the only code that touches storage.
- **Hook**: a React hook in `src/data/hooks.ts`. Components use hooks and never import Dexie.
- **Memory mode**: the fallback when IndexedDB is unavailable.

## D1. Storage and schema
1. THE SYSTEM SHALL store logs, coach messages and settings in IndexedDB through Dexie, in the tables from design section 2: `logs` (key `id`; indexes `localDate`, `type`, `loggedAt`), `coachMessages` (key `id`; index `logId`) and `settings` (key `key`).
2. THE SYSTEM SHALL create the database lazily on the client, so importing `src/data` during server rendering never touches `indexedDB`.
3. THE SYSTEM SHALL declare the Dexie schema as version 1 so later versions can add upgrades.
4. THE SYSTEM SHALL work with no network after the first load.

## D2. Validation
1. THE SYSTEM SHALL define a Zod schema for every persisted record (log, coach message, setting) and for the export file.
2. THE SYSTEM SHALL parse each record with its schema on read, not only on write.
3. WHEN a stored record fails parsing, THE SYSTEM SHALL skip it, keep the rest, leave the bad record in storage untouched, and report a count of skipped records so the UI can show a non-blocking notice.
4. THE Zod log schemas SHALL match the engine `Log` types exactly, including `localMinutes`, and SHALL enforce the ranges: minutes 1 to 300, hours 0 to 14 in steps of 0.5, quality 1 to 5, `localMinutes` 0 to 1439, `localDate` as a real `YYYY-MM-DD` date.
5. THE SYSTEM SHALL NOT store calories, grams or body weight in any record.

## D3. Creating logs
1. WHEN the caller supplies the log fields, THE SYSTEM SHALL assign `id`, `loggedAt`, `localDate` and `localMinutes` from an injectable clock, using the device's local time zone.
2. THE SYSTEM SHALL generate ids with `crypto.randomUUID`, with a fallback for contexts where it is missing.
3. WHEN the input fails validation, THE SYSTEM SHALL reject it with a typed error that names the field, and SHALL NOT write anything.
4. WHEN a log is saved, THE SYSTEM SHALL resolve only after the write is committed.

## D4. Editing and deleting
1. WHEN a log is edited, THE SYSTEM SHALL keep its `id`, `type`, `loggedAt`, `localDate` and `localMinutes`, and change only the type-specific fields.
2. WHEN a log is deleted, THE SYSTEM SHALL also delete the coach messages that point to it.
3. WHEN a log is edited or deleted, THE SYSTEM SHALL update every hook that reads logs or state, with no manual refresh.

## D5. Reading and state
1. THE SYSTEM SHALL return logs grouped by `localDate`, newest day first and newest log first within a day, for the History screen.
2. THE SYSTEM SHALL derive `CharacterState` only by calling the engine `replay` over the valid stored logs. The UI SHALL NOT compute stats.
3. THE SYSTEM SHALL take the `asOf` local date from the injectable clock.
4. WHEN the local date changes while the app is open (midnight, or the app returns to the foreground), THE SYSTEM SHALL recompute state.
5. WHEN there are no logs, THE SYSTEM SHALL return the engine's empty state, not an error.

## D6. Settings
1. THE SYSTEM SHALL store `aiEnabled` (default true), `aiBudget` (`{ date, used }`, default `{ today, 0 }`) and `firstRunAcknowledged` (default false).
2. WHEN a setting is missing or invalid, THE SYSTEM SHALL return its default.
3. WHEN the stored budget date differs from today's local date, THE SYSTEM SHALL treat `used` as 0.
4. THE SYSTEM SHALL expose an atomic "try to spend one AI call" operation that returns false once 20 calls have been used that day.
5. THE "Offline coach only" switch SHALL map to `aiEnabled` being false.

## D7. Coach messages
1. THE SYSTEM SHALL store each coach line with `id`, `logId`, `text`, `source` (`template` or `ai`) and `createdAt`.
2. THE SYSTEM SHALL return the latest coach message for the Home screen.
3. THE SYSTEM SHALL keep at most the 200 newest coach messages and prune older ones on write.

## D8. Export and reset
1. WHEN export is requested, THE SYSTEM SHALL return one JSON document with a format version, an export timestamp, all valid logs, all coach messages and all settings. The document SHALL pass the export Zod schema.
2. WHEN reset is requested, THE SYSTEM SHALL delete all logs, coach messages and settings in one transaction, and every hook SHALL then show the empty state.

## D9. Unavailable storage
1. WHEN IndexedDB cannot be opened (for example private mode), THE SYSTEM SHALL switch to memory mode for the session and expose a flag so the UI can show "data will not be kept".
2. THE SYSTEM SHALL give memory mode the same repository interface, so hooks and components do not change.
3. WHEN a write to IndexedDB fails after a successful open, THE SYSTEM SHALL return a typed error and SHALL NOT silently lose the log.
4. THE SYSTEM SHALL ask the browser for persistent storage once, as a best effort, and ignore a refusal.

## D10. Test requirements
1. THE SYSTEM SHALL have unit tests for the Zod schemas, the clock helpers (local date and minutes, including a midnight and a time zone change) and the memory repository.
2. THE SYSTEM SHALL run the same repository test suite against Dexie (through `fake-indexeddb`) and the memory repository.
3. THE SYSTEM SHALL have a test that corrupt records are skipped and counted, and that valid records still load.
4. THE SYSTEM SHALL have a test that export then reset then reading gives an empty state, and that the export document parses.
5. THE SYSTEM SHALL have hook tests showing that adding, editing and deleting a log updates the state without a reload.

## Decisions (approved)
Full rationale and how to change each one: `docs/04-decisions.md` (DL-1 to DL-7).
- **Q1 (DL-1).** Hooks update through a change emitter in the repository plus `useSyncExternalStore`. No `dexie-react-hooks`.
- **Q2 (DL-2).** Edits keep `loggedAt`, `localDate` and `localMinutes`. Moving a log to another day is out of scope.
- **Q3 (DL-3).** Records that fail parsing are skipped and counted, stay in storage, and are removed by Reset.
- **Q4 (DL-4).** Keep the newest 200 coach messages.
- **Q5 (DL-5).** Ask for persistent storage once, best effort.
- **Q6 (DL-6).** No import in the MVP.
- **Q7 (DL-7).** Recompute state on `visibilitychange` and at local midnight.