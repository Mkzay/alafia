# UI (spec 4): Requirements

Source: `docs/02-requirements.md` R1 to R3, R5 to R7, R11 to R14; `docs/03-design.md` sections 9 and 10; `product.md`; `tech.md`.
Scope: every screen under `src/app`, the components under `src/components`, the web manifest, icons, the service worker, the offline page, and one Playwright smoke test.
Built only against what exists: the hooks in `src/data/hooks.ts` and the pure coach layer in `src/coach`. No changes to `src/engine`, `src/data` or `src/coach` logic.
Out of scope (spec 3b): `/api/coach`, real AI providers, the 4.5 second client wait for an AI line. Until 3b, the UI calls `generateCoachLine` with no providers, so every coach line is a template. The "Offline coach only" switch is stored now and takes effect in 3b.

Status: approved, with the changes recorded in "Decisions" at the end. The Eat preset checks are not final.

## Glossary
- **Snapshot status**: `loading` until the data store has read storage, then `ready`. Server rendering always sees `loading`.
- **Log result**: what `addLog` returns: `{ log, before, after, xpGained, leveledUp }`.
- **Log moment**: the feedback after a save: XP gained, coach line, and the level-up moment when there is one.
- **Copy**: any user-facing text in the UI.

## U1. App shell and navigation
1. THE app SHALL have four screens at `/` (Home), `/log` (Log), `/history` (History) and `/settings` (Settings), plus `/offline` (offline fallback).
2. THE Home, History and Settings screens SHALL share a bottom navigation bar with links to Home, History and Settings, and a prominent "Log" action that opens `/log`.
3. THE Log screen SHALL be presented as a full-height sheet with a close control that returns to the previous screen.
4. EACH screen SHALL set its own page title through Next.js metadata.
5. WHILE the snapshot status is `loading`, EACH screen SHALL show a skeleton of its layout, never a spinner alone and never an empty state. Screens SHALL render no data-dependent text on the server, so there is no hydration mismatch.
6. BECAUSE Cache Components keeps visited routes mounted but hidden, transient UI (confirmation dialogs, menus, the log moment, form success state) SHALL reset when its screen is hidden. Form drafts on the Log screen SHALL reset after a successful save.

## U2. Home character sheet (R11)
1. THE Home screen SHALL show, on one screen: the avatar, level, XP bar, the five stats, the streak, today's three quests, and the latest coach line.
2. ON a phone viewport of 360 by 740 CSS pixels, the avatar, level, XP bar and streak SHALL be visible without scrolling.
3. THE XP bar SHALL show `xpIntoLevel` out of `xpForNext` with a text label (for example "35 / 135 XP"). At level 99 it SHALL show as full with the label "Max level".
4. EACH stat SHALL show its name, its value and a bar. Stat names SHALL be Strength, Endurance, Agility, Vitality and Recovery.
5. WHEN there are no logs, THE Home screen SHALL show a friendly empty state with a single primary action, "Log your first quest", that opens `/log`. The avatar SHALL still show at tier 1.
6. THE coach bubble SHALL show the latest saved coach line. With no saved line it SHALL show a fixed welcome line from the copy file.

## U3. Avatar (R11.4 to R11.6, D7)
1. THE avatar SHALL be one parametric SVG component with two layers: an emblem frame with five segments, one per stat, and a character illustration inside it. No raster art.
2. EACH segment's fill length, and each stat bar on Home, SHALL be `value / max(strongest stat value, 10)` (UI-4).
3. BOTH layers SHALL change visual tier at levels 5, 10 and 20, using `avatarTier(level)` (1 to 4).
4. Colors and sizes SHALL come from CSS variables so the avatar matches the theme.
5. THE avatar SHALL have `role="img"` and an accessible name that states the level and the strongest stat, for example "Level 4 character, strongest stat Endurance". With no logs it SHALL say "Level 1 character, just getting started".
6. Tiers 1 and 2 SHALL ship first. Tiers 3 and 4 MAY reuse tier 2 with extra frame ornament if time is short (design section 9 time-box).

## U4. Log screen: shared rules (R1 to R3)
1. THE Log screen SHALL offer three types, Move, Eat and Rest, as tabs. It SHALL open on the type of the most recent log, or Move when there are no logs.
2. EACH form SHALL be prefilled with sensible defaults: the values of the most recent log of that type, or fixed defaults when there is none (Q6).
3. EVERY control SHALL be a large tap target of at least 44 by 44 CSS pixels.
4. Saving SHALL call `addLog` once. WHILE the save is in progress, the Save button SHALL be disabled so a double tap cannot create two logs.
5. WHEN `addLog` rejects with a `validation` error, THE form SHALL show a plain-language message next to the field named in the error and SHALL keep the user's input.
6. WHEN `addLog` rejects with a `storage` error, THE form SHALL show "We could not save that. Try again." and SHALL keep the user's input.
7. WHEN the save succeeds, THE app SHALL return to Home and show the log moment (U6) within 300 ms of the save resolving.
8. THE Log screen SHALL NOT display or ask for calories, grams, portion sizes or body weight.

## U5. Log forms
### Move (R1)
1. THE Move form SHALL show kind (Cardio, Strength, Mobility, Sport), minutes, and intensity (Light, Moderate, Vigorous).
2. Minutes SHALL be set with quick chips (10, 20, 30, 45, 60) and a number field for any other value.
3. WHEN minutes are outside 1 to 300 or not a whole number, THE form SHALL block saving and show "Minutes must be a whole number from 1 to 300."
4. WITH defaults in place, a Move log SHALL take at most 4 taps after the Log screen opens: type tab, kind, minutes chip, Save. Intensity keeps its default unless changed.
### Eat (R2)
5. THE Eat form SHALL show a meal slot (Breakfast, Lunch, Dinner, Snack) and four plate checks: Protein, Veggies or fruit, Fiber-rich carb, Water.
6. THE slot SHALL default from the time of day: Breakfast before 11:00, Lunch 11:00 to 15:59, Dinner 16:00 to 21:59, Snack otherwise (Q6).
7. THE form SHALL offer Nigerian food presets. Tapping a preset SHALL pre-fill its suggested checks, which the user can change before saving, and SHALL store the preset id as `presetId`.
8. THE presets SHALL be: jollof rice with chicken, beans and plantain, egusi soup with swallow, moi moi, efo riro with fish, akara and pap, fried rice with salad, yam and egg sauce, fruit and groundnuts. Their suggested checks are a hand-review gate (U14.6).
### Rest (R3)
9. THE Rest form SHALL ask for hours of sleep (0 to 14 in steps of 0.5) and quality (1 to 5, each labeled in words).
10. Hours SHALL be set with a stepper of 0.5 and quick chips (6, 7, 8, 9).
11. WHEN hours are 3 or fewer, THE form SHALL show a gentle, non-judging note from the copy file, for example "Short nights happen. Logging it still counts." It SHALL NOT show a warning style, an alarm color or any health claim.

## U6. Log moment (R1.3, R5.2, R5.3, R11.5, R9 template path)
1. AFTER a save, THE Home screen SHALL show the XP gained as "+N XP" in a polite live region. WHEN `xpGained` is 0, it SHALL show a neutral message instead, for example "Logged. No extra XP this time."
2. THE app SHALL build the coach input with `buildCoachInput` from the log result, get a line with `generateCoachLine` using `providers: []`, `seed` set to the new log's id and `lastText` set to the previous coach line, and save it with `saveCoachMessage`. The coach bubble SHALL update from the hook.
3. WHEN `leveledUp` is true, THE Home screen SHALL show a level-up moment with the new level. WHEN the avatar tier also changed, the moment SHALL show the new tier.
4. WHEN the OS requests reduced motion, every animation in the log moment and the level-up moment SHALL be replaced with a static change of state.
5. THE log moment SHALL show once per save. It SHALL NOT replay when the user leaves Home and comes back.
6. A failure while making or saving the coach line SHALL NOT block or undo the log. THE bubble SHALL then show `FALLBACK_LINE`.

## U7. Streak and quests (R6, R7)
1. THE streak chip SHALL have three states, with wording from the copy file:
   - active: "N-day streak" (with "1-day streak" for 1);
   - at risk (`streakAtRisk`): a warm prompt such as "Your 3-day streak is waiting for today's log." No countdowns, no warning colors;
   - reset (streak 0 with earlier logs): "Fresh start today." The word "broken" SHALL NOT appear.
2. WITH no logs ever, THE streak chip SHALL say "Start your streak today."
3. THE Home screen SHALL show today's three quests as cards with the title from the engine's quest list, a done state, and "+20 XP" when done.
4. A done quest SHALL be shown as done by more than color alone (an icon and text).

## U8. History (R12)
1. THE History screen SHALL list logs grouped by local day, newest day first and newest log first within a day, using `useHistory`.
2. EACH day header SHALL show a friendly date ("Today", "Yesterday", or for example "Mon 16 Nov") and the day's XP from `xpByDate`.
3. EACH log row SHALL show the type, a one-line summary (for example "Cardio, 30 min, moderate", "Lunch, 3 of 4 checks", "7.5 h sleep, quality 4") and the local time from `localMinutes`.
4. TAPPING a row SHALL open an edit view with the same form as the Log screen for that type. Saving SHALL call `updateLog` with only the type-specific fields. The date and time of a log cannot be changed (DL-2).
5. DELETE SHALL ask for confirmation in a dialog that names the log, with "Delete" and "Keep it" actions. Confirming SHALL call `deleteLog`.
6. AFTER an edit or delete, THE totals, day XP, stats, level, streak and quests SHALL update everywhere through the hooks, with no reload.
7. WITH no logs, THE History screen SHALL show an empty state with a "Log your first quest" action.

## U9. Settings and data ownership (R14, design section 9)
1. THE Settings screen SHALL offer Export, Reset, the "Offline coach only" switch, an About section and a "not medical advice" note.
2. EXPORT SHALL download the document from `exportData` as a file named `alafia-export-YYYY-MM-DD.json`, using today's local date.
3. RESET SHALL open a confirmation dialog that says plainly that every log and setting on this device will be deleted and cannot be undone, with "Delete everything" and "Cancel". Confirming SHALL call `resetData`, then return to Home, which shows the empty state.
4. THE "Offline coach only" switch SHALL be an accessible switch bound to `aiEnabled` (on means `aiEnabled` is false).
5. THE "not medical advice" note SHALL also show once on first run, on Home, until the user acknowledges it with `acknowledgeFirstRun`.

## U10. Notices and errors (design section 10)
1. WHEN the storage mode is `memory`, EVERY screen SHALL show a persistent, non-blocking notice: "Private mode: your data will not be kept after you close this tab."
2. WHEN `skippedRecords` is above 0, Home SHALL show a dismissible notice that some saved items could not be read and were skipped.
3. NO raw error, stack trace or error code SHALL be shown to the user.
4. A React error boundary (`error.tsx`) SHALL catch render errors on each screen and offer "Try again" and "Go home".

## U11. PWA and offline (R13, design section 8)
1. THE app SHALL be installable: a web manifest from `app/manifest.ts` with name, short name, `start_url` `/`, `display: standalone`, theme and background colors, and icons at 192 and 512 pixels, including a maskable icon.
2. A service worker built with Serwist SHALL precache the app shell and static assets so Home, Log, History and Settings load with no network after the first visit, including a full reload.
3. Navigations to pages that are not cached SHALL fall back to `/offline`, which explains in plain words that the page needs a connection and links back to Home.
4. THE service worker SHALL never cache `/api/coach`.
5. WHEN the device is offline, an unobtrusive "Offline coach" badge SHALL show near the coach bubble (see Q2 for how "offline" is detected).
6. WHEN a new service worker is waiting, THE app SHALL show a "New version ready" toast with a "Refresh" action. It SHALL apply the update only on tap or on the next launch, and SHALL NOT show the toast or reload while the Log screen is open or a save is in progress.
7. THE service worker SHALL be disabled in `next dev` so development is not confused by stale caches.

## U12. Accessibility and motion (WCAG AA)
1. ALL text and meaningful graphics SHALL meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text and UI components).
2. EVERY action SHALL work with keyboard only, with a visible focus ring, and with a screen reader. Dialogs SHALL trap focus and return it to the control that opened them.
3. ON each route change, focus SHALL move to the screen's main heading.
4. FORM fields SHALL have visible labels. Errors SHALL be linked to their field with `aria-describedby` and announced.
5. STATE SHALL never be shown by color alone (done quests, streak state, selected chips).
6. ALL motion SHALL be subtle and SHALL turn off when `prefers-reduced-motion: reduce` is set.
7. THE layout SHALL work from 320 CSS pixels wide and at 200% text zoom without loss of content.

## U13. Look and copy (design section 9, product voice)
1. THE look SHALL be a dark game-HUD "system window" style: high contrast, one accent color, one display font for headings and numbers plus the system font for text.
2. Design tokens (colors, spacing, radii, font sizes) SHALL live as CSS variables in `globals.css` and be used through Tailwind.
3. Fonts SHALL be self-hosted through `next/font` so the app needs no network for fonts at run time.
4. ALL copy SHALL live in one data-only file per area under `src/components/copy/`, so it can be reviewed in one place, as with the coach lines.
5. COPY SHALL be plain English in short sentences, warm and a little playful. It SHALL contain no dash characters from coach requirement C3.1 and no spaced hyphen used as a dash. Hyphenated words such as "3-day streak" are fine. It SHALL contain no pressure words (burn, shred, cheat, grind, no excuses) and SHALL NOT judge missed days, sleep or food.
6. Food examples SHALL be Nigerian where food is shown.

## U14. Boundaries and tests
1. Components SHALL get data only through `src/data/hooks.ts` and SHALL NOT import Dexie, `src/data/store`, `src/data/repositories` or any repository. They MAY import `src/data/schemas` (to validate form input with the same Zod schemas the data layer uses) and `src/data/errors` (to read error codes), because neither touches storage (UI-16).
2. Components SHALL NOT compute XP, stats, levels, streaks or quests. They MAY import the display helpers listed in Q1.
3. Component tests (Vitest, jsdom, Testing Library) SHALL cover: each log form's validation and defaults; the 4-tap Move path; the Rest short-night note; the log moment at 0 XP and on level up; reduced motion; streak chip states; history grouping, edit and delete confirmation; export file name; reset confirmation; the memory-mode notice.
4. A test SHALL check that every copy string has no dash character, no pressure word and no banned coach term.
5. ONE Playwright smoke test SHALL, against a production build: open Home, log three things (Move, Eat, Rest) and see XP and a coach line each time; see a level up; go offline with `context.setOffline(true)`, reload Home, log a Move and see XP and a template coach line; and check History shows four logs. Locators SHALL use `getByRole`, because hidden routes stay in the DOM.
6. HAND REVIEW gates, not ticked until you approve: all copy files, the Eat preset checks, and the avatar tiers.
7. A boundary test SHALL enforce U14.1 and U14.2.

## Mapping to the source requirements
- R1: U4, U5.1 to U5.4, U6.1. R2: U5.5 to U5.8, U4.8. R3: U5.9 to U5.11 (R3.2 is the engine's rule).
- R5: U2.3, U6.3, U6.4. R6: U7.1, U7.2. R7: U7.3, U7.4 (selection and bonus are the engine's).
- R11: U2, U3, U6.3, U12. R12: U8. R13: U11. R14: U9.
- Design section 9: U1 to U9, U13. Design section 10: U4.5, U4.6, U10.

## Decisions (approved)
Rationale and how to change each one: `docs/04-decisions.md`, UI-1 to UI-15.
- **Q1 (UI-1).** Components may import an allow-list from the engine: quest titles (`quests.ts`), `avatarTier` (`levels.ts`), `types.ts` and `constants.ts`. `replay`, `xp`, `stats` and `streaks` stay off-limits. A boundary test enforces it.
- **Q2 (UI-2).** Offline is detected with a small client hook over `navigator.onLine` and the `online` and `offline` events. Next's experimental `useOffline` is not used. In 3b a failed `/api/coach` call also marks the app offline.
- **Q3 (UI-3).** Serwist configurator mode: `@serwist/next/config` plus `@serwist/cli`, built with `next build && serwist build`. Adds dev dependencies `@serwist/cli` and `esbuild`. `public/sw*` is git-ignored.
- **Q4 (UI-4, changed).** Stat bars and emblem segments fill to `value / max(strongest stat value, 10)`. A new character, with every value at 1, shows bars at one tenth, not full. The number is always shown next to each bar.
- **Q5 (UI-5).** The log moment happens on Home after the save, handed over through an in-memory one-shot value that is never persisted.
- **Q6 (UI-6).** Defaults: Move is Cardio, 20 minutes, Moderate. Eat picks the slot by time of day with no checks ticked. Rest is 7.5 hours, quality 3. After the first log of a type, the last used values replace these.
- **Q7 (UI-7, not final).** Eat presets are UI data in `src/components/log/eat-presets.ts`. The suggested checks in the table below are a starting point only. You will review them separately, and the hand-review gate in U14.6 stays closed until you do.
- **Q8 (UI-8, changed).** Kiro's default dark palette and one accent color, defined as CSS variables in `globals.css` so they can be swapped later. Chakra Petch is self-hosted through `next/font/google` for headings and numbers, with the system font for text. The scaffold's Geist fonts are removed.
- **Q9 (UI-9).** The app icon is the tier 1 emblem as SVG. The 192 and 512 PNGs, including a maskable one, are generated once with Next's `ImageResponse` and committed to `public/icons/`.
- **Q10 (UI-10).** `@axe-core/playwright` is added, and the smoke test scans the four screens, failing on serious or critical issues.
- **Q11 (UI-11).** Dialog and transient state stays local and resets in a `useLayoutEffect` cleanup when the screen is hidden. No `useSearchParams`.
- **Q12 (UI-12).** Home is one scrolling page, with the avatar, level, XP bar and streak above the fold at 360 by 740.
- **UI-13 (added).** An early task deploys to Vercel and checks the Serwist build and offline behavior on the live URL before any UI polish.
- **UI-14 (added).** The avatar is time-boxed to one day of work as parametric SVG. Tiers 1 and 2 ship first.
- **UI-15 (confirmed).** Forms and transient UI reset when their screen is hidden (U1.6).

### Eat preset starting checks (not final, pending your review)
| Preset | Protein | Veggies or fruit | Fiber-rich carb |
|---|---|---|---|
| Jollof rice with chicken | yes | no | no |
| Beans and plantain | yes | no | yes |
| Egusi soup with swallow | yes | yes | no |
| Moi moi | yes | no | yes |
| Efo riro with fish | yes | yes | no |
| Akara and pap | yes | no | no |
| Fried rice with salad | no | yes | no |
| Yam and egg sauce | yes | yes | no |
| Fruit and groundnuts | yes | yes | no |

Water is never pre-ticked.
