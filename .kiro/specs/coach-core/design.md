# Coach core (spec 3a): Design

Implements `requirements.md` in this folder. Decisions COACH-1 to COACH-17 are in `docs/04-decisions.md`.

## 1. Module map (`src/coach`)
| File | Responsibility | Requirements |
|---|---|---|
| `constants.ts` | Every coach number: 3000 ms per provider, 4000 ms total, 240 characters, 2 sentences, xp 0 to 360, streak milestones, welcome-back days, time-bucket bounds. | all |
| `types.ts` | `CoachEvent`, `CoachInput`, `CoachOutput`, `CoachProvider` (verbatim from `tech.md`), `CoachStat`, `COACH_STATS`, `TimeBucket`, `Tone`. | C1.1 |
| `schemas.ts` | `coachInputSchema` (strict), `coachOutputSchema`. | C1.2 to C1.4 |
| `banned-terms.ts` | The banned list as data: `LONG_STEMS`, `SHORT_TERM_FORMS`, `PHRASES`. | C2.4 |
| `dashes.ts` | `DASH_CHARS`, `normalizeDashes`, `containsDash`. | C3 |
| `validate.ts` | `validateCoachText`, plus the cleaning helpers it uses. | C2 |
| `hash.ts` | `fnv1a(text)`: 32-bit FNV-1a, the same algorithm the engine uses for quests. | C5.3 |
| `sanitize.ts` | `buildCoachInput`, `validateCoachInput`, `timeBucketFor`, `chooseEvent`. | C4 |
| `templates.ts` | `TEMPLATE_LINES`, `FALLBACK_LINE`, `renderTemplate`, `pickTemplate`. | C5 |
| `orchestrator.ts` | `generateCoachLine`. | C6, C7 |
| `providers/` | Empty in 3a. Groq and Gemini arrive in 3b. | |

Every file has a sibling `*.test.ts`. Property tests use `*.property.test.ts`. Production files import only `./` modules, `zod`, and `import type` from `@/engine/...` (C8, COACH-6). Tests may import engine runtime code (for example `replay` and `QUEST_DEFINITIONS`).

## 2. Types and schemas
```ts
// types.ts: CoachEvent, CoachInput, CoachOutput, CoachProvider exactly as tech.md, with xpGained 0..360.
export type CoachStat = 'strength' | 'endurance' | 'agility' | 'vitality' | 'recovery';
export const COACH_STATS: readonly CoachStat[] =
  ['strength', 'endurance', 'agility', 'vitality', 'recovery'];
```
- `coachInputSchema = z.strictObject({ event: z.enum([...7]), xpGained: z.number().int().min(0).max(360), level: int 1..99, streak: int 0..999, topStat: z.enum(COACH_STATS), timeBucket: z.enum([...4]), tone: z.enum(['warm', 'hype']) })`.
- `coachOutputSchema = z.strictObject({ text: z.string().min(1).max(240), source: z.enum(['template', 'ai']), provider: z.string().min(1).optional() })`.
- `schemas.test.ts` uses `expectTypeOf<z.infer<typeof coachInputSchema>>().toEqualTypeOf<CoachInput>()`, the same for output, and `expectTypeOf<CoachStat>().toEqualTypeOf<StatId>()`. A runtime test checks `COACH_STATS` equals the engine's `STAT_ORDER`.

## 3. Banned terms (`banned-terms.ts`)
```ts
export const LONG_STEMS = ['diagnos', 'prescri', 'medicat', 'dosage', 'disease',
  'calorie', 'kcal', 'skinny', 'obese'] as const;

/** Whole-word forms. Plain endings s, es, d, ed, ing, y, written out for review. */
export const SHORT_TERM_FORMS = {
  treat: ['treat', 'treats', 'treated', 'treating', 'treaty'],
  cure:  ['cure', 'cures', 'cured', 'curing'],
  fat:   ['fat', 'fats', 'fatted', 'fatting', 'fatty'],
  dose:  ['dose', 'doses', 'dosed', 'dosing'],
  bmi:   ['bmi', 'bmis'],
} as const;

export const PHRASES = [['lose', 'weight'], ['weight', 'loss'],
  ['you', 'must'], ['you', 'should', 'stop']] as const;
```
- The matchers are built once at module load.
- **Long stems** use `text.includes(stem)` on the lower-cased cleaned text.
- **Short forms** use one regex: `(?<![\p{L}\p{N}])(?:form|form|...)(?![\p{L}\p{N}])`, flags `iu`. Apostrophes and hyphens count as boundaries, so "fat's" and "fat-free" are rejected.
- **Phrases** join their words with `[\s_-]+`, so "weight-loss" and "you  must" are caught, inside the same word boundaries.
- A test checks that each short term's list holds exactly the forms produced by the ending rules (e-drop before `ing` and `y`, `t` doubling for `fat`), so a hand edit cannot drop a form by accident.

## 4. Dash normalizer (`dashes.ts`)
`DASH_CHARS = '\u2012\u2013\u2014\u2015\u2E3A\u2E3B\uFE31\uFE32\uFE58'` and `D` is a character class over it. Steps, in order:
1. Digit ranges: `(\d)\s*D+\s*(?=\d)` becomes `$1-`.
2. Leading and trailing: `^\s*D+\s*` and `\s*D+\s*$` become empty.
3. Next to punctuation: `\s*D+\s*(?=[.,!?;:…])` becomes empty, and `([.,!?;:…])\s*D+\s*` becomes `$1 `.
4. Everything else: `\s*D+\s*` becomes `, `.
5. Collapse comma runs: `,(?:\s*,)+` becomes `,`.

The function does not trim or touch other characters, so it is idempotent. The output never contains a `D` character. Non-string input is returned as an empty string. The orchestrator is the only caller in 3a (C3.6). `containsDash(text)` is used by tests and the orchestrator's final check.

## 5. Validator (`validate.ts`)
```ts
type ValidationReason = 'not_text' | 'empty' | 'url' | 'too_long' | 'too_many_sentences' | 'banned_term';
type ValidationResult = { ok: true; text: string } | { ok: false; reason: ValidationReason };
```
Pipeline for `validateCoachText(raw)`:
1. Not a string: `not_text`.
2. `normalize('NFKC')` and remove zero-width and invisible characters (U+00AD, U+200B to U+200F, U+2060, U+FEFF).
3. URL check on this text, before any stripping, so markdown links are caught: `https?://`, `www\.`, or `[a-z0-9-]+\.(com|net|org|ng|io|co|app|dev|ai|info|biz|me|xyz|edu|gov|ly|link)\b` (case-insensitive). Any match: `url`.
4. Strip markdown: line-leading `#{1,6} `, `> `, `- `, `* `, `+ `, `1. `; inline `**`, `__`, `~~`, `` ` ``, and `*` or `_` that wrap a word. Turn newlines into spaces, collapse whitespace, trim. The result is the cleaned text.
5. Empty: `empty`. Over 240 characters: `too_long`.
6. Sentences: split on `[.!?…]+(?=\s|$)` and count the segments that still contain a non-space character. More than 2: `too_many_sentences`.
7. Banned matchers (section 3) on the lower-cased cleaned text: `banned_term`.
8. Otherwise `{ ok: true, text: cleaned }`.

The checks are ordered from cheap to expensive. The whole body is inside `try`, and any unexpected error returns `{ ok: false, reason: 'not_text' }`, so the validator never throws.

## 6. Sanitizer (`sanitize.ts`)
```ts
interface BuildCoachInputArgs {
  before: CharacterState; after: CharacterState;
  logType: 'move' | 'eat' | 'rest'; logDate: string; localMinutes: number; tone?: Tone;
}
buildCoachInput(args): CoachInput
validateCoachInput(value: unknown): { ok: true; input: CoachInput } | { ok: false }
```
- `toInt(n, lo, hi)`: a non-finite value becomes `lo`, otherwise `Math.trunc` and clamp.
- `xpGained = toInt(after.totalXp - before.totalXp, 0, 360)`. `level = toInt(after.level, 1, 99)`. `streak = toInt(after.streak, 0, 999)`.
- `topStat`: loop over `COACH_STATS` and keep the first stat with the strictly highest `xp`. A non-finite `xp` counts as `-Infinity`. When all are equal, the result is `strength`.
- `timeBucketFor(minutes)`: wrap into 0 to 1439 (non-finite becomes 0). 300 to 719 is morning, 720 to 1019 afternoon, 1020 to 1259 evening, the rest night.
- `chooseEvent` (C4.5):
  1. Level rose: `level_up`.
  2. Count of `done` in `after.quests` is greater than in `before.quests`: `quest_done`.
  3. Streak rose to a milestone in `[3, 7, 14, 30]`: `streak`.
  4. `welcome_back` when `daysBetween(lastEarlier, logDate) >= 3`, where `lastEarlier` is the greatest key of `before.xpByDate` that is less than `logDate`. `xpByDate` has a key for every date with at least one log, including 0-XP days, so its keys are exactly the active dates.
  5. Otherwise `logType`.
- `daysBetween` parses both `YYYY-MM-DD` strings with `Date.UTC` arithmetic only and returns `null` for a bad date. `null` means no `welcome_back`.
- The default tone comes from the event (C4.6) unless `tone` is passed.
- The object is built field by field, then passed through `coachInputSchema.safeParse`. If parsing fails, which only happens on a bug, the result is the constant `SAFE_INPUT` (`{ event: logType, xpGained: 0, level: 1, streak: 0, topStat: 'strength', timeBucket: 'morning', tone: 'warm' }`), so the function never throws.
- Defensive reads: `before.quests ?? []`, `before.xpByDate ?? {}` and `after.stats?.[s]?.xp`. The property test feeds corrupt states.

## 7. Templates (`templates.ts`)
- `TEMPLATE_LINES: Record<CoachEvent, readonly string[]>`. The plan is 6 lines per event, 42 in total. Lines are short, use only `{xp}`, `{level}` and `{streak}`, and contain no dash characters and no ` - `. The lines are written in task 4 and reviewed by you (C10.5).
- `FALLBACK_LINE = 'Logged. Nice one, keep it going.'`
- `renderTemplate(line, input)` replaces `/\{(xp|level|streak)\}/g` with `String(input.xpGained | level | streak)`. Values come from a parsed `CoachInput`, so they are always integers.
- `pickTemplate(input, seed, lastText?)`:
  1. Render every line for `input.event`.
  2. Drop the rendered lines equal to `lastText`.
  3. Pick index `fnv1a(seed + '|' + input.event) % remaining.length`.

  A test checks that the rendered lines for an event are distinct at both extreme inputs, so at least 5 candidates remain after one is dropped.

## 8. Orchestrator (`orchestrator.ts`)
```ts
interface GenerateCoachLineOptions {
  input: unknown;                    // parsed inside; invalid means FALLBACK_LINE
  providers: readonly CoachProvider[];
  online: boolean;
  aiEnabled: boolean;
  spendAiCall: () => Promise<boolean>;
  seed: string;
  lastText?: string;
}
generateCoachLine(options): Promise<CoachOutput>   // never rejects
```
Flow. Each step returns early.
1. Parse `input` with `coachInputSchema`. If it fails: `{ text: FALLBACK_LINE, source: 'template' }`.
2. `template()` is `{ text: pickTemplate(parsed, seed, lastText), source: 'template' }`.
3. Gates: `!online || !aiEnabled || providers.length === 0` gives `template()`. No timer has started yet.
4. Start the **total budget**: an `AbortController` plus `setTimeout(abort, 4000)`.
5. **Spend**: race `spendAiCall()` (wrapped so a sync throw becomes a rejection) against the total signal. Anything but `true` gives `template()`.
6. **Providers**, in order, while the total signal is not aborted:
   1. Make a provider `AbortController` and `setTimeout(abort, 3000)`. Forward the total signal's `abort` to it, so a later provider gets at most the time left (C7.3). This does not read a clock.
   2. Call `new Promise(r => r(provider.generate(frozenInput, { signal })))`, which turns a sync throw into a rejection. `frozenInput` is `Object.freeze({ ...parsed })`, so only the schema's keys exist.
   3. `raceAbort(promise, signal)` resolves to `{ kind: 'value', value }`, `{ kind: 'error' }` or `{ kind: 'aborted' }`. Whichever happens first wins, and a late settle is ignored. It removes its listener on settle.
   4. `finally`: clear the provider timer and remove the forwarding listener.
   5. When the value is a string: `normalizeDashes`, then `validateCoachText`. If that passes, `coachOutputSchema.safeParse({ text, source: 'ai', provider: provider.name })`. Success returns. Any failure continues to the next provider.
7. After the loop: `template()`.
8. The total timer is cleared in a `finally` around steps 4 to 7. An outer `try`/`catch` around everything returns `{ text: FALLBACK_LINE, source: 'template' }`, so the promise never rejects.
9. Errors are never logged, stored or returned (C7.8). The `kind: 'error'` result carries no message.

Why no clock: the 4 second total is a single timer that aborts a signal, and each provider's signal follows it. "Time left" therefore falls out of the timers, the code never calls `Date.now()`, and fake timers drive every test.

`AbortSignal.any` would also combine signals, but manual forwarding works on every runtime the server route might use and is easy to clean up.

## 9. Test plan
| File | Covers |
|---|---|
| `schemas.test.ts` | Ranges (xp 360 ok, 361 rejected), strict extra-key rejection, type equality, `COACH_STATS` equals `STAT_ORDER`. |
| `banned-terms.test.ts` | Each short-term list equals the generated forms. No duplicates. All entries lower case. |
| `validate.test.ts` | C10.1: length edges, sentences, every banned form, near misses, NFKC (`ｆａｔ`), zero-width (`f\u200Bat`), URLs, markdown, non-strings, the C2.7 examples. |
| `dashes.test.ts` | C10.2: each dash character, digit ranges, word joins, edges, punctuation, repeats, idempotence, normalize then validate. |
| `sanitize.test.ts` | C10.3: precedence, welcome_back at 2 and 3 days and on the first log, milestones, xp 360 kept, corrupt clamps, ties, bucket edges. |
| `templates.test.ts` | C10.4: counts, determinism, last-line avoidance, tokens, validator at both extremes, no dashes, pressure words. Also checks every engine quest title has no dash. |
| `orchestrator.test.ts` | C10.6, with `vi.useFakeTimers()` and `vi.getTimerCount() === 0` after each run. |
| `validate.property.test.ts` | Property 8a. Arbitrary strings, plus valid sentences with a banned form inserted in random case (must be rejected). |
| `orchestrator.property.test.ts` | Property 8b. Generated provider behaviors (throw, reject, hang, ignore abort, non-string, garbage, dash text, valid, slow valid), random gates and spend outcomes. Each run: start, `await vi.advanceTimersByTimeAsync(5000)`, then check a non-empty, validator-clean, dash-free text, the provider name when `source` is `ai`, and zero timers left. |
| `templates.property.test.ts` | COACH-10. Any `CoachInput` from the schema ranges: every rendered line has no `{`, `}`, `NaN`, `undefined` or `null`, and `pickTemplate` output validates. |
| `dashes.property.test.ts` | Strings mixed with dash characters: no dash in the output, idempotent. |
| `sanitize.property.test.ts` | Property 9. (a) Before and after states from replaying engine `logsArb` prefixes. (b) Raw states with `NaN`, `Infinity`, negatives and huge numbers. Every result passes the strict schema and has exactly the seven keys. |
| `boundary.test.ts` | C8. Imports are `./`, `zod`, or `import type ... from '@/engine/...'`. No `Date.now`, `new Date`, `performance.now`, `Math.random` or `fetch(`. |

## 10. Out of scope
The `/api/coach` route, the real providers, the system prompt (it must forbid dashes, COACH-3), the client wait of 4.5 seconds, and the UI. 3b calls `generateCoachLine` on the server with real providers and on the client with `providers: []` when offline.
