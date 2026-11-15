# Data layer: Tasks

Requirements: `requirements.md`. Design: `design.md`. Work in order. Each task ends with `pnpm test`, `pnpm lint` and `pnpm typecheck` passing. Code is under `src/data` and `src/lib`.

- [ ] 1. Helpers and dependencies
  - [ ] 1.1 Add dev dependencies `jsdom` and `@testing-library/react`. Configure Vitest to use `jsdom` only for `*.dom.test.tsx` files. _D10.5_
  - [ ] 1.2 Add `src/lib/ids.ts` (`newId` with fallback) and tests. _D3.2_
  - [ ] 1.3 Add `src/lib/dates.ts` (`localParts`, `msUntilNextLocalMidnight`) and tests for 23:59, 00:00 and a month end, built from local `Date` components. _D3.1, D5.4, D10.1_
  - [ ] 1.4 Add `src/data/constants.ts` and `src/data/errors.ts` (`DataError` with `validation`, `storage`, `not_found`).

- [ ] 2. Schemas
  - [ ] 2.1 Add `schemas.ts`: `localDateSchema`, stored log schemas (discriminated union), strict input schemas, coach message, settings and defaults, export document. _D2.1, D2.4, D2.5_
  - [ ] 2.2 Unit tests at every range edge (minutes 0, 1, 300, 301; hours 0, 0.5, 14, 14.5, 0.25; quality 0, 1, 5, 6; `localMinutes` 0, 1439, 1440; invalid dates such as 2026-02-30). Test that `calories` and `weight` keys are rejected on input.
  - [ ] 2.3 Add a compile-time test that the inferred log types and the engine `Log` types are assignable both ways.

- [ ] 3. Repository contract and memory implementation
  - [ ] 3.1 Add `repository.ts` (interface and types).
  - [ ] 3.2 Add `memory-repository.ts`. _D9.2_
  - [ ] 3.3 Add `repository-contract.ts` covering every behavior in design section 8, and run it against the memory repository. _D10.2, D10.3, D10.4_

- [ ] 4. Dexie implementation
  - [ ] 4.1 Add `db.ts`: version 1 schema, lazy `openDatabase()`, one-time `persist()` request, `null` on open failure. _D1.1 to D1.3, D9.4_
  - [ ] 4.2 Add `dexie-repository.ts`, including transactions, typed storage errors and the `BroadcastChannel` refresh. _D4, D6, D7, D8, D9.3_
  - [ ] 4.3 Run the contract suite against Dexie using `fake-indexeddb`.
  - [ ] 4.4 Add `repositories.ts` (`createRepository`) and a test that a failing open falls back to memory mode. _D9.1_

- [ ] 5. Store
  - [ ] 5.1 Add `store.ts`: snapshot, serialized `refresh`, `addLog` with `LogResult`, edit, delete, settings and coach passthroughs, export and reset. _D4.3, D5.1 to D5.5_
  - [ ] 5.2 Add day rollover (timer and `visibilitychange`) with `dispose()`. _D5.4_
  - [ ] 5.3 Store tests: add, edit and delete update the snapshot; `LogResult` values; stable snapshot identity; refresh order; rollover with fake timers and a fake clock; empty state.

- [ ] 6. Hooks
  - [ ] 6.1 Add `hooks.ts` with the lazy module-level store and the hooks listed in design section 6. Mark it `'use client'`.
  - [ ] 6.2 Add `hooks.dom.test.tsx`: a component using `useCharacter` re-renders after `addLog`, edit and delete. _D10.5_

- [ ] 7. Wrap-up
  - [ ] 7.1 Add a boundary test: only `db.ts` and `dexie-repository.ts` import `dexie`; `src/data` imports nothing from `coach`, `components` or `app`; `src/data` imports `engine` only through its public files.
  - [ ] 7.2 Remove `src/data/.gitkeep` and `src/lib/.gitkeep`. Run the full suite, lint, typecheck and `pnpm build`.
  - [ ] 7.3 Update `structure.md` (new files), `docs/04-decisions.md`, and tick the boxes here.
