# Alafia: Product Brief (working title)

Kiroween 2026, category: **Frankenstein**. Solo build. Deadline: Fri Dec 4, 2026, 2:00 PM PT (11:00 PM in Lagos). Internal submit target: Wed Dec 2.

## 1. What it is
A wellness companion that shows you as a game character. You log Move, Eat or Rest in seconds. A deterministic engine turns each log into XP and stats, and a short coach line reacts. Data lives on the device, so the whole loop works offline.

## 2. The Frankenstein story (the stitched parts)
| Body part | Discipline | Where it lives |
|---|---|---|
| Progression engine | Game design (XP, levels, streaks, daily quests) | `src/engine` |
| Domain rules | Human Kinetics and health education (movement types, intensity, plate check, sleep ranges) | `src/engine` rules and presets |
| Coach | Generative AI with guardrails and a template fallback | `src/coach` |
| Skin and resilience | Local-first PWA (IndexedDB, service worker) | `src/data`, `public` |

The seams are typed: engine to storage through `CharacterState`, engine to coach through `CoachInput`, coach to providers through `CoachProvider`. Say this in the write-up and the video.

## 3. The one core loop
Log (under 10 seconds) then stats update then coach reacts. Anything that does not strengthen this loop is out of scope.

## 4. MVP scope
In: Move, Eat and Rest logging, five stats, XP and levels, daily XP cap, streaks, three daily quests, coach with AI plus template fallback, history with edit and delete, JSON export, installable PWA, offline use.
Out: accounts, sync, social, wearables, calorie counting, push notifications, on-device LLM.
Stretch, all parked for now: S1 FHIR Observation export (decided against for now), S2 optional cloud sync, S3 on-device coach. Revisit only if the core is finished early and you ask.

## 5. Decisions log
| ID | Decision | Status |
|---|---|---|
| D1 | Working name "Alafia". One find-and-replace when the final name is chosen. | Open to change |
| D2 | Local-first with no accounts. Fewer moving parts, health data stays on device, judges need no login. | Open to veto |
| D3 | AI provider is deferred behind `CoachProvider`. Candidates: Groq primary, Gemini Flash-Lite fallback. | Deferred |
| D4 | Offline is a secondary feature, delivered by the PWA and local storage, not by an on-device model. | Decided |
| D5 | License: MIT. | Decided |
| D6 | Fresh repo and fresh code only. Nothing reused from projects started before Oct 30, 2026. Ideas and design tokens are fine. | Decided |
| D7 | Avatar is both: an evolving emblem frame plus a simple character illustration inside it. Built as parametric SVG so no raster art is needed. | Decided |
| D8 | FHIR export is parked. Not planned, not in the timeline. | Decided |

## 6. Judging map (five criteria, 20% each)
| Criterion | What we do about it |
|---|---|
| Potential Impact | Real audience with patchy data and cost-sensitive phones. No account, no download, works offline. |
| Technological Implementation | Specs, steering, hooks, custom agents, property-based testing, MCP or Powers where they fit. Log it as we go (section 9). |
| Design | One coherent game-HUD look, accessible, reduced-motion aware. Polished empty, loading and error states. |
| Innovation or Idea | Game progression and health domain rules stitched together, with an AI coach that can never break the app. |
| Presentation | Under 3 minutes: problem, live loop, airplane mode moment, how Kiro built it. |

## 7. Timeline (Lagos time)
| Dates | Goal |
|---|---|
| Sat Nov 14 | IDE set up, repo created, `.kiro` and docs committed, engine spec approved |
| Sun Nov 15 to Mon Nov 16 | Engine built with property tests; Dexie data layer |
| Tue Nov 17 to Fri Nov 21 | Log flows, home character sheet, history, quests |
| Sat Nov 22 to Sun Nov 23 | Coach orchestrator with templates, PWA and offline, first deploy, first full review |
| Mon Nov 24 to Thu Nov 27 | AI providers wired, fallback tests, safety validator, polish |
| Fri Nov 28 to Sun Nov 29 | Design polish, accessibility pass, e2e smoke test, README |
| Mon Nov 30 | Blog post draft, Social Blitz post |
| Tue Dec 1 | Record and edit the demo video |
| Wed Dec 2 | Submit. Re-test the live link from a phone on mobile data |
| Thu Dec 3 to Fri Dec 4 | Buffer only |

Rule: if a week-N goal slips by more than a day, cut a stretch item or a nice-to-have, never the buffer.

## 8. Submission checklist
- [ ] Category selected: Frankenstein
- [ ] Public GitHub repo with MIT license visible in the About section
- [ ] `.kiro` at repo root, committed, not in `.gitignore`
- [ ] Setup instructions in the README
- [ ] Live URL, free to use, kept up until judging ends on Jan 29, 2027
- [ ] Text description of features
- [ ] Demo video under 3 minutes, public on YouTube, no unlicensed music or marks
- [ ] Kiro write-up (section 9 feeds this)
- [ ] Bonus: blog post (note it was written for Kiroween 2026), Social Blitz post with #KiroweenHackathon26, Best Demo is automatic
- [ ] Confirm eligibility details on the official rules page before submitting

## 9. Kiro usage log (fill in as we build)
| Date | Feature | Surface (IDE, CLI, Web) | Kiro feature used | What Kiro did | What I reviewed or changed |
|---|---|---|---|---|---|
| | | | | | |

## 10. Kiro workflow
- **IDE** is the main surface: specs (requirements, design, tasks) with a review gate at each stage, hooks, steering.
- **CLI** for headless runs, a reviewer custom agent, a test-writer custom agent.
- **Web** optionally for one or two background tasks that open pull requests, after the core is stable.
- **Hooks to create:** lint and typecheck on save; tests when a task completes; a guard that fails if `.kiro` appears in `.gitignore`.
- **Property-based testing:** the engine properties listed in `03-design.md`, section 7.

## 11. First prompts to give Kiro
Spec session 1 (engine):
> Create a spec for the progression engine. Use docs/02-requirements.md requirements R4 to R7 and docs/03-design.md sections 3, 4 and 7. Keep the engine pure TypeScript under src/engine. Include property-based tests for every property listed in section 7.

Spec session 2 (data layer):
> Create a spec for the local data layer using Dexie. Use docs/03-design.md section 2 and requirements R8 and R12. Parse every record with Zod on read.

Spec session 3 (coach):
> Create a spec for the coach: orchestrator, template coach, validator, and the /api/coach route. Use requirements R9 and R10 and design section 5. Providers are optional and must never block the app.
