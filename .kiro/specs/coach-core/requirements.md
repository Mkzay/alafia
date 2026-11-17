# Coach core (spec 3a): Requirements

Source: `docs/02-requirements.md` R9 and R10, `docs/03-design.md` sections 5 to 7, `tech.md` (CoachProvider interface, architecture rule 4).
Scope: the pure coach layer in `src/coach`: types and schemas, output validator, input sanitizer, template coach and the orchestrator with injected providers.
Out of scope: the `/api/coach` route, the Groq and Gemini providers, the client that calls the route, the 4.5 second client wait, the "not medical advice" note (R10.2), and anything in the UI. These belong to spec 3b.

## Glossary
- **Provider**: an object that implements `CoachProvider` from `tech.md`. Real ones come in 3b. Tests use fakes.
- **Gate**: a condition that sends the orchestrator straight to templates (offline, AI off, budget used, no providers).
- **Cleaned text**: the validator's output: trimmed, markdown formatting removed, whitespace collapsed.

## C1. Types and schemas
1. `src/coach/types.ts` SHALL export `CoachEvent`, `CoachInput`, `CoachOutput` and `CoachProvider` exactly as in `tech.md`.
2. THE SYSTEM SHALL define `coachInputSchema` as a strict Zod object (unknown keys rejected, every field required) with the ranges from `tech.md`: `xpGained` integer 0 to 300, `level` integer 1 to 99, `streak` integer 0 to 999, and the enums for `event`, `topStat`, `timeBucket` and `tone`.
3. THE SYSTEM SHALL define `coachOutputSchema` for `CoachOutput`: `text` 1 to 240 characters, `source` `template` or `ai`, optional `provider`.
4. THE inferred Zod types and the hand-written interfaces SHALL be checked against each other at compile time so they cannot drift.

## C2. Output validator (design section 6)
1. `validateCoachText(raw)` SHALL return either `{ ok: true, text }` with the cleaned text, or `{ ok: false, reason }`. It SHALL NOT throw for any input, including non-strings.
2. THE validator SHALL accept text only when all of these hold after cleaning:
   - length is 1 to 240 characters (JavaScript string length, the same count as the data layer's `coachMessageSchema`);
   - it has at most 2 sentences;
   - it is not empty after stripping markdown and URLs;
   - it contains none of the banned terms.
3. SENTENCE COUNT: a sentence ends at `.`, `!`, `?` or `…` (a run such as `...` or `?!` counts once) that is followed by whitespace or the end of the text. A decimal such as `7.5` does not end a sentence. Text with no terminator counts as one sentence.
4. BANNED TERMS: the list in design section 6 lives in one file, `src/coach/banned-terms.ts`, as data that is easy to extend. Long stems (`diagnos`, `prescri`, `medicat`, `dosage`, `disease`, `calorie`, `kcal`, `weight loss`) match anywhere in the text. Short terms (`fat`, `cure`, `treat`, `bmi`, `dose`) match whole words only. Phrases (`lose weight`, `you must`, `you should stop`) match with any run of whitespace between words.
5. Matching SHALL be case-insensitive and SHALL run on text normalized with Unicode NFKC, with zero-width characters removed, so that look-alike forms do not slip through.
6. WHEN the check is in doubt, THE validator SHALL reject.
7. Examples that SHALL be rejected: "Nice session, you must rest.", "Great for weight loss!", "That is a lot of fat.", "Treat yourself to rest.", "Check the BMI.". Examples that SHALL be accepted: "Fatigue happens, rest well.", "A secure habit is growing.", "You moved for 30 minutes. Nice work."
8. THE validator SHALL NOT alter the meaning of text. It only trims, removes markdown formatting characters and collapses whitespace.

## C3. Input sanitizer (CharacterState to CoachInput)
1. `buildCoachInput({ before, after, logType, localMinutes, tone? })` SHALL return a `CoachInput` or throw nothing. It takes the engine `CharacterState` before and after the log, the log type, and `localMinutes`. It SHALL pass its result through `coachInputSchema.parse`, so extra fields can never leave it.
2. `xpGained` SHALL be `after.totalXp - before.totalXp`, floored at 0 and capped at 300. `level` SHALL be `after.level` clamped to 1 to 99. `streak` SHALL be `after.streak` clamped to 0 to 999. Non-finite or non-integer numbers SHALL be coerced to a valid integer in range.
3. `topStat` SHALL be the stat with the highest `xp` in `after`. Ties SHALL go to the first stat in the fixed order strength, endurance, agility, vitality, recovery.
4. `timeBucket` SHALL be computed from `localMinutes`: morning 05:00 to 11:59, afternoon 12:00 to 16:59, evening 17:00 to 20:59, night 21:00 to 04:59.
5. `event` SHALL follow this order of precedence: `level_up` (level rose), `quest_done` (more quests done than before), `streak` (streak rose and now equals a milestone of 3, 7, 14 or 30), `welcome_back` (streak before was 0 and `before.totalXp` was above 0), then the log type: `move`, `eat` or `rest`.
6. `tone` SHALL default to `hype` for `level_up`, `quest_done` and `streak`, and `warm` for all other events. The caller MAY override it.
7. THE sanitizer SHALL NOT copy any other value from the state or the log. No ids, dates, minutes, hours, meal details or free text SHALL appear in the output.
8. `validateCoachInput(unknown)` SHALL return a typed result using the strict schema, for the server route in 3b.

## C4. Template coach
1. `src/coach/templates.ts` SHALL hold hand-written lines per event: at least 5 lines for each of the 7 events and at least 40 in total.
2. THE system SHALL choose a line with a seeded pick: `pickTemplate(event, seed, lastText?)`. The same arguments SHALL give the same line. WHEN `lastText` equals one of the event's lines, THE pick SHALL NOT return it.
3. THE seed is a string supplied by the caller. The pick SHALL hash it with a documented, stable hash and SHALL NOT use `Math.random` or the clock.
4. Lines MAY use only the tokens `{xp}`, `{level}` and `{streak}`. `renderTemplate` SHALL replace them from the `CoachInput`. A token that is not on this list SHALL fail the template test.
5. EVERY line, after rendering with the worst-case values (xp 300, level 99, streak 999) and with the smallest values (0, 1, 0), SHALL pass the validator (C2).
6. NO user-facing text SHALL contain an em dash (U+2014). A test SHALL check every template line, the fallback line and every engine quest title.
7. NO line SHALL use pressure words (`burn`, `shred`, `cheat`, `grind`, `no excuses`) or mention missed days, short sleep or food choices in a judging way. A test SHALL check the word list. The wording of the lines is a hand-review gate (see C9.5).
8. Template lines SHALL be plain English in short sentences, warm and a little playful, with Nigerian-friendly phrasing where it is natural.
9. THE system SHALL export a constant `FALLBACK_LINE` that passes the validator, used only if everything else fails.
10. Templates ignore `tone` in this version. Tone only shapes AI output (decision Q7).

## C5. Orchestrator gates
1. `generateCoachLine(options)` SHALL return a `CoachOutput` with a non-empty `text` in every case, and SHALL NOT throw or reject.
2. THE options are all injected: `input` (a `CoachInput`), `providers` (ordered list), `online` (boolean), `aiEnabled` (boolean), `spendAiCall` (async function returning boolean), `seed` (string), and optionally `lastText`.
3. WHEN `online` is false, `aiEnabled` is false, or `providers` is empty, THE orchestrator SHALL return a template line immediately: no provider is called, `spendAiCall` is not called and no timer is started.
4. OTHERWISE THE orchestrator SHALL call `spendAiCall` once per run. WHEN it returns false, throws or rejects, THE orchestrator SHALL return a template line and call no provider. A run that is gated before this step SHALL NOT spend budget (decision Q8).
5. THE daily limit of 20 is enforced by the data layer's `trySpendAiCall`. The orchestrator only honors its answer.
6. WHEN a provider returns a valid line, THE orchestrator SHALL return `{ text, source: 'ai', provider: provider.name }` using the validator's cleaned text.
7. WHEN `input` fails `coachInputSchema`, THE orchestrator SHALL skip all providers and return a template line, so invalid or extra data never reaches a provider.

## C6. Orchestrator timing and failure
1. THE orchestrator SHALL try providers in the given order.
2. EACH provider call SHALL get an `AbortSignal` that aborts after 3 seconds. THE whole run SHALL be limited to a total budget of 4 seconds that starts when the run starts (this includes the `spendAiCall` wait). WHEN the total budget ends, THE signal of the running provider SHALL abort and the orchestrator SHALL return a template line.
3. A second provider SHALL get at most the time left in the total budget, so with a 3 second first failure the second gets 1 second.
4. THE orchestrator SHALL treat each of these as a failure of that provider and move on to the next one: a synchronous throw, a rejected promise, a timeout, a non-string result, and a string that fails the validator (decision Q8).
5. A provider that ignores its `AbortSignal` and never settles SHALL NOT stall the run. THE orchestrator SHALL race the provider against the timers. A result that arrives after the abort SHALL be ignored.
6. WHEN every provider fails or the budget ends, THE orchestrator SHALL return a template line with `source: 'template'` and no `provider`.
7. THE orchestrator SHALL clear all of its timers before it returns. After a run, no timer started by it SHALL remain.
8. THE orchestrator SHALL NOT log or expose provider error messages, and SHALL NOT include the `CoachInput` in any error.
9. THE orchestrator SHALL never return text that fails the validator. Template lines and `FALLBACK_LINE` are validated in tests. AI lines are validated at run time.
10. AI lines SHALL also be rejected when they contain an em dash or an en dash (decision Q3). This check is separate from the C2 validator so the validator matches design section 6 exactly.

## C7. Purity and boundaries
1. `src/coach` (files other than tests and `providers/`) SHALL import nothing from React, Next.js, Dexie, `fetch`, `@/data`, `@/components` or `@/app`, and from `@/engine` only types (see Q6).
2. THE code SHALL be deterministic for the same inputs: no `Math.random`, and no `Date.now` outside what the timers need.
3. A boundary test SHALL enforce C7.1 and C7.2.

## C8. Safety (R10)
1. THE system SHALL NOT produce medical advice, diagnosis, dosing, calorie or weight targets, or body-shaming language. THE validator, the template tests and the hand review together enforce this.
2. ONLY the fields of `CoachInput` SHALL be given to a provider. The orchestrator SHALL pass the parsed input and nothing else.
3. THE app stays fully usable when every provider fails (R9.2). This spec proves it with tests that make every provider throw, reject, time out or return garbage.

## C9. Tests
1. Unit tests for the validator: each length edge (0, 1, 240, 241), sentence counts (1, 2, 3, decimals, ellipsis), every banned term (matching and non-matching forms, case, NFKC and zero-width tricks), the examples in C2.7, non-string input.
2. Unit tests for the sanitizer: precedence of events, the clamps (xp 360 becomes 300, streak 5000 becomes 999), top stat ties, every bucket edge (04:59, 05:00, 11:59, 12:00, 16:59, 17:00, 20:59, 21:00), rejection of extra keys by `coachInputSchema`.
3. Unit tests for templates: counts, determinism, last-line avoidance, token rendering, the checks in C4.5 to C4.7.
4. Orchestrator tests with `vi.useFakeTimers` and `AbortSignal`: every gate, success, timeouts at 3 and 4 seconds, second provider with the remaining time, ignored abort, late result ignored, invalid output moving to the next provider, spend failure, timers cleared (`vi.getTimerCount()` is 0 after each run).
5. Template wording and the tone of the fallback line are reviewed by you before this spec's final task is ticked, as with the quest titles.
6. Property test 8 (`validate.property.test.ts` and `orchestrator.property.test.ts`): any string the validator accepts has 240 characters or fewer, no banned term and at most 2 sentences. The orchestrator returns a non-empty, validator-clean string for any mix of providers that throw, reject, hang, return non-strings or return garbage, using fake timers.
7. Property test 9 (`sanitize.property.test.ts`): a `CoachInput` built from any `CharacterState` pair has exactly the allowed keys and values in range. States come from replaying generated logs and from raw states with out-of-range numbers.

## Mapping to the source requirements
- R9.1: the orchestrator part (4 second total). The 4.5 second client wait is 3b.
- R9.2: C5.3, C6.6, C8.3.
- R9.3: C5.6, C6.4, C2.
- R9.4: C3, C5.7, C8.2.
- R9.5: C5.4 and C5.5 (the budget itself is `trySpendAiCall`, already built).
- R10.1: C2, C4.7, C8.1. R10.2 and R10.3 belong to 3b and the UI.

## Open questions (need your decision before design)
**Q1. Validator edge cases.** Design section 6 says short terms match whole words, and mentions "treat yourself to rest" as handled deliberately. Read strictly, `treat` is a whole word in that phrase, so the phrase is rejected. I wrote C2.7 that way: "Treat yourself to rest." is rejected and "fatigue" is accepted. Exact whole-word matching also means "treats", "cures" and "fats" pass. Recommendation: confirm that reading and keep exact whole words. The cost is that a few borderline forms pass. The alternative is to also match plain endings (`s`, `es`, `d`, `ed`, `ing`, `y`). That is stricter and fits "reject on doubt", but it rejects harmless words such as "fatty acids".

**Q2. Markdown and URLs.** Design section 6 says "not empty after stripping markdown and URLs" but not what to do with them. Recommendation (as in C2): strip markdown formatting characters and use the cleaned text, but reject any text that contains a URL (`http`, `www.` or a bare domain), because a link in a coach line is a safety doubt.

**Q3. Dashes in AI output.** Your rule is no em dashes in user-facing text. The design validator does not check this, and you asked for it to match section 6 exactly. Recommendation (as in C6.10): add a separate check in the orchestrator that rejects em and en dashes in AI lines, so the validator stays exact. The 3b system prompt should also tell the model not to use them.

**Q4. Event precedence and streak milestones.** The docs list the seven events but not how one is chosen. Recommendation as in C3.5, with milestones 3, 7, 14 and 30. `welcome_back` fires on the first log after a gap with earlier history.

**Q5. Top stat ties, time buckets and tone.** All three are my proposals (C3.3, C3.4, C3.6). The first-in-order tie rule means a brand-new character reports `strength`, which is harmless because the template lines do not use it. Confirm or change the bucket hours.

**Q6. Engine imports.** `structure.md` says `coach` imports engine types only, but the stat list is a runtime value in `engine/types.ts`. Recommendation: coach repeats the five stat names in `coach/types.ts`, with a compile-time check against `StatId` and a test comparing it to `STAT_ORDER`, so production code in `coach` keeps `import type` only.

**Q7. Template features.** Recommendation (C4.4, C4.10): lines may use `{xp}`, `{level}` and `{streak}` so they feel reactive, and templates ignore `tone`. Offline, `hype` and `warm` then read the same. The alternative is to tag every line by tone, which needs at least 70 lines.

**Q8. Orchestrator semantics.** Recommendation as written: one budget spend per run, only after the offline, AI-off and no-provider gates pass, and it stays spent even if every provider then fails (C5.4). A provider whose line fails validation counts as a failure and the next provider is tried (C6.4). The 4 second total includes the budget check (C6.2).
