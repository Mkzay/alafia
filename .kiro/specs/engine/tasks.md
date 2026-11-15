# Engine: Tasks

Requirements: `requirements.md`. Design: `design.md`. Work in order. Each task ends with `pnpm test`, `pnpm lint` and `pnpm typecheck` passing. All code is under `src/engine`.

- [x] 1. Foundations
  - [x] 1.1 Add `types.ts` (`StatId`, `STAT_ORDER`, `QuestId`, log types with `localMinutes`, `CharacterState`). _E8.1_
  - [x] 1.2 Add `constants.ts` with every tunable number (multipliers, XP bases, Eat limit 5, daily cap 300, quest bonus 20, streak cap 7, level curve, max level 99, noon 720). _E1.2_
  - [x] 1.3 Add `dates.ts` (`addDays`, `compareDates`) using `Date.UTC` only, with unit tests for month, year and leap-year edges. _E1.1_

- [x] 2. Levels and avatar tier
  - [x] 2.1 Implement `levels.ts`: `xpForLevel` table, `levelFromXp` (binary search, cap 99), `levelProgress`, `avatarTier`. _E5.1 to E5.4_
  - [x] 2.2 Unit tests: worked examples L2 60, L3 195, L5 633, L10 2514; level 99 progress; tier boundaries 4/5, 9/10, 19/20.
  - [x] 2.3 Property tests (P1, P10) in `levels.property.test.ts`.

- [ ] 3. XP rules
  - [ ] 3.1 Implement `xp.ts`: `baseXp` for Move, Eat and Rest, with the Eat count and first-Rest rules driven by `ctx`; `applyStreakMultiplier` with integer math; `applyCap`. _E2.1 to E2.5, E3.1, E3.2, E3.4_
  - [ ] 3.2 Unit tests: 30 min moderate = 45; Eat 0 to 4 checks; Rest hours 6.5, 7, 9, 9.5, 10, 10.5 and quality 1 to 5; Eat logs 5 vs 6; second Rest log; multiplier at streak 0, 1, 7, 10; cap cut-off mid-log.

- [ ] 4. Stats
  - [ ] 4.1 Implement `stats.ts`: `splitEvenly`, `statsForLog` using the routing table, `statValue`, quest stat lists. _E4.1 to E4.3_
  - [ ] 4.2 Unit tests: every route, sport split, remainder order, `statValue` at 0, 10, 40, 1000 XP.
  - [ ] 4.3 Property test: `splitEvenly` parts always sum to the input.

- [ ] 5. Streaks
  - [ ] 5.1 Implement `streaks.ts`: `activeDates`, `streakEndingOn`, `streakAsOf`. _E6.1 to E6.5_
  - [ ] 5.2 Unit tests: active today, at risk, one-day gap resets, two-day gap, empty input, month boundary.
  - [ ] 5.3 Property test (P5) against a simple reference implementation.

- [ ] 6. Quests
  - [ ] 6.1 Implement `quests.ts`: the seven definitions with reviewable titles, `questsForDate` (FNV-1a, mulberry32, partial Fisher-Yates), `evaluateQuests`. _E7.1 to E7.4_
  - [ ] 6.2 Unit tests: each `isDone` condition at its boundary (19 vs 20 min, 9 vs 10 min mobility, 719 vs 720 `localMinutes`, one type vs two); a fixed date always returns the same 3.
  - [ ] 6.3 Property test (P7): 3 distinct ids for any date, stable on repeat.
  - [ ] 6.4 Ask the user to review quest titles for tone. Do not mark done until they approve.

- [ ] 7. Replay
  - [ ] 7.1 Implement `replay.ts` per design section 3: filter future dates, sort by `(loggedAt, id)`, group by date, apply multiplier and cap, route stats, add quest bonuses, compute totals, level, streak and quests for `asOf`. _E1, E3, E8_
  - [ ] 7.2 Unit tests: the first-session example (a walk and a meal reaches level 2); empty input; a day that passes the cap; quest bonus on top of the cap; future-dated log ignored; deterministic repeat.

- [ ] 8. Test generators and replay properties
  - [ ] 8.1 Add `arbitraries.ts`: valid logs, dates in a 14-day window, unique ids, plausible `localMinutes`.
  - [ ] 8.2 Property tests in `replay.property.test.ts`: P2 (append never lowers totals), P3 (determinism and shuffle), P4 (cap and `xpByDate` bound), P6 revised (removal leaves earlier dates unchanged), and stat xp sums to `totalXp`.

- [ ] 9. Boundary and wrap-up
  - [ ] 9.1 Add an ESLint rule or a test that fails if any file in `src/engine` imports from `react`, `dexie`, `coach`, `data`, `components` or `app`, or uses `Date.now`, `new Date()` with no arguments, `Math.random` or `fetch`. _E1.1_
  - [ ] 9.2 Run the full suite, lint and typecheck. Remove `src/engine/.gitkeep`.
  - [ ] 9.3 Update `docs/` if any rule changed during the build, and tick the task boxes here.
