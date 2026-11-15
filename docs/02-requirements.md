# Alafia: Requirements (seed for Kiro specs)

Format: user story, then acceptance criteria in EARS style (WHEN ..., THE SYSTEM SHALL ...). Numbers refer to the tables in `03-design.md`. Parked items are at the end and are not part of the MVP.

## R1. Log a movement
As a user, I want to log a workout quickly so that my character gains XP.
1. WHEN the user opens the Log screen and picks Move, THE SYSTEM SHALL show kind (cardio, strength, mobility, sport), minutes, and intensity (light, moderate, vigorous).
2. WHEN the user submits minutes outside 1 to 300, THE SYSTEM SHALL block saving and show a plain-language message.
3. WHEN a valid Move log is saved, THE SYSTEM SHALL store it with `localDate` and show the resulting XP within 300 ms.
4. THE SYSTEM SHALL let the user complete a Move log in at most 4 taps after opening the Log screen.

## R2. Log a meal
As a user, I want to record a meal with a quick plate check, without counting calories.
1. WHEN the user picks Eat, THE SYSTEM SHALL show a meal slot (breakfast, lunch, dinner, snack) and four plate checks: protein, plants, fiber-rich carb, water.
2. WHEN the user taps a Nigerian food preset, THE SYSTEM SHALL pre-fill suggested checks that the user can change before saving.
3. THE SYSTEM SHALL NOT display or store calories, grams or body weight.
4. WHEN a valid Eat log is saved, THE SYSTEM SHALL award XP per the Eat table in design section 3.

## R3. Log rest
As a user, I want to log last night's sleep so that Recovery grows.
1. WHEN the user picks Rest, THE SYSTEM SHALL ask for hours (0 to 14, steps of 0.5) and quality (1 to 5).
2. WHEN more than one Rest log exists for a local day, THE SYSTEM SHALL award XP for only the earliest one.
3. WHEN hours are 3 or less, THE SYSTEM SHALL show a gentle note and SHALL NOT show any warning or diagnosis.

## R4. XP and stats
As a user, I want clear feedback on what each log earned.
1. THE SYSTEM SHALL compute XP with the pure engine only, never in UI code.
2. WHEN a log is saved, THE SYSTEM SHALL route its XP to the stats using the routing table in design section 3.
3. THE SYSTEM SHALL cap XP at 300 per local day. Logs beyond the cap are saved and still trigger the coach, but award 0 XP. Quest bonuses are not counted toward the cap.
4. THE SYSTEM SHALL never produce negative XP or a decrease in any stat from adding a valid log.

## R5. Levels
1. THE SYSTEM SHALL derive level from total XP using the level curve in design section 3.
2. WHEN a log causes a level increase, THE SYSTEM SHALL show a level-up moment and trigger the `level_up` coach event.
3. WHEN reduced motion is requested by the OS, THE SYSTEM SHALL replace animations with a static state change.

## R6. Streaks
1. THE SYSTEM SHALL count a day as active when it has at least one log on that `localDate`.
2. WHEN no log exists today, THE SYSTEM SHALL keep the streak that ended yesterday and show it as at risk, not broken.
3. WHEN a full local day passes with no log, THE SYSTEM SHALL reset the streak to 0 and use encouraging "fresh start" wording.
4. THE SYSTEM SHALL apply a streak multiplier of 1 plus 0.02 per streak day, up to 7 days (maximum 1.14).

## R7. Daily quests
1. THE SYSTEM SHALL show exactly 3 distinct quests per local day, chosen deterministically from the quest list using the date as the seed.
2. WHEN a quest condition is met by that day's logs, THE SYSTEM SHALL mark it complete and award its bonus XP once.
3. WHEN a log is edited or deleted, THE SYSTEM SHALL recompute quest completion from the logs.

## R8. Local data and replay
1. THE SYSTEM SHALL store all logs and settings in IndexedDB and SHALL work with no network after first load.
2. THE SYSTEM SHALL derive `CharacterState` by replaying logs through the engine in (loggedAt, id) order.
3. WHEN stored data fails Zod validation on read, THE SYSTEM SHALL skip the bad record, keep the rest, and show a non-blocking notice.

## R9. Coach
As a user, I want a short, kind reaction after logging.
1. WHEN a log is saved, THE SYSTEM SHALL show a coach line within 4.5 seconds in all cases.
2. THE SYSTEM SHALL show a template line immediately when the device is offline, when AI is switched off, or when every provider fails.
3. WHEN an AI line is returned, THE SYSTEM SHALL validate it (design section 6) and use a template line instead if validation fails.
4. THE SYSTEM SHALL send only the fields of `CoachInput` to any provider.
5. THE SYSTEM SHALL cap AI calls at 20 per device per local day and use templates after that.

## R10. Safety
1. THE SYSTEM SHALL NOT output medical advice, diagnosis, dosing, calorie or weight targets, or body-shaming language.
2. THE SYSTEM SHALL show a short "not medical advice" note in Settings and on first run.
3. THE SYSTEM SHALL keep provider keys on the server only.

## R11. Home character sheet
1. THE SYSTEM SHALL show level, XP bar, five stats, current streak, today's quests, and the latest coach line on one screen.
2. WHEN there are no logs, THE SYSTEM SHALL show a friendly empty state with a single "Log your first quest" action.
3. THE SYSTEM SHALL meet WCAG AA contrast and be fully usable by keyboard and screen reader.
4. THE SYSTEM SHALL show an avatar made of an emblem frame and a character illustration. The emblem's five segments SHALL reflect the five stat values, and both parts SHALL change visual tier at levels 5, 10 and 20.
5. WHEN the avatar changes tier, THE SYSTEM SHALL show the change as part of the level-up moment, using a static swap when reduced motion is requested.
6. THE SYSTEM SHALL give the avatar an accessible text description that states level and strongest stat.

## R12. History
1. THE SYSTEM SHALL list logs grouped by local day, newest first.
2. WHEN the user edits or deletes a log, THE SYSTEM SHALL recompute state through the engine and show the updated XP.
3. WHEN the user deletes a log, THE SYSTEM SHALL ask for confirmation.

## R13. PWA and offline
1. THE SYSTEM SHALL be installable, with a manifest and icons.
2. THE SYSTEM SHALL precache the app shell so the Home, Log, History and Settings screens load offline after the first visit.
3. WHEN the device is offline, THE SYSTEM SHALL show an unobtrusive "Offline coach" badge.
4. WHEN a new version is available, THE SYSTEM SHALL offer a refresh without interrupting a log in progress.

## R14. Data ownership
1. WHEN the user taps Export, THE SYSTEM SHALL download all logs and settings as a JSON file.
2. WHEN the user taps Reset, THE SYSTEM SHALL ask for confirmation, then delete all local data.
3. THE SYSTEM SHALL offer an "Offline coach only" switch that disables all AI calls.

## Parked (not in MVP, not planned)
- S1. FHIR R4 Observation export for sleep duration and physical activity. Decided against for now.
- S2. Optional cloud sync with accounts.
- S3. Optional on-device coach behind a download button.
