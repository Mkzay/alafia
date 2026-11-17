# Coach core (spec 3a): Tasks

Requirements: `requirements.md`. Design: `design.md`. Work in order. Each task ends with `pnpm test`, `pnpm lint` and `pnpm typecheck` passing. Code is under `src/coach`.

- [x] 0. Prerequisites (done before this spec, recorded here)
  - [x] 0.1 Rollback tests for Dexie transactions, mutation-checked. The `trySpendAiCall` mutation fails the concurrency contract test in 5 of 5 runs.
  - [x] 0.2 Hooks: lint and typecheck on save, tests on task completion, `.kiro` guard.
  - [x] 0.3 `xpByDate` key test for 0-XP days and the key-set property test (COACH-20).

- [x] 1. Types, constants, schemas
  - [x] 1.1 Add `constants.ts`, `types.ts` (with `COACH_STATS`), `schemas.ts`. _C1_
  - [x] 1.2 Add `schemas.test.ts`: ranges (xp 360 ok, 361 rejected), extra keys rejected, type equality with the interfaces and with `StatId`, `COACH_STATS` equals `STAT_ORDER`.

- [x] 2. Banned terms, dashes, validator
  - [x] 2.1 Add `banned-terms.ts` and `banned-terms.test.ts` (forms match the ending rules, lower case, no duplicates). _C2.4_
  - [x] 2.2 Add `dashes.ts`, `dashes.test.ts`, `dashes.property.test.ts`. _C3, C10.2, C10.9_
  - [x] 2.3 Add `validate.ts`, `validate.test.ts`, `validate.property.test.ts`. _C2, C10.1, C10.7_

- [x] 3. Sanitizer
  - [x] 3.1 Add `hash.ts` and `sanitize.ts`. _C4_
  - [x] 3.2 Add `sanitize.test.ts` and `sanitize.property.test.ts`. _C10.3, C10.10_

- [x] 4. Templates
  - [x] 4.1 Add `template-lines.ts` (all user-facing lines, data only) and `templates.ts`. _C5_
  - [x] 4.3 Add `ZERO_XP_LINES` for 0-XP logs and the `{days}` plural token, with tests. _C5.4, C5.11_
  - [x] 4.2 Add `templates.test.ts` (counts, determinism, last-line avoidance, tokens, validator at both extremes, `FALLBACK_LINE` passes, no dashes in lines or quest titles, pressure words) and `templates.property.test.ts`. _C10.4, C10.8_

- [x] 5. Orchestrator
  - [x] 5.1 Add `orchestrator.ts`. _C6, C7_
  - [x] 5.2 Add `orchestrator.test.ts` with fake timers, and `orchestrator.property.test.ts`. _C10.6, C10.7_

- [ ] 6. Boundary and wrap-up
  - [x] 6.1 Add `boundary.test.ts` for `src/coach`. _C8_
  - [x] 6.2 Remove `src/coach/providers/.gitkeep` only if `providers/` gets a file (it does not in 3a, so keep it). Run the full suite, lint, typecheck and `pnpm build`.
  - [x] 6.3 Update `structure.md` and `docs/04-decisions.md`, tick these boxes.
  - [ ] 6.4 Hand review of `template-lines.ts` by the user. Do not tick until approved. _C10.5_
