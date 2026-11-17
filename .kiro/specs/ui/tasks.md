# UI (spec 4): Tasks

Requirements: `requirements.md`. Design: `design.md`. Ordered as a vertical slice (UI-19): every numbered task ends with something that runs end to end.
Each task ends with `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passing. Tasks marked **STOP** wait for you.
Rules for every task: data only through `@/data/hooks` (plus `schemas` and `errors`); no clock, randomness or ids during render; copy only in `src/components/copy/`; locators in e2e use `getByRole`.

- [x] 1. Foundation and PWA
  - [x] 1.1 Tokens and fonts: CSS variables and `@theme inline` in `globals.css`, Chakra Petch 500 and 700 through `next/font/google`, remove Geist, reduced-motion rules. Add `tokens.test.ts` for contrast. _U12.1, U13.1 to U13.3, UI-8_
  - [x] 1.2 Shell: `layout.tsx` with skip link, `<main>`, `AppNav`, `ScreenHeader` with focus on route change, `Skeleton`. Stub screens for `/`, `/log`, `/history`, `/settings` that render their skeleton and heading, each with `metadata`. `error.tsx`, `not-found.tsx`, `/offline`. _U1.1 to U1.5, U10.4, U11.3, U12.3_
  - [x] 1.3 Copy files under `src/components/copy/` with the strings used so far, and `copy.test.ts`. _U13.4 to U13.6, U14.4_
  - [x] 1.4 Boundary test for `src/components` and `src/app`, and the lint rule against `Date.now`, `new Date()` and `Math.random` in components. _U14.1, U14.2, U14.7, UI-1, UI-16_
  - [x] 1.5 Manifest (`app/manifest.ts`), layout `viewport.themeColor`, icon SVG, `scripts/make-icons.tsx`, committed PNGs at 192, 512 and maskable 512. _U11.1, UI-9_
  - [x] 1.6 Serwist: add `@serwist/cli` and `esbuild`, `serwist.config.mjs`, `src/app/sw.ts` (precache, `NetworkOnly` for `/api/`, `/offline` fallback, `SKIP_WAITING` listener), `build` script `next build && serwist build`, `public/sw*` in `.gitignore`, plain production-only registration. Confirm `pnpm build` writes `public/sw.js` and its precache list includes `/`, `/log`, `/history`, `/settings` and `/offline`. _U11.2 to U11.4, U11.7, UI-3_
  - [x] 1.7 Local offline check: `pnpm build && pnpm start`, visit the four screens, go offline in a Playwright script, reload each screen and `/offline`, and record the result in `design.md` section 11.

- [ ] 2. First Vercel deploy **STOP**
  - [ ] 2.1 Ask you to link the Vercel project (or run `vercel link` together) and confirm the build command `pnpm build`. Do not deploy before you say go.
  - [ ] 2.2 Deploy. On the live URL check: manifest valid and installable (Chrome DevTools or Lighthouse PWA audit), `sw.js` served with `Cache-Control: no-cache` and active, the four shells reload with the network off, `/api/` never in Cache Storage.
  - [ ] 2.3 Write the findings and any fixes into `design.md` section 11 and `docs/04-decisions.md`. Fix blocking problems before task 3.

- [ ] 3. Home with empty state
  - [ ] 3.1 `display.ts` helpers: `xpBarFraction`, `statScale` (`max(strongest, 10)`), `streakChip`, `strongestStat`, with `display.test.ts`. _U2.3, U7.1, UI-4_
  - [ ] 3.2 `HomeScreen` with `CharacterCard` (level, `XpBar`, `StreakChip`), a placeholder avatar slot (a framed box with the accessible label from `avatarLabel`), `CoachBubble` with the welcome line, `StatList`, and `EmptyHome` with "Log your first quest". Skeleton while loading. _U2.1 to U2.6, U7.1, U7.2_
  - [ ] 3.3 `FirstRunNote` with "not medical advice" and `acknowledgeFirstRun`. _U9.5_
  - [ ] 3.4 Component tests for Home: skeleton, empty state with one action, XP bar label at level 1 and 99, streak chip states, stat bars at one tenth for a new character, first-run note.

- [ ] 4. Log screen, Move only
  - [ ] 4.1 `ui/` controls: `Button`, `Chip`, `ChipGroup`, `NumberField`, `LiveRegion`, all at least 44 by 44 px and keyboard usable. _U4.3, U12.2, U12.4_
  - [ ] 4.2 `LogScreen` sheet with the type tabs (Eat and Rest tabs present but disabled with "Coming soon" until tasks 6 and 7), close control, and `use-log-form.ts` validating with `moveInputSchema`. _U1.3, U4.1, U4.4 to U4.6_
  - [ ] 4.3 `MoveForm` with kind, minute chips plus number field, intensity, `defaults.ts` for Move, Save disabled while saving, reset on success and on hide (`use-reset-on-hide.ts`). _U5.1 to U5.4, U1.6, UI-6, UI-15_
  - [ ] 4.4 Tests: defaults, bounds 0, 1, 300, 301 and 20.5 with the copy message, the 4-tap path, a double tap saves once, validation and storage errors keep input.

- [ ] 5. Log moment on Home
  - [ ] 5.1 `moment-store.ts` (one-shot, in memory, with a `busy` flag) and the hand-off from `MoveForm` to Home. _U6.5, UI-5_
  - [ ] 5.2 `use-coach-reaction.ts`: `buildCoachInput`, `generateCoachLine` with `providers: []`, seed is the log id, `lastText` is the previous line, `saveCoachMessage`, `FALLBACK_LINE` on any failure. _U6.2, U6.6_
  - [ ] 5.3 `LogMoment` ("+N XP" or the zero-XP copy in a live region) and `LevelUpMoment` (new level, tier change), with reduced motion turning animation into a static change. `use-online.ts` and the "Offline coach" badge. _U6.1, U6.3, U6.4, U11.5, UI-2_
  - [ ] 5.4 Tests: live region text, zero XP, level up from a fresh character, tier change at level 5, reduced motion, shows once after leaving and returning, coach line saved with the log id as seed, coach failure keeps the log, moment renders on the first frame after navigation. _U4.7_
  - [ ] 5.5 Redeploy and check the slice on a phone: log a Move offline and online.

- [ ] 6. Eat
  - [ ] 6.0 Hand review of the Eat preset checks by you, before any preset is used. **STOP** _U14.6, UI-7_
  - [ ] 6.1 `eat-presets.ts` with the checks you approved in 6.0. _U5.7, U5.8, UI-7_
  - [ ] 6.2 `EatForm`: slot chips with the time-of-day default (read in a mount effect), four check toggles, preset chips that set checks and `presetId`. Enable the Eat tab. _U5.5 to U5.7, U4.8_
  - [ ] 6.3 Tests: slot defaults at 10:59, 11:00, 15:59, 16:00, 21:59, 22:00; preset fills checks and id; editing a check after a preset; no calorie, gram or weight fields in the DOM.

- [ ] 7. Rest
  - [ ] 7.1 `Stepper`, quality radio chips, `RestForm` with hour chips and the gentle short-night note at 3 hours or fewer. Enable the Rest tab. _U5.9 to U5.11_
  - [ ] 7.2 Tests: stepper bounds and steps, the note at 3 and not at 3.5 with no warning styling, quality labels, last-used defaults for each type.

- [ ] 8. History
  - [ ] 8.1 `format.ts`: `formatDay` (Today, Yesterday, "Mon 16 Nov" in UTC from the stored date), `formatTime` (12-hour), `summarize(log)`, with tests. _U8.2, U8.3, UI-17_
  - [ ] 8.2 `HistoryScreen`, `DayGroup` with day XP, `LogRow`, empty state. _U8.1, U8.7_
  - [ ] 8.3 `Dialog` (native `<dialog>`, focus return), `EditLogDialog` reusing the log forms in edit mode with `updateLog` of changed fields only, `DeleteLogDialog` with "Delete" and "Keep it". Both close on hide. _U8.4 to U8.6, U12.2, UI-11_
  - [ ] 8.4 Tests: grouping and order, edit saves only changed fields, delete confirmation, totals and Home update after edit and delete, dialogs reset on hide.

- [ ] 9. Settings and notices
  - [ ] 9.1 `Switch` and the "Offline coach only" setting bound to `aiEnabled`. _U9.4_
  - [ ] 9.2 `ExportButton` (file `alafia-export-YYYY-MM-DD.json` from `snapshot.today`), `ResetDialog` then return to Home, `AboutSection` with the license and the not-medical-advice note. _U9.1 to U9.3_
  - [ ] 9.3 `Notices`: memory-mode notice on every screen, dismissible skipped-records notice on Home. _U10.1 to U10.3_
  - [ ] 9.4 Tests: export file name and content, reset confirmation then empty Home, the switch, both notices.

- [ ] 10. Quests on Home
  - [ ] 10.1 `QuestList` with titles from `QUEST_DEFINITIONS`, done shown by icon and text, "+20 XP" when done. _U7.3, U7.4_
  - [ ] 10.2 Tests: three cards, done state not by color alone, a quest completing during a log moment updates the card.

- [ ] 11. Avatar tiers 1 and 2 (one-day time-box, UI-14)
  - [ ] 11.1 `emblem.ts` arc math with tests, `Avatar` SVG with five segments scaled by `statScale`, tier ornament and figure for tiers 1 and 2, `data-tier`, accessible label. Replace the placeholder slot on Home and in `LevelUpMoment`. _U3.1 to U3.5_
  - [ ] 11.2 Tests: `data-tier` at levels 4, 5, 9, 10, 19, 20 (tiers 3 and 4 render tier 2 art for now), segment sweep, accessible name, reduced-motion swap.
  - [ ] 11.3 Hand review of tiers 1 and 2 by you. **STOP**

- [ ] 12. Avatar tiers 3 and 4 (only if time remains)
  - [ ] 12.1 Tier 3 crest and cape, tier 4 crown and gold glow. _U3.3, U3.6_
  - [ ] 12.2 Hand review of tiers 3 and 4 by you. **STOP**

- [ ] 13. Finish
  - [ ] 13.1 `use-sw-update.ts` and `UpdateToast`, hidden on `/log` and while `busy`. Time-box one hour. If it runs over, keep the plain registration (apply on next launch, no toast), log the fallback in `docs/04-decisions.md` and update U11.6. _U11.6, UI-18_
  - [ ] 13.2 Playwright: `playwright.config.ts` with `pnpm build && pnpm start` as the web server, Chromium at 360 by 740, `@axe-core/playwright`, and `e2e/smoke.spec.ts` covering U14.5 and the axe scans. Install the Chromium browser. _U14.5, UI-10_
  - [ ] 13.3 Accessibility pass: keyboard-only run through every flow, screen reader spot checks, 320 px width and 200% zoom. _U12_
  - [ ] 13.4 Polish within the tokens. No new features.
  - [ ] 13.5 Hand review of all copy files by you. **STOP**
  - [ ] 13.6 Final deploy and the hackathon "done" check on a phone: three logs in under a minute, level up, coach reacts, airplane mode, keep logging.
  - [ ] 13.7 Update `structure.md`, the specs and `docs/04-decisions.md`, then tick these boxes.
