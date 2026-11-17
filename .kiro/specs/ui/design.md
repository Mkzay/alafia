# UI (spec 4): Design

Implements `requirements.md` in this folder. Decisions UI-1 to UI-19 are in `docs/04-decisions.md`. Status: approved.
Built on Next.js 16.4 (App Router, Turbopack, `cacheComponents` and `partialPrefetching` on), React 19.3, Tailwind 4. Checked against the bundled docs in `node_modules/next/dist/docs/`.

## 1. Rendering model
- **Pages are thin Server Components.** Each `page.tsx` exports `metadata` and renders one client screen component, for example `<HomeScreen />`. Nothing in a page reads data, cookies, headers or the clock, so every route prerenders to a static shell and the service worker can precache it.
- **All data is client-side.** Screens read only from the hooks in `src/data/hooks.ts`. On the server and before the store is ready, the snapshot status is `loading`, and every screen renders its skeleton (U1.5). The real data replaces the skeleton after hydration, so there is no hydration mismatch.
- **No clock, randomness or ids during render.** With Cache Components, `Date.now()`, `new Date()`, `Math.random()` and `crypto.randomUUID()` during prerender fail the build. They are only called in effects, event handlers and the data store (which reads the clock after it subscribes). Dates shown in the UI come from `snapshot.today` and from stored `localDate` and `localMinutes`. A lint rule bans these calls in `src/components` outside effect and handler files (section 13).
- **Activity keeps up to 3 visited routes mounted but hidden.** Transient UI resets in a `useLayoutEffect` cleanup (U1.6, UI-11, UI-15). Visible-only tests use `getByRole`.
- **No `useSearchParams`, no Server Actions, no route handlers** in this spec. The only server code is the manifest.

## 2. File map
```
src/app/
  layout.tsx                 html, fonts, providers, nav, notices, SW registration
  globals.css                design tokens (section 3) and base styles
  manifest.ts                web manifest (U11.1)
  page.tsx                   Home        -> <HomeScreen />
  log/page.tsx               Log         -> <LogScreen />
  history/page.tsx           History     -> <HistoryScreen />
  settings/page.tsx          Settings    -> <SettingsScreen />
  offline/page.tsx           Offline fallback (static, no client data)
  error.tsx                  route error boundary (U10.4)
  not-found.tsx              friendly 404
  sw.ts                      service worker source (section 11)
src/components/
  copy/                      every user-facing UI string, data only (U13.4)
    common.ts home.ts log.ts history.ts settings.ts notices.ts
  shell/                     AppNav, ScreenHeader (focus on route change), Skeleton, Notices, UpdateToast
  ui/                        Button, Chip, ChipGroup, Switch, Stepper, NumberField, Dialog, Bar, LiveRegion
  home/                      HomeScreen, CharacterCard, XpBar, StatList, StreakChip, QuestList, CoachBubble, EmptyHome, FirstRunNote
  avatar/                    Avatar, emblem.ts (geometry), avatar-label.ts
  log/                       LogScreen, MoveForm, EatForm, RestForm, eat-presets.ts, defaults.ts, use-log-form.ts
  log-moment/                moment-store.ts, LogMoment, LevelUpMoment, use-coach-reaction.ts
  history/                   HistoryScreen, DayGroup, LogRow, EditLogDialog, DeleteLogDialog, format.ts
  settings/                  SettingsScreen, ExportButton, ResetDialog, AboutSection
  hooks/                     use-online.ts, use-reduced-motion.ts, use-reset-on-hide.ts, use-sw-update.ts
public/icons/                icon-192.png, icon-512.png, icon-maskable-512.png, icon.svg
scripts/make-icons.tsx       one-off PNG generation (section 12)
serwist.config.mjs           Serwist configurator (section 11)
e2e/smoke.spec.ts            Playwright smoke test
playwright.config.ts
```
Each component folder has its tests next to the code (`*.dom.test.tsx`).

## 3. Design tokens and type (UI-8)
Tokens are CSS variables on `:root` in `globals.css`, exposed to Tailwind 4 with `@theme inline`, so classes such as `bg-surface` and `text-accent` work and a token swap needs no component change.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--bg` | `#0b0f17` | page | |
| `--surface` | `#131a26` | cards, sheet | |
| `--surface-2` | `#1b2433` | inputs, chips | |
| `--line` | `#2a3547` | decorative dividers only | not used for meaningful edges |
| `--line-strong` | `#4a5a74` | focus-adjacent borders, bar tracks | 3.1:1 on `--surface` |
| `--text` | `#e8edf5` | body text | 15:1 on `--bg` |
| `--text-muted` | `#a3b0c2` | secondary text | 8:1 on `--bg` |
| `--accent` | `#2fd6c3` | primary actions, XP, focus ring | 10:1 on `--bg` |
| `--accent-ink` | `#04211e` | text on accent | 10:1 on `--accent` |
| `--gold` | `#f2c14e` | level up, quest done | 11:1 on `--bg` |
| `--stat-strength` ... `--stat-recovery` | five hues tuned to 4.5:1 on `--surface` | stat bars, emblem segments | |
| `--radius-sm/md/lg` | 6 / 10 / 16 px | | |
| `--space-1..8` | 4 px scale | | |

Exact stat hues are fixed in task 2 and checked by a contrast unit test (`tokens.test.ts`) that reads the values from `globals.css`. All contrast numbers above are verified by that test, not by this table.

- **Fonts:** Chakra Petch from `next/font/google`, weights 500 and 700 (it has no variable font), `display: 'swap'`, exposed as `--font-display`. Next downloads it at build time and serves it from the app, so no network is needed at run time. Body text uses the system stack. Geist is removed.
- **Motion:** one `--ease` and two durations. `@media (prefers-reduced-motion: reduce)` sets every duration to `0.01ms` and turns off transforms. Components also read `useReducedMotion()` to skip JS-driven effects (U6.4, U12.6).

## 4. Shell and navigation (U1)
- `layout.tsx` renders `<html lang="en">`, `<body>`, a skip link, `<Notices />`, `<main id="main">{children}</main>`, `<AppNav />` and `<UpdateToast />`.
- `AppNav` is a bottom bar with Home, History and Settings links (`next/link`, so their shells prefetch) and a centered "Log" button that links to `/log`. It hides on `/log` (checked with `usePathname`, which is fine without Suspense).
- `ScreenHeader` renders the screen's `<h1 tabIndex={-1}>` and focuses it in an effect when the route becomes visible, which also runs when Activity re-shows a route (U12.3).
- `/log` renders as a full-height sheet. The close button calls `router.back()`, or `router.push('/')` when there is no history entry.
- `Skeleton` blocks match each screen's layout boxes, with `aria-busy="true"` on the screen container while loading.

## 5. Home (U2, U7)
`HomeScreen` composition, top to bottom:
1. `FirstRunNote` (U9.5) until acknowledged.
2. `CharacterCard`: `Avatar`, level, `XpBar`, `StreakChip`. This block is sized to fit above the fold at 360 by 740 (U2.2, UI-12).
3. `LogMoment` (section 7), when there is a pending moment.
4. `CoachBubble`, with the "Offline coach" badge from `useOnline()` (U11.5).
5. `QuestList`: three cards from `state.quests`, titles from `QUEST_DEFINITIONS`, a check icon plus the text "Done, +20 XP" when done (U7.3, U7.4).
6. `StatList`: five rows of name, value and `Bar`.
7. `EmptyHome` replaces items 3 to 6 when `logsByDay` is empty, with the single action "Log your first quest" (U2.5).

**Display helpers** (pure, tested, in `src/components/home/display.ts`). They format engine output and compute nothing about game rules:
- `xpBarFraction(state)`: `xpIntoLevel / xpForNext`, or 1 at level 99. Label "35 / 135 XP" or "Max level".
- `statScale(stats)`: `max(max(values), 10)`. Each bar is `value / scale` (UI-4). Shared with the avatar.
- `streakChip(state, hasLogs)`: returns `'start' | 'active' | 'atRisk' | 'fresh'` and the copy key. "fresh" is streak 0 with earlier logs.
- `strongestStat(stats)`: highest `xp`, ties in `STAT_ORDER`, for the avatar label.

## 6. Avatar (U3, UI-14)
One `<svg viewBox="0 0 200 200" role="img" aria-label={label}>` with two groups, driven by props `{ level, stats }` and CSS variables.
- **Emblem frame:** five ring segments around the center, 72 degrees each with a 6 degree gap, starting at the top and going clockwise in `STAT_ORDER`. Each segment draws a background arc in `--line-strong` and a fill arc in its stat color whose sweep is `fraction x 66 degrees`, with `fraction = value / statScale`. The arc path math is in `emblem.ts` (`arcPath(cx, cy, r, startDeg, endDeg)`) and is unit-tested for endpoints.
- **Tier ornament:** `avatarTier(level)` sets `data-tier` on the svg. Tier 1: plain ring. Tier 2: an outer thin ring and four notch marks. Tiers 3 and 4: tier 2 plus a pointed crest at the top (3) and a gold glow filter (4). Each tier is a small `<g>` shown with CSS `[data-tier]` selectors, so swapping tiers is a static change (U3.3).
- **Character:** a simple front-facing figure drawn with circles and rounded rects (head, torso, arms, legs) in `--text`, with tier accessories: tier 1 a headband, tier 2 adds a shoulder pad and a scarf, tier 3 a cape, tier 4 a crown and glow. Tiers 1 and 2 are drawn first. If the one-day time-box runs out, tiers 3 and 4 reuse tier 2's figure with only the frame ornament changed (U3.6).
- **Label:** `avatarLabel(level, stats, hasLogs)` gives "Level 4 character, strongest stat Endurance" or "Level 1 character, just getting started" (U3.5). The svg's inner shapes are `aria-hidden`.
- **Tier change:** when a log moment has a new tier, `LevelUpMoment` shows the new avatar. With motion allowed, the frame scales from 0.9 to 1 over 400 ms. With reduced motion, it swaps with no animation (R11.5, U6.4).

## 7. Log flow and log moment (U4 to U6, UI-5)
### Forms
- `LogScreen` holds the type tab state (`Move | Eat | Rest`, initial from the latest log's type, U4.1) and renders one form. Tabs are a `role="tablist"` with arrow-key support.
- `use-log-form.ts` is a small reducer per form: fields, a `saving` flag and a field-error map. Validation uses the input schemas from `@/data/schemas` (`moveInputSchema` and the others), so the UI and the data layer apply the same rules (UI-16). A Zod issue's `path[0]` picks the field, and the message comes from the copy file, not from Zod.
- `defaults.ts`: `defaultsFor(type, logs, minutesNow)` returns the latest log of that type's fields, or the fixed defaults (UI-6). For Eat, the slot comes from `slotForMinutes(minutesNow)` (U5.6) and checks start unticked. `minutesNow` is read with `localParts(new Date())` from `@/lib/dates` in a mount effect, never during render.
- Move: kind `ChipGroup`, minutes `ChipGroup` (10, 20, 30, 45, 60) plus a `NumberField`, intensity `ChipGroup`. The 4-tap path (U5.4) is tab, kind, minutes chip, Save, and a test counts the user events.
- Eat: slot `ChipGroup`, four check toggles (`role="checkbox"`, label plus icon), a preset `ChipGroup` from `eat-presets.ts`. Tapping a preset sets its checks and `presetId`. Changing a check afterwards keeps `presetId`.
- Rest: hours `Stepper` (0 to 14, step 0.5) plus chips (6, 7, 8, 9), quality as five labeled radio chips. When hours are 3 or fewer, a `<p>` with the gentle note appears below hours, in muted text with no warning color or icon (U5.11).
- Save: disabled while `saving` (U4.4). On a `validation` DataError, map `issues[].path` to fields. On a `storage` error, show the storage message at the top of the form (U4.5, U4.6). Input is kept in both cases.
- On success: reset the form, `momentStore.set(result)`, then `router.push('/')`. The form also resets on hide via `useResetOnHide` (U1.6).

### Moment store (`log-moment/moment-store.ts`)
A module-level one-shot value: `{ id: string; result: LogResult } | null` with `set`, `take` and a `subscribe` for `useSyncExternalStore`. Home reads it, shows the moment, and calls `take` after the moment has been shown, so leaving and returning does not replay it (U6.5). It lives in memory only and is never persisted.

### Coach reaction (`log-moment/use-coach-reaction.ts`)
Runs once per moment id, in an effect:
1. `input = buildCoachInput({ before, after, logType: log.type, logDate: log.localDate, localMinutes: log.localMinutes })`.
2. `out = await generateCoachLine({ input, providers: [], online, aiEnabled: settings.aiEnabled, spendAiCall: trySpendAiCall, seed: log.id, lastText: latestCoach?.text })`. With `providers: []` this is always the template path and never spends budget (coach C6.3). 3b swaps in a client that calls `/api/coach`.
3. `await saveCoachMessage({ logId: log.id, text: out.text, source: out.source })`. The bubble updates from `useLatestCoachMessage`.
4. Any thrown error: save `FALLBACK_LINE` instead. If that save also fails, show `FALLBACK_LINE` in the bubble without saving (U6.6). The log is never touched.

### Moment UI
- `LogMoment` shows "+N XP" (or the zero-XP copy) in a `LiveRegion` (`aria-live="polite"`) and a short accent pulse on the XP bar. It fades after 4 seconds, or stays until dismissed when reduced motion is on.
- `LevelUpMoment` shows when `leveledUp`: "Level N!" in `--gold` with the avatar, and the tier change when `avatarTier(after.level) > avatarTier(before.level)` (U6.3).
- Timing: Home renders the moment from the in-memory result on the first frame after navigation, so it shows well within 300 ms of the save resolving (U4.7). A component test checks it renders synchronously from the store.

## 8. History (U8)
- `HistoryScreen` maps `logsByDay` to `DayGroup`s. Headers use `formatDay(date, today)`: "Today", "Yesterday", or `Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })` on `Date.UTC` of the stored date, which gives "Mon 16 Nov" and cannot shift with the device time zone. Day XP comes from `state.xpByDate[date]`.
- `LogRow` shows a type icon, `summarize(log)` ("Cardio, 30 min, moderate", "Lunch, 3 of 4 checks", "7.5 h sleep, quality 4") and `formatTime(localMinutes)` as 12-hour time ("9:30 am") (UI-17). The row is a button that opens `EditLogDialog`.
- `EditLogDialog` is a native `<dialog>` opened with `showModal()`, which makes the rest of the page inert. It renders the same form component as `/log` in edit mode, prefilled from the log. Save calls `updateLog(id, patch)` with only the changed type-specific fields. It has a "Delete" button that opens `DeleteLogDialog`.
- `DeleteLogDialog` names the log ("Delete Cardio, 30 min from Today?") with "Delete" and "Keep it". Focus returns to the row that opened it (U12.2).
- Both dialogs close in a `useLayoutEffect` cleanup when History is hidden (UI-11).

## 9. Settings (U9)
- `ExportButton`: `const doc = await exportData()`, then a `Blob` of `JSON.stringify(doc, null, 2)` downloaded through a temporary `<a download="alafia-export-${today}.json">` and `URL.revokeObjectURL` afterwards. `today` is `snapshot.today` (U9.2).
- `ResetDialog`: the plain warning text, "Delete everything" and "Cancel". Confirm calls `resetData()`, then `router.push('/')` (U9.3).
- The "Offline coach only" `Switch` is a `button role="switch" aria-checked`, bound to `!settings.aiEnabled` (U9.4). Its help text says AI lines arrive in a later update, until 3b ships.
- `AboutSection` shows the app name, the MIT license and the "not medical advice" note from the copy file (U9.1).

## 10. Notices, offline and errors (U10, U11.5)
- `Notices` in the layout reads `useStorageStatus()`. In memory mode it shows the persistent private-mode notice (U10.1). With `skippedRecords > 0` it shows a dismissible notice on Home, with dismissal kept in component state for the session (U10.2).
- `useOnline()` uses `useSyncExternalStore` over `navigator.onLine` and the `online` and `offline` window events. The server snapshot is `true`, so the badge never renders on the server (UI-2).
- `error.tsx` is a Client Component with the "Something went wrong" copy and two actions: "Try again" (calls the boundary's reset) and "Go home". It never renders the error message (U10.3, U10.4).

## 11. Service worker and offline (U11, UI-3)
Follows Serwist's configurator mode for Next.js, which builds the worker after `next build` and precaches every prerendered route.
- **Install:** `pnpm add -D @serwist/cli esbuild` (`@serwist/next` and `serwist` are already installed).
- **`serwist.config.mjs`:**
  ```js
  import { serwist } from '@serwist/next/config';
  export default serwist({ swSrc: 'src/app/sw.ts', swDest: 'public/sw.js' });
  ```
- **Scripts:** `"build": "next build && serwist build"`. `dev` stays `next dev` with no worker (U11.7).
- **`.gitignore`:** add `public/sw*`. The `.kiro` guard test still runs.
- **`src/app/sw.ts`:**
  - `new Serwist({ precacheEntries: self.__SW_MANIFEST, skipWaiting: false, clientsClaim: true, navigationPreload: true, runtimeCaching, fallbacks })`.
  - `runtimeCaching` puts a `NetworkOnly` rule for `/api/` first, then Serwist's `defaultCache` (U11.4). This keeps `/api/coach` out of every cache.
  - `fallbacks.entries`: `/offline` for `request.destination === 'document'` (U11.3).
  - A `message` listener calls `self.skipWaiting()` on `{ type: 'SKIP_WAITING' }`, so updates wait for the user (U11.6).
  - The worker's `tsconfig` concerns are handled by a triple-slash `/// <reference lib="webworker" />` and excluding `src/app/sw.ts` from the app's type check if Serwist's types require it (decided in task 3).
- **Registration and updates (`hooks/use-sw-update.ts`):** in production only, register `/sw.js` in an effect after load. Watch `registration.waiting` and `updatefound`. When a worker is waiting and the current path is not `/log` and no save is in progress (read from a tiny `busy` flag in the moment store), `UpdateToast` shows "New version ready" with "Refresh". Refresh posts `SKIP_WAITING`, then reloads on `controllerchange` (U11.6). Not using `SerwistProvider` keeps this logic in one testable hook (UI-18). The hook stays minimal and is time-boxed to one hour. If it takes longer, the fallback is Serwist's default behavior: the waiting worker activates on the next launch and no toast is shown. The fallback is then logged as a decision and U11.6 is updated to match.
- **Before the update toast exists** (steps 1 to 12 in section 15), registration is a plain `navigator.serviceWorker.register('/sw.js')` in a production-only effect, and updates apply on next launch.
- **Manifest (`app/manifest.ts`):** name "Alafia", short name "Alafia", `start_url: '/'`, `display: 'standalone'`, `background_color` and `theme_color` from `--bg`, and three icons (192, 512, maskable 512). Layout `viewport.themeColor` matches.

## 12. Icons (UI-9)
`public/icons/icon.svg` is the tier 1 emblem on `--bg`. `scripts/make-icons.tsx` uses `ImageResponse` from `next/og` to render it at 192 and 512, plus a maskable 512 with the emblem inside the 80% safe zone, and writes the PNGs to `public/icons/`. It runs once with `pnpm tsx scripts/make-icons.tsx` (a dev-only `tsx` dependency, or `node --experimental-strip-types` if it works with JSX here). The PNGs are committed, so builds do not depend on the script.

## 13. Boundaries and lint
- `src/components/boundary.test.ts`:
  - `@/data/*` imports are limited to `hooks`, `schemas` and `errors` (U14.1, UI-16).
  - `@/engine/*` imports are limited to `quests`, `levels`, `types` and `constants`. From `quests` only `QUEST_DEFINITIONS`, and from `levels` only `avatarTier` (U14.2, UI-1).
  - `@/coach/*` imports are limited to `sanitize`, `orchestrator`, `templates` and `types`.
  - No file imports `dexie`.
- ESLint `no-restricted-syntax` in `src/components` and `src/app` bans `Date.now`, `new Date()` with no arguments and `Math.random`. `use-log-form.ts`, `use-sw-update.ts` and `use-coach-reaction.ts` call the clock only through `localParts(new Date())` inside effects or handlers, and carry a single, commented lint exception.
- A copy test reads every export in `src/components/copy/*` and checks: no C3.1 dash, no ` - `, no pressure word, `containsBannedTerm` is false, and no string is empty (U14.4).

## 14. Test plan
| Area | Tests (`*.dom.test.tsx` with jsdom and Testing Library unless noted) |
|---|---|
| Display helpers | `display.test.ts`: XP bar fraction and label at levels 1, 2, 99; `statScale` with all values 1 (scale 10, bars 0.1) and with a value of 25; streak chip states; strongest stat ties. |
| Avatar | `emblem.test.ts`: arc endpoints. `Avatar` renders the right `data-tier` at levels 4, 5, 9, 10, 19, 20; segment sweep follows `statScale`; accessible name text. |
| Move form | Defaults; chips; number field bounds (0, 1, 300, 301, 20.5) with the copy message; 4-tap path to a saved log; double tap creates one log. |
| Eat form | Slot by time (10:59, 11:00, 15:59, 16:00, 21:59, 22:00); preset fills checks and `presetId`; editing a check after a preset; no calorie or weight fields in the DOM. |
| Rest form | Stepper bounds and steps; the short-night note at 3 and not at 3.5; quality labels. |
| Errors | Validation error maps to the field; storage error shows the message; input kept. |
| Log moment | "+N XP" in a live region; zero-XP copy; level-up moment; tier change; reduced motion gives no animation classes; shows once (navigate away and back); coach line saved with `seed` equal to the log id; coach failure saves `FALLBACK_LINE` and keeps the log. |
| Home | Skeleton while loading; empty state with one action; quests show done by text and icon; first-run note acknowledges. |
| History | Grouping and order; "Today" and "Yesterday"; summaries; 12-hour time; edit saves only changed fields; delete confirmation with "Keep it" and "Delete"; totals update after edit and delete. |
| Settings | Export file name and JSON content; reset confirmation then empty Home; switch toggles `aiEnabled`. |
| Notices | Memory-mode notice on every screen; skipped-records notice; offline badge toggles with `online` and `offline` events. |
| Reset on hide | Dialogs and log moment reset when the hidden-route cleanup runs (simulated by unmounting the layout effect). |
| Tokens | `tokens.test.ts` (node): contrast of text and UI tokens meets U12.1. |
| Copy | `copy.test.ts` (node): U14.4. |
| Boundary | `boundary.test.ts` (node): section 13. |
| Smoke (Playwright) | `e2e/smoke.spec.ts` against `pnpm build && pnpm start`, Chromium, 360 by 740 viewport. Steps in U14.5, plus `@axe-core/playwright` on each screen failing on serious or critical (UI-10). Offline step: visit all four screens online so the worker precaches them, then `context.setOffline(true)`, reload Home, log a Move, see "+N XP" and a coach line. |

Time-dependent component tests use `vi.useFakeTimers()` with `vi.setSystemTime()` and a memory repository through `setStoreForTesting`.

## 15. Delivery order (UI-13, vertical slice)
Each step ships something that runs end to end. The full order and checkpoints are in `tasks.md`.
1. **Foundation and PWA:** tokens, fonts, layout, nav, four screens as skeleton shells, manifest, icons, Serwist worker, `/offline`, registration.
2. **First Vercel deploy and offline check**, before any feature work: on the live URL, check that the manifest is installable, `sw.js` is served and active, the four shells reload with the network off, and `/api/` is never cached. Findings are written into this design. Kiro stops and asks before deploying, because it needs your Vercel account.
3. **Home with empty state:** character card with level, XP bar and streak, a placeholder avatar slot, coach bubble, and the "Log your first quest" empty state.
4. **Log screen, Move only.**
5. **Log moment on Home:** XP gained, coach line through the coach layer, and the level-up moment.
6. Eat form with presets.
7. Rest form.
8. History with edit and delete.
9. Settings with export, reset, the AI switch and notices.
10. Quests on Home.
11. Avatar tiers 1 and 2 (one-day time-box).
12. Avatar tiers 3 and 4, only if time remains.
13. Update toast (UI-18, one-hour time-box), Playwright smoke test with axe, accessibility pass, polish and hand reviews.

## 16. Out of scope
`/api/coach`, real providers, the client wait for an AI line (3b). Any change to engine, data or coach logic. If a screen needs data the hooks do not expose, Kiro stops and asks rather than reaching past the hooks.
