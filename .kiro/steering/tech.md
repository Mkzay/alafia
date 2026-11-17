---
inclusion: always
---
# Tech

## Stack
- Next.js (App Router), TypeScript in strict mode, Tailwind CSS
- Local data: IndexedDB through Dexie. No server database in the MVP.
- PWA: service worker through Serwist (or the currently maintained Next.js PWA option), web manifest, offline fallback page
- Validation: Zod for everything that crosses a boundary (persisted data, API bodies, provider output)
- Tests: Vitest for unit tests, fast-check for property-based tests, Playwright for one end-to-end smoke test
- Deploy: Vercel hobby tier
- Package manager: pnpm
- AI: only through the server route `/api/coach`, behind the `CoachProvider` interface below

## Architecture rules
1. `src/engine` is pure TypeScript. No React, no Dexie, no fetch, no `Date.now()`. Time is passed in as data. Everything there is deterministic and covered by unit and property tests.
2. The UI never computes stats. It reads engine output through hooks in `src/data`.
3. Character state is derived by replaying logs through the engine. A cached snapshot is allowed, but it must always be reproducible from the logs.
4. Coach flow: build an anonymous `CoachInput`, try providers in order with a 3 second timeout each inside a 4 second total budget, validate the output, and fall back to `TemplateCoach`. When offline, skip the network and use templates immediately.
5. Secrets live only in server environment variables. Never use `NEXT_PUBLIC_` for a provider key.
6. Model names come from environment variables, never hardcoded, because hosted free-tier models rotate.
7. Every persisted record and API body has a Zod schema. Parse on read, not just on write.

## CoachProvider interface
```ts
export type CoachEvent =
  | 'move' | 'eat' | 'rest' | 'level_up' | 'streak' | 'quest_done' | 'welcome_back';

export interface CoachInput {
  event: CoachEvent;
  xpGained: number;   // integer 0..360 (300 daily log cap plus up to 3 quest bonuses of 20)
  level: number;      // integer 1..99
  streak: number;     // integer 0..999
  topStat: 'strength' | 'endurance' | 'agility' | 'vitality' | 'recovery';
  timeBucket: 'morning' | 'afternoon' | 'evening' | 'night';
  tone: 'warm' | 'hype';
}

export interface CoachOutput {
  text: string;                 // 1 to 2 sentences, max 240 characters
  source: 'template' | 'ai';
  provider?: string;
}

export interface CoachProvider {
  readonly name: string;
  generate(input: CoachInput, opts: { signal: AbortSignal }): Promise<string>;
}
```

## Environment variables
- `COACH_PROVIDERS` comma-separated order, for example `groq,gemini`. Empty means templates only.
- `GROQ_API_KEY`, `GROQ_MODEL`
- `GEMINI_API_KEY`, `GEMINI_MODEL`

## Conventions
- Named exports, small files, no `any`, no default exports except Next.js pages and layouts.
- Conventional commit messages.
- Tests sit next to the code: `xp.ts` and `xp.test.ts`. Property tests use the `.property.test.ts` suffix.
- Accessibility target is WCAG AA. Respect `prefers-reduced-motion`.
- Commands: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm e2e`.

## Kiro rules
- Never add `.kiro` to `.gitignore`.
- When behavior changes, update the matching spec in `.kiro/specs` in the same change.
- Specs are written and reviewed before implementation. Do not implement a task whose requirements have not been approved.
