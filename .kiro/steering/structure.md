---
inclusion: always
---
# Project structure

```
.kiro/
  steering/            product.md, tech.md, structure.md
  specs/               one folder per feature spec
  hooks/               agent hooks
docs/                  product brief, requirements, design
e2e/                   Playwright smoke test
public/                manifest, icons, offline assets
src/
  app/
    page.tsx           Home: character sheet, quests, coach bubble
    log/page.tsx       Log flow for Move, Eat, Rest
    history/page.tsx   Timeline grouped by day
    settings/page.tsx  Export, reset, AI toggle, about
    offline/page.tsx   Offline fallback
    api/coach/route.ts POST endpoint, server only
  engine/              pure game logic
    types.ts
    levels.ts          xpForLevel, levelFromXp
    xp.ts              XP per log, daily cap, streak multiplier
    stats.ts           routing XP to the five stats
    streaks.ts
    quests.ts          deterministic daily quest selection
    replay.ts          logs in, CharacterState out
  coach/
    types.ts           CoachInput, CoachOutput, CoachProvider
    orchestrator.ts    provider order, timeouts, fallback
    validate.ts        length and banned-term checks
    templates.ts       template lines per event
    providers/         groq.ts, gemini.ts
  data/
    schemas.ts         Zod schemas for logs, settings, coach messages, export
    errors.ts          DataError
    constants.ts       budget, retention, db name
    db.ts              Dexie schema, lazy open
    repository.ts      Repository interface
    repository-core.ts shared pure logic for all repositories
    dexie-repository.ts, memory-repository.ts
    repositories.ts    createRepository with memory fallback
    store.ts           snapshot, replay, day rollover
    hooks.ts           React hooks over the store
  components/          UI components, one folder per feature
  lib/                 small shared helpers: ids.ts, dates.ts (local date and minutes)
```

## Naming
- Files: kebab-case. Components: PascalCase. Types: PascalCase. Functions: camelCase.
- Local dates are strings in `YYYY-MM-DD` form, computed on the device at log time and stored on each log as `localDate`.

## Boundaries
- `engine` imports nothing from `coach`, `data`, `components` or `app`.
- `coach` imports from `engine` types only.
- `components` never import Dexie directly. They go through `data/hooks.ts`.
