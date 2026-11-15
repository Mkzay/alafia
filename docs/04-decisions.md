# Alafia: Decisions Log

One place to review or change any decision. Each row says what was decided, why, what else was possible, and where it lives in the code and specs. To change one, tell Kiro the ID (for example "change ENG-5") and Kiro updates the spec, the docs and the code together.

Product-level decisions D1 to D8 stay in `01-product-brief.md` section 5.

Status values: **Approved** (you said yes), **Assumed** (Kiro chose it while building and you have not confirmed it).

## Naming
| ID | Decision | Why | Alternatives | Lives in | Status |
|---|---|---|---|---|---|
| NAME-1 | The plate check formerly called "plants" is now "veggies or fruit". Code key: `veggies`. Quest id: `mealWithVeggies`. Quest title: "Log a meal with veggies or fruit". | "Plants" read oddly. "Veggies or fruit" is plain English and fits Nigerian meals. | Key `produce`; label "Greens and fruit". | `src/engine/types.ts`, `quests.ts`, `constants.ts`, docs 02 and 03 | Approved |

## Engine (spec: `.kiro/specs/engine`)
| ID | Decision | Why | Alternatives | Lives in | Status |
|---|---|---|---|---|---|
| ENG-1 | The streak multiplier uses the streak that ends the day before the log's date. | A log's XP does not change when you add another log the same day. | Streak including today. | `replay.ts`, `xp.ts` (`applyStreakMultiplier`) | Approved |
| ENG-2 | `BaseLog` has `localMinutes` (0 to 1439), set at log time. "Before noon" means `localMinutes < 720`. | The engine cannot know the time zone, so the device records it. | Store the time zone name. | `types.ts`, `quests.ts`, `constants.ts` (`NOON_MINUTES`) | Approved |
| ENG-3 | Property 6 changed from "deleting never increases total XP" to "removing a log never changes XP on earlier dates, and log XP never exceeds the cap". | The original is false: deleting the first Rest log lets a later one earn XP. | Drop the property. | `replay.property.test.ts` | Approved |
| ENG-4 | Property 2 is tested for logs appended after all existing logs. | Adding an earlier Rest log can move the XP and lower the total. | Change the Rest rule. | `replay.property.test.ts` | Approved |
| ENG-5 | Quest bonus XP (20 each) sits on top of the 300 daily cap. | Finishing a quest is never wasted at the cap. `xpByDate` can reach 360. | Bonus counts toward the cap. | `replay.ts`, `constants.ts` (`DAILY_XP_CAP`, `QUEST_BONUS_XP`) | Approved |
| ENG-6 | Quest to stat mapping: Move 20+ min to strength and endurance; veggies meal to vitality; sleep to recovery; stretch to agility; full plate to vitality; before noon and two types to all five. | The design had no mapping. | Fixed single stat per quest. | `quests.ts` (`related`) | Approved |
| ENG-7 | When the cap trims a log's XP, the stat gets the trimmed XP split by the same targets. | Stats and total XP always agree. | Credit stats with the untrimmed XP. | `replay.ts`, `stats.ts` | Approved |
| ENG-8 | Quest titles: Move for 20 minutes; Log a meal with veggies or fruit; Log last night's sleep; Stretch for 10 minutes; Tick all four plate checks in one meal; Log something before noon; Log two different types today. | Hand-reviewed for tone. | Reword any title. | `quests.ts` (`QUEST_DEFINITIONS`) | Approved |
| ENG-9 | `xpForNext` is the XP span of the current level, so the XP bar is `xpIntoLevel / xpForNext`. At level 99 it is 0. | Gives the UI the bar length directly. | "XP remaining to the next level". | `levels.ts` (`levelProgress`) | **Assumed** |
| ENG-10 | Logs dated after `asOf.localDate` are ignored by `replay`. | Guards against clock changes and keeps replay deterministic. | Count them. | `replay.ts` | **Assumed** |
| ENG-11 | Remainders in an even split go to the first stats in the fixed order: strength, endurance, agility, vitality, recovery. | The parts always sum to the XP, and the result is the same for any input order. | Largest-remainder rounding. | `stats.ts` (`splitEvenly`, `STAT_ORDER`) | **Assumed** |
| ENG-12 | Stat XP and bonuses are computed on every replay. Nothing is cached in the engine. | Replay stays the single source of truth. | Cached snapshot (allowed by `tech.md` rule 3). | `replay.ts` | **Assumed** |

## Data layer (spec: `.kiro/specs/data-layer`)
| ID | Decision | Why | Alternatives | Lives in | Status |
|---|---|---|---|---|---|
| DL-1 | Hooks update through a change emitter in the repository and `useSyncExternalStore`. | Works the same for IndexedDB and memory mode. No extra dependency. | `dexie-react-hooks` `useLiveQuery`. | `src/data/hooks.ts`, `repositories.ts` | Approved |
| DL-2 | Editing a log keeps `loggedAt`, `localDate` and `localMinutes`. Only the type-specific fields change. | History never reshuffles. Streaks and quests stay stable. | Allow moving a log to another day. | `repositories.ts` | Approved |
| DL-3 | A record that fails Zod parsing is skipped, counted, and left in storage. Reset removes it. | A later app version could still read it. | Delete bad records on read. | `repositories.ts`, `schemas` | Approved |
| DL-4 | Keep the newest 200 coach messages. | They are small and Home shows only the latest. | Keep all; keep 50. | `repositories.ts` | Approved |
| DL-5 | Ask the browser for persistent storage once, best effort. | Protects data on low-storage phones. | Skip it. | `db.ts` | Approved |
| DL-6 | No import in the MVP. Export only. | Not in the requirements. | JSON import. | `repositories.ts` | Approved |
| DL-7 | Recompute state on `visibilitychange` and at local midnight. | "Streak at risk" is right the next morning without a reload. | Recompute only on user action. | `hooks.ts` | Approved |
| DL-8 | `addLog` returns `{ log, before, after, xpGained, leveledUp }`. | Instant XP feedback, and the coach spec gets its input from one call. | UI diffs state itself. | `store.ts` | Approved |
| DL-9 | Open tabs refresh each other through a `BroadcastChannel`. | Avoids stale state when the app is open twice. | Ignore other tabs. | `dexie-repository.ts` | Approved |
| DL-10 | Dev dependencies `jsdom` and `@testing-library/react`, used only by `*.dom.test.tsx`. | One hook test must prove re-render. | Test the store only. | `package.json`, `vitest.config.mts` | Approved |
| DL-11 | The data layer adds files beyond `structure.md`: `schemas.ts`, `errors.ts`, `repository.ts`, `store.ts`, `repository-contract.ts`, and others listed in its design. | Small files with one job each. | Fewer, larger files. | `.kiro/steering/structure.md` | Approved |
## How to change a decision
1. Tell Kiro the ID and the new choice.
2. Kiro updates the matching spec in `.kiro/specs`, the files in `docs/`, the code and the tests in one change.
3. Kiro updates this file, marking the old choice in a "Changed" note and the new status.
