# Engine: Requirements

Source: `docs/02-requirements.md` R4 to R7, `docs/03-design.md` sections 3, 4 and 7.
Scope: the pure TypeScript progression engine in `src/engine`. No UI, storage or coach code.

## Glossary
- **Log**: a `MoveLog`, `EatLog` or `RestLog` as defined in design section 2.
- **Replay**: computing `CharacterState` from a set of logs and an `asOf` local date.
- **Order**: logs are processed in ascending `(loggedAt, id)` order.
- **Stat XP**: XP routed to one of five stats: strength, endurance, agility, vitality, recovery.

## E1. Purity and determinism
1. THE ENGINE SHALL import no React, Dexie, `fetch`, or other I/O, and SHALL NOT call `Date.now()` or read the clock. Time arrives only as data (`loggedAt`, `localDate`, `asOf`).
2. THE ENGINE SHALL keep every tunable number in one `constants.ts`.
3. WHEN `replay` is called twice with the same logs and `asOf`, THE ENGINE SHALL return deeply equal results.
4. WHEN the input array is reordered, THE ENGINE SHALL return the same `CharacterState`.

## E2. XP per log
1. WHEN a Move log is valued, THE ENGINE SHALL award `round(minutes x multiplier)` with light 1.0, moderate 1.5, vigorous 2.0.
2. WHEN an Eat log is valued, THE ENGINE SHALL award 5 plus 10 per satisfied plate check (maximum 45), and only the first 5 Eat logs of a local day SHALL award XP.
3. WHEN a Rest log is valued, THE ENGINE SHALL award base XP by hours (7 to 9: 40; 6 to under 7 or over 9 up to 10: 25; otherwise 10) plus `5 x clamp(quality - 3, 0, 2)`.
4. WHEN a local day has several Rest logs, THE ENGINE SHALL award XP for the earliest one only.
5. THE ENGINE SHALL return an integer XP of 0 or more for every valid log.

## E3. Streak multiplier and daily cap
1. THE ENGINE SHALL multiply a log's XP by `1 + 0.02 x min(s, 7)` before the cap, then round to an integer, where `s` is the streak that ends the day before the log's `localDate` (decision Q1).
2. THE ENGINE SHALL cap log XP per local day at 300, applied in Order. Quest bonus XP is not counted toward this cap (decision Q5). A log that would pass the cap SHALL award only the remaining XP, and later logs that day SHALL award 0.
3. THE ENGINE SHALL still save and report logs that award 0 XP, so the coach can react to them.
4. THE ENGINE SHALL never produce a negative XP value.

## E4. Stat routing
1. THE ENGINE SHALL route XP to stats as follows: cardio to endurance; strength to strength; mobility to agility; sport 50% endurance and 50% agility; Eat to vitality; Rest to recovery; quest bonus split evenly across the stats the quest relates to.
2. WHEN a split does not divide evenly, THE ENGINE SHALL assign the remainder in a fixed stat order so the parts always sum to the awarded XP.
3. THE ENGINE SHALL compute stat value as `1 + floor(sqrt(statXp / 10))`.
4. THE ENGINE SHALL never decrease a stat when a valid log is appended after all existing logs.

## E5. Levels
1. THE ENGINE SHALL compute total XP needed for level L as `round(60 x (L - 1)^1.7)`, for L 1 to 99.
2. THE ENGINE SHALL return level, `xpIntoLevel` and `xpForNext` from total XP, with level capped at 99.
3. `xpForLevel` SHALL be strictly increasing, and `levelFromXp(xpForLevel(L))` SHALL equal L for L 1 to 99. `levelFromXp` SHALL never decrease as XP grows.
4. `avatarTier(level)` SHALL return 1 for levels 1 to 4, 2 for 5 to 9, 3 for 10 to 19, and 4 for 20 and above, and SHALL never decrease as level grows.

## E6. Streaks
1. A local day is active when at least one log has that `localDate`.
2. THE ENGINE SHALL set streak to the count of consecutive active days ending on `asOf.localDate`.
3. WHEN `asOf.localDate` has no log and the previous day is active, THE ENGINE SHALL return the streak ending yesterday with `streakAtRisk` true.
4. WHEN the most recent active day is 2 or more days before `asOf.localDate`, THE ENGINE SHALL return streak 0 and `streakAtRisk` false.
5. THE ENGINE SHALL return a streak between 0 and the number of distinct active days.

## E7. Daily quests
1. THE ENGINE SHALL select exactly 3 distinct quests per `localDate` from the quest list, using the date as the only seed. The same date SHALL always give the same 3.
2. WHEN a quest condition is met by that day's logs, THE ENGINE SHALL mark it `done` and award 20 bonus XP once (`bonusAwarded`).
3. THE ENGINE SHALL recompute quest state from the logs on every replay, so edits and deletes need no special handling.
4. THE ENGINE SHALL keep quest wording in a reviewable list, with copy checked by hand for tone.

## E8. Replay output
1. `replay(logs, asOf)` SHALL return `CharacterState` as defined in design section 3: `totalXp`, `level`, `xpIntoLevel`, `xpForNext`, `stats`, `streak`, `streakAtRisk`, `xpByDate`, `quests`.
2. Log XP per date SHALL never exceed 300. `xpByDate` SHALL include quest bonus XP, so it can reach 300 plus 20 per completed quest (at most 360).
3. Removing a log SHALL NOT change XP on any earlier local day (decision Q3).

## E9. Test requirements
1. THE ENGINE SHALL have Vitest unit tests with the worked examples from the design (30 min moderate = 45 XP; levels 2, 3, 5, 10 = 60, 195, 633, 2514).
2. THE ENGINE SHALL have fast-check property tests for each property in design section 7 that concerns the engine (1 to 7 and 10), with the corrections in Q3 and Q4. Property 6 is replaced by E8.3 and the cap rule. Property 2 is tested for logs appended after all existing logs.

## Decisions (approved)
- **Q1.** The multiplier uses the streak ending the previous day. XP for a log does not depend on other logs of the same day.
- **Q2.** `BaseLog` gains `localMinutes` (integer 0 to 1439), set on the device at log time. The "before noon" quest is `localMinutes < 720`.
- **Q3.** Property 6 is replaced. New property: removing a log never changes XP on earlier local days, and never makes log XP on any day exceed 300.
- **Q4.** Property 2 is tested for logs appended after all existing logs. The earlier-Rest edge case is accepted.
- **Q5.** Quest bonuses sit on top of the 300 log-XP cap.
- **Q6.** Quest to stat mapping: Move 20+ min: strength and endurance. Meal with plants: vitality. Log sleep: recovery. Stretch 10 min: agility. Four plate checks: vitality. Before noon: all five. Two log types: all five.
- **Q7.** When the cap cuts a log's XP, the stat gets the reduced XP split by the same ratios.