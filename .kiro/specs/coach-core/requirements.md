# Coach core (spec 3a): Requirements

Source: `docs/02-requirements.md` R9 and R10, `docs/03-design.md` sections 5 to 7, `tech.md` (CoachProvider interface, architecture rule 4).
Scope: the pure coach layer in `src/coach`: types and schemas, dash normalizer, output validator, input sanitizer, template coach and the orchestrator with injected providers.
Out of scope (spec 3b): the `/api/coach` route, the Groq and Gemini providers, the system prompt text (which must forbid dashes, see COACH-3), the client that calls the route, the 4.5 second client wait, the "not medical advice" note (R10.2), and all UI.

Status: approved, with the changes recorded in "Decisions" at the end.

## Glossary
- **Provider**: an object that implements `CoachProvider` from `tech.md`. Real ones come in 3b. Tests use fakes.
- **Gate**: a condition that sends the orchestrator straight to templates (offline, AI off, budget used, no providers, invalid input).
- **Cleaned text**: the validator's output: trimmed, markdown formatting removed, whitespace collapsed.

## C1. Types and schemas
1. `src/coach/types.ts` SHALL export `CoachEvent`, `CoachInput`, `CoachOutput` and `CoachProvider` exactly as in `tech.md`.
2. THE SYSTEM SHALL define `coachInputSchema` as a strict Zod object (unknown keys rejected, every field required) with the ranges from `tech.md`: `xpGained` integer 0 to 360, `level` integer 1 to 99, `streak` integer 0 to 999, and the enums for `event`, `topStat`, `timeBucket` and `tone`.
3. THE SYSTEM SHALL define `coachOutputSchema` for `CoachOutput`: `text` 1 to 240 characters, `source` `template` or `ai`, optional `provider`.
4. THE inferred Zod types and the hand-written interfaces SHALL be checked against each other at compile time so they cannot drift.

## C2. Output validator (design section 6)
1. `validateCoachText(raw)` SHALL return either `{ ok: true, text }` with the cleaned text, or `{ ok: false, reason }`. It SHALL NOT throw for any input, including non-strings.
2. THE validator SHALL accept text only when all of these hold after cleaning:
   - length is 1 to 240 characters (JavaScript string length, the same count as the data layer's `coachMessageSchema`);
   - it has at most 2 sentences;
   - it is not empty after stripping markdown;
   - it contains no URL;
   - it contains none of the banned terms.
3. SENTENCE COUNT: a sentence ends at `.`, `!`, `?` or `…` (a run such as `...` or `?!` counts once) that is followed by whitespace or the end of the text. A decimal such as `7.5` does not end a sentence. Text with no terminator counts as one sentence.
4. BANNED TERMS live in one file, `src/coach/banned-terms.ts`, as data that is easy to extend:
   - Long stems (`diagnos`, `prescri`, `medicat`, `dosage`, `disease`, `calorie`, `kcal`, `skinny`, `obese`) match anywhere in the text.
   - Short terms (`fat`, `cure`, `treat`, `bmi`, `dose`) match as whole words together with their plain endings `s`, `es`, `d`, `ed`, `ing` and `y`, applying the usual spelling rules (a final `e` drops before `ing` and `y`; `fat` doubles its `t` before `ed`, `ing` and `y`). The file lists every resulting form explicitly so it can be reviewed: `treat treats treated treating treaty`, `cure cures cured curing`, `fat fats fatted fatting fatty`, `dose doses dosed dosing`, `bmi bmis`.
   - Phrases (`lose weight`, `weight loss`, `you must`, `you should stop`) match with any run of whitespace between words.
5. Matching SHALL be case-insensitive and SHALL run on text normalized with Unicode NFKC, with zero-width characters removed, so that look-alike forms do not slip through.
6. WHEN the check is in doubt, THE validator SHALL reject. Harmless words that collide with a banned form (for example "treaty" or "fatty acids") are rejected on purpose.
7. Examples that SHALL be rejected: "Nice session, you must rest.", "Great for weight loss!", "That is a lot of fat.", "Treat yourself to rest.", "Small treats add up.", "Rest cures a lot.", "Two doses of water.", "Check the BMI.", "Read more at www.example.com." Examples that SHALL be accepted: "Fatigue happens, rest well.", "A secure habit is growing.", "You moved for 30 minutes. Nice work."
8. THE validator SHALL NOT alter the meaning of text. It only trims, removes markdown formatting characters and collapses whitespace.

## C3. Dash normalizer (separate step before validation)
1. `normalizeDashes(text)` SHALL replace these dash characters: figure dash U+2012, en dash U+2013, em dash U+2014, horizontal bar U+2015, two-em dash U+2E3A, three-em dash U+2E3B, presentation-form em and en dashes U+FE31 and U+FE32, and small em dash U+FE58. The ASCII hyphen-minus and the hyphens U+2010 and U+2011 are left alone.
2. A dash between two digits, with or without spaces, SHALL become `-` with no spaces ("3–5" and "3 – 5" become "3-5").
3. Any other dash, together with the whitespace around it, SHALL become `, ` ("Nice work — rest well" becomes "Nice work, rest well"; "rest—well" becomes "rest, well").
4. A dash at the start or end of the text, or next to sentence punctuation or a comma, SHALL be removed instead of becoming a comma, so no ", ." or leading ", " appears. Repeated commas SHALL collapse to one.
5. THE normalizer SHALL NOT throw, SHALL be idempotent, and its output SHALL contain none of the characters in C3.1.
6. THE orchestrator SHALL run AI text through `normalizeDashes` and then `validateCoachText`. The validator itself stays as specified in C2, so it matches design section 6.
7. Template lines and `FALLBACK_LINE` SHALL contain no dash characters from C3.1 and no ASCII ` - ` used as a dash. They are not passed through the normalizer.

## C4. Input sanitizer (CharacterState to CoachInput)
1. `buildCoachInput({ before, after, logType, logDate, localMinutes, tone? })` SHALL return a `CoachInput` and SHALL NOT throw. It takes the engine `CharacterState` before and after the log, the log type, the log's `localDate` and its `localMinutes`. It SHALL pass its result through `coachInputSchema.parse`, so extra fields can never leave it.
2. `xpGained` SHALL be `after.totalXp - before.totalXp`, floored at 0. Valid states always give a value from 0 to 360. Out-of-range or non-finite numbers from a corrupt state SHALL be coerced into range as a last line of defense: `xpGained` 0 to 360, `level` 1 to 99, `streak` 0 to 999.
3. `topStat` SHALL be the stat with the highest `xp` in `after`. Ties SHALL go to the first stat in the fixed order strength, endurance, agility, vitality, recovery.
4. `timeBucket` SHALL be computed from `localMinutes`: morning 05:00 to 11:59, afternoon 12:00 to 16:59, evening 17:00 to 20:59, night 21:00 to 04:59.
5. `event` SHALL be the first of these that holds:
   1. `level_up`: `after.level > before.level`.
   2. `quest_done`: more quests are done in `after.quests` than in `before.quests`.
   3. `streak`: `after.streak > before.streak` and `after.streak` is 3, 7, 14 or 30.
   4. `welcome_back`: the latest earlier active date is 3 or more local days before `logDate`. The earlier active dates are the keys of `before.xpByDate` that are before `logDate`. When there is no earlier date (the first ever log), this rule does not apply.
   5. Otherwise the log type: `move`, `eat` or `rest`.
6. `tone` SHALL default to `hype` for `level_up`, `quest_done` and `streak`, and `warm` for all other events. The caller MAY override it.
7. THE sanitizer SHALL NOT copy any other value from the state or the log. No ids, dates, minutes, hours, meal details or free text SHALL appear in the output.
8. `validateCoachInput(unknown)` SHALL return a typed result using the strict schema, for the server route in 3b.

## C5. Template coach
1. `src/coach/templates.ts` SHALL hold hand-written lines per event: at least 5 lines for each of the 7 events and at least 40 in total.
2. THE system SHALL choose a line with a seeded pick: `pickTemplate(input, seed, lastText?)`, where the event comes from `input`. The same arguments SHALL give the same line. WHEN `lastText` equals one of the event's rendered lines, THE pick SHALL NOT return it.
3. THE seed is a string supplied by the caller. The pick SHALL hash it with a documented, stable hash and SHALL NOT use `Math.random` or the clock.
4. Lines MAY use only the tokens `{xp}`, `{level}` and `{streak}`. `renderTemplate` SHALL replace them from the `CoachInput`. A token that is not on this list SHALL fail the template test.
5. EVERY line, after rendering with the largest values (xp 360, level 99, streak 999) and with the smallest values (0, 1, 0), SHALL pass the validator (C2).
6. NO user-facing text SHALL contain a dash character from C3.1. A test SHALL check every template line, the fallback line and every engine quest title.
7. NO line SHALL use pressure words (`burn`, `shred`, `cheat`, `grind`, `no excuses`) or mention missed days, short sleep or food choices in a judging way. A test SHALL check the word list. The wording of the lines is a hand-review gate (see C10.5).
8. Template lines SHALL be plain English in short sentences, warm and a little playful, with Nigerian-friendly phrasing where it is natural.
9. THE system SHALL export a constant `FALLBACK_LINE` that passes the validator, used only if everything else fails.
10. Templates ignore `tone` in this version. Tone only shapes AI output.

## C6. Orchestrator gates
1. `generateCoachLine(options)` SHALL return a `CoachOutput` with a non-empty `text` in every case, and SHALL NOT throw or reject.
2. THE options are all injected: `input` (a `CoachInput`), `providers` (ordered list), `online` (boolean), `aiEnabled` (boolean), `spendAiCall` (async function returning boolean), `seed` (string), and optionally `lastText`.
3. WHEN `online` is false, `aiEnabled` is false, or `providers` is empty, THE orchestrator SHALL return a template line immediately: no provider is called, `spendAiCall` is not called and no timer is started.
4. WHEN `input` fails `coachInputSchema`, THE orchestrator SHALL return `{ text: FALLBACK_LINE, source: 'template' }`, call no provider and not spend budget, so invalid or extra data never reaches a provider.
5. OTHERWISE THE orchestrator SHALL call `spendAiCall` once per run. WHEN it returns false, throws or rejects, THE orchestrator SHALL return a template line and call no provider. The spend stays used even if every provider then fails.
6. THE daily limit of 20 is enforced by the data layer's `trySpendAiCall`. The orchestrator only honors its answer.
7. WHEN a provider returns a line that passes C3 then C2, THE orchestrator SHALL return `{ text, source: 'ai', provider: provider.name }` using the cleaned text.

## C7. Orchestrator timing and failure
1. THE orchestrator SHALL try providers in the given order.
2. EACH provider call SHALL get an `AbortSignal` that aborts after 3 seconds. THE whole run SHALL be limited to a total budget of 4 seconds that starts when the run starts (this includes the `spendAiCall` wait). WHEN the total budget ends, THE signal of the running provider SHALL abort and the orchestrator SHALL return a template line.
3. A later provider SHALL get at most the time left in the total budget, so after a 3 second first failure the second gets 1 second.
4. THE orchestrator SHALL treat each of these as a failure of that provider and move on to the next: a synchronous throw, a rejected promise, a timeout, a non-string result, and a string that fails the validator after dash normalization.
5. A provider that ignores its `AbortSignal` and never settles SHALL NOT stall the run. THE orchestrator SHALL race the provider against the timers. A result that arrives after the abort SHALL be ignored.
6. WHEN every provider fails or the budget ends, THE orchestrator SHALL return a template line with `source: 'template'` and no `provider`.
7. THE orchestrator SHALL clear all of its timers before it returns. After a run, no timer started by it SHALL remain.
8. THE orchestrator SHALL NOT log or expose provider error messages, and SHALL NOT include the `CoachInput` in any error.
9. THE orchestrator SHALL never return text that fails the validator or contains a dash character from C3.1.

## C8. Purity and boundaries
1. `src/coach` (files other than tests and `providers/`) SHALL import nothing from React, Next.js, Dexie, `@/data`, `@/components` or `@/app`, SHALL NOT call `fetch`, and SHALL import from `@/engine` with `import type` only.
2. THE code SHALL be deterministic for the same inputs: no `Math.random`, and no reading of the clock. Timers are the only time source.
3. A boundary test SHALL enforce C8.1 and C8.2.

## C9. Safety (R10)
1. THE system SHALL NOT produce medical advice, diagnosis, dosing, calorie or weight targets, or body-shaming language. THE validator, the template tests and the hand review together enforce this.
2. ONLY the fields of `CoachInput` SHALL be given to a provider. The orchestrator SHALL pass the parsed input and nothing else.
3. THE app stays fully usable when every provider fails (R9.2). This spec proves it with tests that make every provider throw, reject, time out or return garbage.

## C10. Tests
1. Unit tests for the validator: each length edge (0, 1, 240, 241), sentence counts (1, 2, 3, decimals, ellipsis), every banned form in C2.4 plus case, NFKC and zero-width variants, near misses that must pass ("fatigue", "secure", "dosage" is banned but "dossier" passes), URLs, the examples in C2.7, non-string input.
2. Unit tests for the dash normalizer: every character in C3.1, digit ranges with and without spaces, dashes between words with and without spaces, dashes at the start, end and next to punctuation, repeated dashes, idempotence, and that normalized AI text then passes or fails the validator as expected.
3. Unit tests for the sanitizer: event precedence; `welcome_back` at 2 days (no) and 3 days (yes) since the last log, and not on the first ever log; streak milestones; xp 360 is kept as 360; clamps for corrupt values (xp 5000 becomes 360, streak 5000 becomes 999, `NaN` becomes the low end); top stat ties; every bucket edge (04:59, 05:00, 11:59, 12:00, 16:59, 17:00, 20:59, 21:00); rejection of extra keys by `coachInputSchema`.
4. Unit tests for templates: counts, determinism, last-line avoidance, token rendering, the checks in C5.5 to C5.7.
5. Template wording and the tone of the fallback line are reviewed by you before this spec's final task is ticked, as with the quest titles.
6. Orchestrator tests with `vi.useFakeTimers` and `AbortSignal`: every gate, success, dash normalization of an AI line, timeouts at 3 and 4 seconds, a second provider with the remaining time, ignored abort, late result ignored, invalid output moving to the next provider, spend failure, timers cleared (`vi.getTimerCount()` is 0 after each run).
7. Property test 8: any string the validator accepts has 240 characters or fewer, no banned form and at most 2 sentences (`validate.property.test.ts`). The orchestrator returns a non-empty, validator-clean, dash-free string for any mix of providers that throw, reject, hang, return non-strings or return garbage, using fake timers (`orchestrator.property.test.ts`).
8. Property test (templates): for any valid `CoachInput`, every rendered template line has no `{` or `}` and no `NaN`, `undefined` or `null` text (`templates.property.test.ts`).
9. Property test (normalizer): for any string, `normalizeDashes` output has no C3.1 dash, and applying it twice equals applying it once (`dashes.property.test.ts`).
10. Property test 9 (`sanitize.property.test.ts`): a `CoachInput` built from any `CharacterState` pair has exactly the allowed keys and values in range. States come from replaying generated logs and from raw states with out-of-range numbers.

## Mapping to the source requirements
- R9.1: the orchestrator part (4 second total, C7.2). The 4.5 second client wait is 3b.
- R9.2: C6.3, C7.6, C9.3.
- R9.3: C6.7, C7.4, C2, C3.
- R9.4: C4, C6.4, C9.2.
- R9.5: C6.5 and C6.6 (the budget itself is `trySpendAiCall`, already built).
- R10.1: C2, C5.7, C9.1. R10.2 and R10.3 belong to 3b and the UI.

## Decisions (approved)
Rationale and how to change each one: `docs/04-decisions.md`, COACH-1 to COACH-10.
- **Q1 (COACH-1).** Stricter matching: short terms also match their plain endings. The forms are listed explicitly in `banned-terms.ts`.
- **Q2 (COACH-2).** Strip markdown, reject any URL.
- **Q3 (COACH-3).** Dashes in AI text are normalized to a comma or hyphen in a separate step before validation, not rejected. The 3b system prompt forbids dashes.
- **Q4 (COACH-4).** Event precedence as in C4.5, streak milestones 3, 7, 14, 30. `welcome_back` means 3 or more local days since the last earlier log.
- **Q5 (COACH-5).** Top stat ties go to the fixed stat order. Time buckets as in C4.4. Tone defaults as in C4.6.
- **Q6 (COACH-6).** Coach repeats the five stat names, with a compile-time check against `StatId` and a test against `STAT_ORDER`. Production code imports engine types only.
- **Q7 (COACH-7).** Templates use `{xp}`, `{level}`, `{streak}` and ignore tone.
- **Q8 (COACH-8).** One spend per run after the cheap gates. A line that fails validation moves to the next provider. The 4 second total includes the spend check.
- **COACH-9.** `CoachInput.xpGained` is widened to 0 to 360 instead of clamping at 300. `tech.md` and `docs/03-design.md` are updated.
- **COACH-10.** A property test checks that no rendered template has unreplaced braces or `NaN`.
