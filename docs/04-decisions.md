# Alafia: Decisions Log

One place to review or change any decision. Each row says what was decided, why, what else was possible, and where it lives in the code and specs. To change one, tell Kiro the ID (for example "change ENG-5") and Kiro updates the spec, the docs and the code together.

Product-level decisions D1 to D8 stay in `01-product-brief.md` section 5.

Status values: **Approved** (you said yes), **Assumed** (Kiro chose it while building and you have not confirmed it).

## Naming
| ID | Decision | Why | Alternatives | Lives in | Status |
|---|---|---|---|---|---|
| NAME-1 | The plate check formerly called "plants" is now "veggies or fruit". Code key: `veggies`. Quest id: `mealWithVeggies`. Quest title: "Log a meal with veggies or fruit". | "Plants" read oddly. "Veggies or fruit" is plain English and fits Nigerian meals. | Key `produce`; label "Greens and fruit". | `src/engine/types.ts`, `quests.ts`, `constants.ts`, `src/data/schemas.ts`, docs 02 and 03 | Approved |

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
| DL-1 | Hooks update through a change emitter in the repository and `useSyncExternalStore`. | Works the same for IndexedDB and memory mode. No extra dependency. | `dexie-react-hooks` `useLiveQuery`. | `src/data/hooks.ts`, `store.ts`, `repository-core.ts` (`Emitter`) | Approved |
| DL-2 | Editing a log keeps `loggedAt`, `localDate` and `localMinutes`. Only the type-specific fields change. | History never reshuffles. Streaks and quests stay stable. | Allow moving a log to another day. | `repository-core.ts` (`mergePatch`), `schemas.ts` (`logPatchSchema`) | Approved |
| DL-3 | A record that fails Zod parsing is skipped, counted, and left in storage. Reset removes it. | A later app version could still read it. | Delete bad records on read. | `repository-core.ts` (`parseLogRows`) | Approved |
| DL-4 | Keep the newest 200 coach messages. | They are small and Home shows only the latest. | Keep all; keep 50. | `constants.ts` (`COACH_MESSAGE_LIMIT`), `repository-core.ts` | Approved |
| DL-5 | Ask the browser for persistent storage once, best effort. | Protects data on low-storage phones. | Skip it. | `db.ts` | Approved |
| DL-6 | No import in the MVP. Export only. | Not in the requirements. | JSON import. | `repository.ts` | Approved |
| DL-7 | Recompute state on `visibilitychange` and at local midnight. | "Streak at risk" is right the next morning without a reload. | Recompute only on user action. | `store.ts` | Approved |
| DL-8 | `addLog` returns `{ log, before, after, xpGained, leveledUp }`. | Instant XP feedback, and the coach spec gets its input from one call. | UI diffs state itself. | `store.ts` | Approved |
| DL-9 | Open tabs refresh each other through a `BroadcastChannel`. | Avoids stale state when the app is open twice. | Ignore other tabs. | `dexie-repository.ts` | Approved |
| DL-10 | Dev dependencies `jsdom` and `@testing-library/react`, used only by `*.dom.test.tsx`. | One hook test must prove re-render. | Test the store only. | `package.json`, `hooks.dom.test.tsx` | Approved |
| DL-11 | The data layer adds files beyond `structure.md`: `schemas.ts`, `errors.ts`, `repository.ts`, `store.ts`, `repository-contract.ts`, and others listed in its design. | Small files with one job each. | Fewer, larger files. | `.kiro/steering/structure.md` | Approved |
| DL-12 | Shared repository logic (building logs, merging patches, budget, pruning, settings defaults, export) lives in `repository-core.ts`. Both repositories call it. | One rule set, so memory mode behaves the same as IndexedDB. | Duplicate logic in each repository. | `src/data/repository-core.ts` | **Assumed** |
| DL-13 | Dexie transactions return validation errors as values and the caller throws them. | Dexie wraps errors thrown inside a transaction, which hid the `validation` code. | Catch and unwrap Dexie errors. | `dexie-repository.ts` (`updateLog`) | **Assumed** |
| DL-14 | Vitest 5 has no `environmentMatchGlobs`, so DOM tests opt in with a `// @vitest-environment jsdom` comment at the top of each `*.dom.test.tsx` file. | The option was removed in this Vitest version. | Vitest projects config. | `src/data/hooks.dom.test.tsx` | **Assumed** |

## Coach core, spec 3a (spec: `.kiro/specs/coach-core`)
| ID | Decision | Why | Alternatives | Lives in | Status |
|---|---|---|---|---|---|
| COACH-1 | Short banned terms (`fat`, `cure`, `treat`, `bmi`, `dose`) match as whole words plus plain endings `s`, `es`, `d`, `ed`, `ing`, `y`. The forms are written out in the file. "Treaty" and "fatty acids" are rejected on purpose. | Reject on doubt. | Exact whole words only. | `src/coach/banned-terms.ts` | Approved |
| COACH-2 | Strip markdown, reject any URL. | A link in a coach line is a safety doubt. | Strip URLs and keep the line. | `validate.ts` | Approved |
| COACH-3 | Em, en and other Unicode dashes in AI text become a hyphen between digits and a comma elsewhere, in a separate step before validation. The 3b system prompt forbids dashes. | Keeps the house style without throwing away good AI lines. The validator stays as in design section 6. | Reject lines with dashes. | `dashes.ts`, `orchestrator.ts`, 3b prompt | Approved |
| COACH-4 | Event precedence: `level_up`, `quest_done`, `streak` (milestones 3, 7, 14, 30), `welcome_back` (3 or more local days since the last earlier log), then the log type. | The docs listed events but no rule. | Other milestones or gap length. | `sanitize.ts`, `constants.ts` | Approved |
| COACH-5 | Top stat ties go to the fixed stat order. Buckets: morning 05:00 to 11:59, afternoon 12:00 to 16:59, evening 17:00 to 20:59, night 21:00 to 04:59. Tone is `hype` for level up, quest and streak, `warm` otherwise. | Deterministic and simple. | Other hours or tie rules. | `sanitize.ts` | Approved |
| COACH-6 | Coach repeats the five stat names, checked at compile time against `StatId` and by a test against `STAT_ORDER`. Production code imports engine types only. | Keeps the `structure.md` boundary. | Import `STAT_ORDER` at run time. | `coach/types.ts` | Approved |
| COACH-7 | Templates use `{xp}`, `{level}`, `{streak}` and ignore tone. | Reactive lines without 70+ tone-tagged lines. | Tone-tagged lines. | `templates.ts` | Approved |
| COACH-8 | One budget spend per run, after the offline, AI-off and no-provider gates. A line that fails validation moves to the next provider. The 4 second total includes the spend check. | Budget only counts real attempts. | Spend per provider call. | `orchestrator.ts` | Approved |
| COACH-9 | `CoachInput.xpGained` is 0 to 360, not clamped at 300. | A log can add 300 log XP plus 3 quest bonuses of 20. Clamping would misreport it. | Clamp at 300. | `tech.md`, `docs/03-design.md`, `coach/schemas.ts` | Approved |
| COACH-10 | A property test checks that no rendered template has unreplaced braces or `NaN`. | Guards template edits. | Unit tests only. | `templates.property.test.ts` | Approved |
| COACH-11 | `pickTemplate` takes the whole `CoachInput`, not just the event. | It must render lines to compare them with the last shown text. | Compare raw lines. | `templates.ts` | **Assumed** |
| COACH-12 | Invalid orchestrator input returns `FALLBACK_LINE`. | Without valid input there is no event to pick a template for. | A default-event template. | `orchestrator.ts` | **Assumed** |
| COACH-13 | The 4 second total is one timer that aborts a signal, and each provider's signal follows it. No clock is read. | "Time left" falls out of the timers, the code stays pure, and fake timers drive the tests. | `Date.now()` arithmetic; `AbortSignal.any`. | `orchestrator.ts` | **Assumed** |
| COACH-14 | Coach has its own copy of the 32-bit FNV-1a hash. | The engine's copy is private, and coach may import engine types only. | Export it from the engine. | `coach/hash.ts` | **Assumed** |
| COACH-15 | The validator returns NFKC-normalized text with zero-width characters removed. | The text that is checked is the text that is shown. | Return the original text. | `validate.ts` | **Assumed** |
| COACH-16 | Apostrophes and hyphens count as word boundaries, so "fat's" and "fat-free" are rejected. Phrase words may be joined by spaces, hyphens or underscores, so "weight-loss" is rejected. | Reject on doubt. | Spaces only. | `banned-terms.ts`, `validate.ts` | **Assumed** |
| COACH-17 | A bare domain counts as a URL only for a fixed list of common top-level domains. | Avoids rejecting normal text such as "work.Rest" while catching "example.com". | Reject any `word.word`. | `validate.ts` | **Assumed** |
| COACH-18 | Added long stems `treatment`, `therap`, `symptom`, `medicin`, `supplement`, `detox`, `starv`. A long stem matches anywhere, so all forms are caught (therapist, symptomatic, starvation and so on). | Medical and diet-culture words are a safety doubt. | Whole-word forms only. | `banned-terms.ts` | Approved |
| COACH-19 | Every user-facing coach line lives in `src/coach/template-lines.ts`. | One file to review. | Lines next to the logic. | `template-lines.ts` | Approved |
| COACH-20 | The engine writes an `xpByDate` key for every date with a log, even at 0 XP. `welcome_back` reads the keys as the active dates. | Keeps the coach free of log access. | Pass the log list to the coach. | `src/engine/replay.ts`, `replay.zero-xp.test.ts` | Approved |
| COACH-21 | The coach checks month and day ranges itself before date arithmetic, so "2026-13-45" or "2026-02-29" is treated as a bad date and `welcome_back` does not fire. | `Date.UTC` silently rolls invalid dates over, and coach code may not use `new Date`. Found by a test. | Trust the data layer's date schema. | `sanitize.ts` (`daysBetween`) | **Assumed** |
| COACH-22 | When `xpGained` is 0, lines with `{xp}` are never used. Move, Eat and Rest switch to `ZERO_XP_LINES`, worded to be true for the daily cap, the 6th+ meal and a second Rest log, because `CoachInput` does not carry the reason. | No "+0 XP" lines, and no false "you hit the cap" claims. | Add a `zeroReason` field to `CoachInput` (changes the tech.md interface). | `template-lines.ts`, `templates.ts` (`linesFor`) | Approved |
| COACH-24 | Move earns 0 XP only at the daily cap, so Move zero-XP lines may mention a full XP bar. Eat and Rest zero-XP lines must not, since a 6th meal or a second Rest log earns 0 below the cap. A test checks it. Lines may use contractions; at most 2 start with "Nice" and at most 2 use "every". | Earlier Eat and Rest zero lines made a false claim. | One neutral set for all three. | `template-lines.ts`, `templates.test.ts` | Approved |
| COACH-23 | New token `{days}` renders "1 day" or "N days". "{streak} day streak" stays, since "day" is an adjective there. | Correct plurals at streak 1. | Avoid day counts in lines. | `templates.ts` (`daysLabel`) | Approved |

## UI, spec 4 (spec: `.kiro/specs/ui`)
| ID | Decision | Why | Alternatives | Lives in | Status |
|---|---|---|---|---|---|
| UI-1 | Components may import from the engine only `QUEST_DEFINITIONS`, `avatarTier`, `types.ts` and `constants.ts`. | Display needs titles and tiers. Rules stay in the engine. | New hooks in `src/data`. | `src/components/boundary.test.ts` | Approved |
| UI-2 | Offline is detected with `navigator.onLine` and window events. No experimental `useOffline`. | `useOffline` also makes failed navigations wait, which could block the service worker's cached pages. | `next/offline`. | `hooks/use-online.ts` | Approved |
| UI-3 | Serwist configurator mode, `next build && serwist build`. | Works with Turbopack and precaches every prerendered route. | `@serwist/turbopack` route handler. | `serwist.config.mjs`, `src/app/sw.ts` | Approved |
| UI-4 | Stat bars and emblem segments fill to `value / max(strongest value, 10)`. | A new character does not show full bars. | Relative to the strongest; absolute scale. | `home/display.ts` (`statScale`) | Approved |
| UI-5 | The log moment shows on Home, handed over in memory. | The character changes in place, one tap fewer. | Result panel on the Log screen. | `log-moment/moment-store.ts` | Approved |
| UI-6 | Defaults: Cardio 20 min Moderate; Eat slot by time of day; Rest 7.5 h quality 3; then last used values. | Fast logging. | Always last used. | `log/defaults.ts` | Approved |
| UI-7 | Eat presets are UI data. Suggested checks are not final. | The engine never reads presets. | Engine-owned presets. | `log/eat-presets.ts` | Pending review |
| UI-8 | Kiro's default dark tokens as CSS variables; Chakra Petch 500 and 700 via `next/font`. | Swappable later; no runtime font fetch. | Your existing tokens. | `globals.css`, `layout.tsx` | Approved |
| UI-9 | Icons from an SVG emblem, PNGs generated once with `ImageResponse` and committed. | No image dependency at build. | Image library. | `public/icons/`, `scripts/make-icons.tsx` | Approved |
| UI-10 | `@axe-core/playwright` scans each screen in the smoke test. | Catches serious accessibility issues early. | Manual only. | `e2e/smoke.spec.ts` | Approved |
| UI-11 | Dialog and transient state is local and resets on hide with a `useLayoutEffect` cleanup. | Avoids `useSearchParams` and its Suspense need under Cache Components. | Dialog state in the URL. | `hooks/use-reset-on-hide.ts` | Approved |
| UI-12 | Home is one scrolling page, top block above the fold at 360 by 740. | Readable on small phones. | No-scroll layout. | `home/HomeScreen` | Approved |
| UI-13 | First Vercel deploy and offline check come right after the PWA foundation, before polish. Kiro asks before deploying. | Catch Serwist and caching problems early. | Deploy at the end. | `design.md` section 15 | Approved |
| UI-14 | Avatar is time-boxed to one day as parametric SVG, tiers 1 and 2 first. | Scope control. | Full four tiers at once. | `avatar/` | Approved |
| UI-15 | Forms and transient UI reset when their screen is hidden. | Activity keeps routes mounted. | Keep drafts. | `use-reset-on-hide.ts` | Approved |
| UI-16 | Components may import `@/data/schemas` and `@/data/errors` as well as `@/data/hooks`. | Forms validate with the same Zod schemas and read error codes. Neither touches storage. | Re-declare validation in the UI. | `src/components/boundary.test.ts` | **Assumed** |
| UI-17 | Log times show in 12-hour form ("9:30 am"); day headers use "Today", "Yesterday" or "Mon 16 Nov", formatted from the stored date in UTC so time zones cannot shift it. | Common in Nigeria; stable history. | 24-hour time. | `history/format.ts` | **Assumed** |
| UI-18 | Service worker registration and the update toast use a small custom hook, not `SerwistProvider`. Kept minimal and time-boxed to one hour. If it runs over, fall back to Serwist's default (apply on next launch, no toast) and log that as a new decision. | The toast must wait while the Log screen is open or a save is running, which needs app state. | `SerwistProvider`; no toast. | `hooks/use-sw-update.ts` | Approved |
| UI-20 | The service worker also precaches the self-hosted `.woff2` fonts (about 60 KB). | Serwist's default patterns skip fonts, so offline screens would lose Chakra Petch. | System font when offline. | `serwist.config.mjs` | **Assumed** |
| UI-21 | The icon script is plain `scripts/make-icons.mjs` run with `node`, not a `.tsx` run with `tsx`. Emblem arcs sweep 54 degrees with an 18 degree gap so round caps leave a visible gap. | No extra dependency. The first render showed the 6 degree gap closing up. | `tsx` dev dependency. | `scripts/make-icons.mjs`, design section 6 | **Assumed** |
| UI-22 | `@serwist/next`, `@serwist/cli` and `serwist` are dev dependencies pinned to the same version (9.5.15). `esbuild`'s install script is allowed. | Build-time only; mismatched versions risk subtle breaks. | Leave versions mixed. | `package.json`, `pnpm-workspace.yaml` | **Assumed** |
| UI-23 | `engines.node` is `24.x` and `@types/node` is `^24`, matching local Node 24.13. | Vercel now defaults new projects to Node 26 (changelog, 2026-10-29); pinning keeps builds on the version we test with. | Move to Node 26 everywhere. | `package.json` | **Assumed** |
| UI-24 | `pnpm-workspace.yaml` allows esbuild's install script under both keys: `allowBuilds` (pnpm 11) and `onlyBuiltDependencies` (pnpm 9 and 10). Vercel picks pnpm 9 or 10 for lockfile 9.0 unless Corepack is on. Verified with pnpm 10.34.9 and a frozen lockfile. | The build works whichever pnpm Vercel runs. | Require `ENABLE_EXPERIMENTAL_COREPACK=1` on Vercel. | `pnpm-workspace.yaml` | **Assumed** |
| UI-19 | Tasks follow a vertical slice: PWA and first deploy, Home empty state, Move logging, the log moment on Home, then Eat, Rest, History, Settings, quests, avatar tiers 1 and 2, tiers 3 and 4 if time remains. | Each step runs end to end and can be demoed. | Layer by layer. | `.kiro/specs/ui/tasks.md` | Approved |

## How to change a decision
1. Tell Kiro the ID and the new choice.
2. Kiro updates the matching spec in `.kiro/specs`, the files in `docs/`, the code and the tests in one change.
3. Kiro updates this file, marking the old choice in a "Changed" note and the new status.
