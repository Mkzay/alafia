# Engine: Design

Implements `requirements.md` in this folder. Numbers and rules come from `docs/03-design.md` sections 2 to 4, with the approved decisions Q1 to Q7.

## 1. Module map (`src/engine`)
| File | Responsibility |
|---|---|
| `constants.ts` | Every tunable number: multipliers, XP bases, cap, bonus, level curve, quest ids. |
| `types.ts` | `Log` types (with `localMinutes`), `StatId`, `CharacterState`, `QuestId`. |
| `dates.ts` | Pure `YYYY-MM-DD` helpers: `addDays`, `compareDates`. Uses `Date.UTC` arithmetic only, never the clock. |
| `levels.ts` | `xpForLevel`, `levelFromXp`, `levelProgress`, `avatarTier`. |
| `xp.ts` | `baseXp(log, ctx)`, `applyStreakMultiplier`, `applyCap`. |
| `stats.ts` | `splitEvenly`, `statsForLog`, `statValue`, quest stat mapping. |
| `streaks.ts` | `activeDates`, `streakEndingOn`, `streakAsOf`. |
| `quests.ts` | Quest definitions, `questsForDate`, `evaluateQuests`. |
| `replay.ts` | `replay(logs, asOf)`. The only function the rest of the app calls. |
| `arbitraries.ts` | fast-check generators used by tests only. |

Each file has a sibling `*.test.ts`. Property tests use `*.property.test.ts`. `engine` imports nothing outside `src/engine`. The `Log` types live in `types.ts`, so the data layer's Zod schemas must match them.

## 2. Types
```ts
export type StatId = 'strength' | 'endurance' | 'agility' | 'vitality' | 'recovery';
export const STAT_ORDER: readonly StatId[] =
  ['strength', 'endurance', 'agility', 'vitality', 'recovery'];

export type QuestId =
  | 'move20' | 'mealWithPlants' | 'logSleep' | 'stretch10'
  | 'fullPlate' | 'beforeNoon' | 'twoTypes';

// BaseLog, MoveLog, EatLog, RestLog, Log as in docs/03-design.md section 2,
// with localMinutes: number added to BaseLog.

export interface CharacterState { /* exactly as in docs/03-design.md section 3 */ }
```
`stats` is `Record<StatId, { xp: number; value: number }>`. `quests` lists the 3 quests for `asOf.localDate`.

## 3. Replay algorithm
`replay(logs, asOf)`:
1. **Filter and sort.** Drop logs with `localDate` after `asOf.localDate`. Sort the rest by `(loggedAt, id)` with plain string and number comparison (no locale).
2. **Active dates.** Build the set of `localDate` values that have a log.
3. **Group by date.** Process dates in ascending order. Within a date, logs keep sorted order. The cap, the Eat count and the Rest rule are all per date, so they reset for each group.
4. For each date `D`:
   1. `s = streakEndingOn(addDays(D, -1))`, using the active set (decision Q1).
   2. For each log in order:
      - `base = baseXp(log, ctx)`. `ctx` holds the Eat logs seen so far and whether a Rest log already awarded XP that date. An Eat log after the 5th, or a Rest log after the first, has `base = 0`.
      - `boosted = Math.round(base * (100 + 2 * min(s, 7)) / 100)`. Integer math avoids float drift.
      - `awarded = min(boosted, 300 - usedToday)`. Add `awarded` to `usedToday`.
      - Route `awarded` to stats with `statsForLog` (section 5).
   3. `quests = evaluateQuests(D, logsOfD)`. For each quest that is done, add 20 XP, routed with the quest's stat list (section 5). Bonus XP is not added to `usedToday` (decision Q5).
   4. `xpByDate[D] = usedToday + bonus`.
5. `totalXp` is the sum of `xpByDate`. Level fields come from `levelProgress(totalXp)`. Each stat's `value` is `statValue(xp)`.
6. `streak` and `streakAtRisk` come from `streakAsOf(active, asOf.localDate)`.
7. `quests` in the result are the quests for `asOf.localDate`, each with `done` and `bonusAwarded` (equal in this design, kept separate for the public type).

Complexity is `O(n log n)` for the sort, then linear. Nothing is cached in the engine.

A log that awards 0 XP stays in the input and is still counted as an active day and for quest conditions (E3.3).

## 4. Rules in detail
**Move.** `round(clampMinutes(minutes) x multiplier)`, with `clampMinutes` limiting to 1 to 300 as a safety net. Zod rejects bad input before it gets here.

**Eat.** `5 + 10 x count(true checks)`. Maximum 45 follows from four checks.

**Rest.** `hours` from 7 to 9 gives 40. `hours` from 6 up to but not including 7, or above 9 up to 10, gives 25. Everything else gives 10, including above 10. Quality bonus is `5 x clamp(quality - 3, 0, 2)`.

**Levels.** `xpForLevel(L) = Math.round(60 * (L - 1) ** 1.7)` for L 1 to 99, precomputed once into a table at module load. `levelFromXp` is a binary search over the table, capped at 99. At level 99, `xpIntoLevel = totalXp - xpForLevel(99)` and `xpForNext = 0`. `avatarTier` is a plain threshold function.

**Streaks.**
- `streakEndingOn(active, d)` counts back from `d` while each day is in the set.
- `streakAsOf(active, today)`: if today is active, `{ streak: streakEndingOn(today), atRisk: false }`. Else if yesterday is active, `{ streak: streakEndingOn(yesterday), atRisk: true }`. Else `{ streak: 0, atRisk: false }`.

## 5. Stat routing and splitting
Every route in the table is an even split over a target list, so one function covers all cases:
```ts
splitEvenly(xp: number, targets: readonly StatId[]): Partial<Record<StatId, number>>
```
Each target gets `floor(xp / n)`. The remainder `r` goes one point each to the first `r` targets in `STAT_ORDER` order. The parts always sum to `xp`.

| Source | Targets |
|---|---|
| Move cardio | endurance |
| Move strength | strength |
| Move mobility | agility |
| Move sport | endurance, agility |
| Eat | vitality |
| Rest | recovery |
| Quest move20 | strength, endurance |
| Quest mealWithPlants, fullPlate | vitality |
| Quest logSleep | recovery |
| Quest stretch10 | agility |
| Quest beforeNoon, twoTypes | all five |

Cap truncation (Q7) needs no extra code. The split is applied to the awarded XP, not the base XP.

## 6. Quests
Each quest is `{ id, title, related: StatId[], isDone(dayLogs) }`. `title` is the user-facing text and sits in one array for hand review.

| Quest | `isDone` |
|---|---|
| move20 | any Move with `minutes >= 20` |
| mealWithPlants | any Eat with `checks.plants` |
| logSleep | any Rest |
| stretch10 | any Move with `kind === 'mobility'` and `minutes >= 10` |
| fullPlate | any Eat with all four checks true |
| beforeNoon | any log with `localMinutes < 720` |
| twoTypes | at least 2 distinct `type` values |

`questsForDate(localDate)`:
1. Hash the date string with FNV-1a (32-bit) into a seed.
2. Run a mulberry32 generator from that seed.
3. Do a partial Fisher-Yates shuffle over the 7 ids in fixed list order and take the first 3.

No `Math.random`, no clock. The same date always gives the same 3, and the 3 are distinct by construction.

## 7. Error handling
The engine trusts typed input. It does not throw on valid types. Defensive clamps (minutes, quality, hours) keep XP an integer of 0 or more even if bad data slips through. Invalid dates are the caller's concern, and `dates.ts` documents the `YYYY-MM-DD` contract.

## 8. Test plan
**Unit tests** cover the worked examples (30 min moderate = 45 XP; level thresholds 60, 195, 633, 2514), each XP rule with edge values (hours 6.5, 7, 9, 9.5, 10, 10.5; Eat count 5 vs 6), `splitEvenly` remainders, streak states (active, at risk, reset), and quest done conditions.

**Property tests** (fast-check). Each property is in `*.property.test.ts`.
| Req | Property |
|---|---|
| E5.3 (P1) | `xpForLevel` strictly increasing. `levelFromXp(xpForLevel(L)) === L` for L 1 to 99. `levelFromXp` non-decreasing. |
| E2.5, E4.4 (P2) | Any valid log gives integer XP of 0 or more. Appending a log after all existing logs never lowers `totalXp` or any stat xp. |
| E1.3, E1.4 (P3) | Replay is deterministic and unchanged by shuffling the input. |
| E3.2, E8.2 (P4) | Log XP per date is at most 300. `xpByDate` is at most 300 plus 20 per quest. |
| E6 (P5) | Streak is 0 or more, at most the distinct active dates, and equals a simple reference implementation. |
| E8.3 (P6, revised) | Removing a log leaves `xpByDate` unchanged for every date before the removed log's date. |
| E7.1 (P7) | `questsForDate` returns 3 distinct ids and is stable for the same date. |
| E5.4 (P10) | `avatarTier` is 1 to 4 for L 1 to 99 and never decreases. |
| E4.2 | Sum of stat xp equals `totalXp` (routing loses nothing). |

Properties 8 and 9 belong to the coach spec. `arbitraries.ts` generates valid logs, with dates drawn from a small window so streaks, caps and quests actually trigger.

## 9. Out of scope
Persistence, Zod schemas, the coach's `CoachInput` builder, and all UI. The coach spec builds `CoachInput` from `CharacterState` and the event.
