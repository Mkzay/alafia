# Alafia: Design (seed for Kiro specs)

## 1. Architecture
```
                 +-----------------------------+
 UI (React) ---> | data hooks (Dexie + engine) | ---> IndexedDB (logs, settings)
   |             +--------------+--------------+
   |                            |
   |                    engine (pure TS)
   |                  replay(logs) -> CharacterState
   |
   +--> coach client --(online, AI on)--> POST /api/coach --> providers (Groq, Gemini)
            |                                    |
            +--(offline / failure / invalid)-----+--> TemplateCoach
```
The engine is the heart. The coach is an optional layer on top and can never block the loop.

## 2. Data model
```ts
type LogType = 'move' | 'eat' | 'rest';

interface BaseLog {
  id: string;          // uuid
  type: LogType;
  loggedAt: number;    // epoch ms
  localDate: string;   // 'YYYY-MM-DD' on the device at log time
}
interface MoveLog extends BaseLog {
  type: 'move';
  kind: 'cardio' | 'strength' | 'mobility' | 'sport';
  minutes: number;     // 1..300
  intensity: 'light' | 'moderate' | 'vigorous';
}
interface EatLog extends BaseLog {
  type: 'eat';
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  checks: { protein: boolean; plants: boolean; fiberCarb: boolean; water: boolean };
  presetId?: string;
}
interface RestLog extends BaseLog {
  type: 'rest';
  hours: number;       // 0..14, step 0.5
  quality: 1 | 2 | 3 | 4 | 5;
}
type Log = MoveLog | EatLog | RestLog;
```
Dexie tables:
- `logs`: key `id`, indexes `localDate`, `type`, `loggedAt`
- `coachMessages`: key `id`, index `logId`, fields `text`, `source`, `createdAt`
- `settings`: key `key`, holds `aiEnabled`, `aiBudget` ({date, used}), `firstRunAcknowledged`

## 3. Engine rules (all numbers live in one `constants.ts`)
**Move XP** = round(minutes x intensity multiplier). Multipliers: light 1.0, moderate 1.5, vigorous 2.0. Example: 30 min moderate = 45 XP.

**Eat XP** = 5 for logging + 10 per satisfied plate check. Maximum 45 per meal. At most 5 Eat logs per local day award XP.

**Rest XP** = base by hours (7 to 9 h: 40, 6 to under 7 or over 9 to 10: 25, otherwise 10) + quality bonus of 5 x clamp(quality minus 3, 0, 2). Only the earliest Rest log per local day awards XP.

**Quest bonus** = 20 XP each, once per quest per day.

**Streak multiplier** = 1 + 0.02 x min(streak, 7), applied to a log's XP before the cap.

**Daily cap** = 300 XP per local day, applied in (loggedAt, id) order.

**Stat routing**
| Source | Stat |
|---|---|
| Move cardio | Endurance 100% |
| Move strength | Strength 100% |
| Move mobility | Agility 100% |
| Move sport | Endurance 50%, Agility 50% |
| Eat | Vitality 100% |
| Rest | Recovery 100% |
| Quest bonus | Split evenly across the stats the quest relates to |

**Stat value** = 1 + floor(sqrt(statXp / 10)).

**Level curve** = total XP needed to reach level L is round(60 x (L minus 1)^1.7), for L 1 to 99. Reference: L2 60, L3 195, L5 633, L10 2514. A first session of a walk and a meal reaches level 2.

**Quest list** (pick 3 per day, seeded by `localDate`): Move 20 or more minutes; Log a meal with plants; Log sleep; Stretch or mobility 10 minutes; Hit all four plate checks in one meal; Log something before noon; Log two different log types today. Wording must be reviewed by hand for tone.

**Eat presets** (suggestions only, the user can change the checks). Review each by hand against your Human Kinetics knowledge before shipping: jollof rice with chicken, beans and plantain, egusi soup with swallow, moi moi, efo riro with fish, akara and pap, fried rice with salad, yam and egg sauce, fruit and groundnuts.

**Avatar tier** is a pure engine function: `avatarTier(level)` returns 1 for levels 1 to 4, 2 for 5 to 9, 3 for 10 to 19, and 4 for 20 and above.

**Engine API**
```ts
replay(logs: Log[], asOf: { localDate: string }): CharacterState

interface CharacterState {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  stats: Record<'strength' | 'endurance' | 'agility' | 'vitality' | 'recovery',
                { xp: number; value: number }>;
  streak: number;
  streakAtRisk: boolean;
  xpByDate: Record<string, number>;
  quests: { id: string; done: boolean; bonusAwarded: boolean }[];
}
```

## 4. Streak definition
A day is active if it has at least one log. The streak is the count of consecutive active days ending today. If today has no log yet but yesterday was active, the streak is yesterday's count and `streakAtRisk` is true. Any older gap resets it to 0.

## 5. Coach
**Flow**
1. After a log is saved, derive `CoachInput` from the new `CharacterState` and the event.
2. If offline, AI off, or daily AI budget used: pick a template line and show it immediately.
3. Otherwise POST to `/api/coach`. Show a template line right away as a placeholder only if the call takes longer than 1.5 s, then replace it if the AI line arrives and validates. The total wait never exceeds 4.5 s.
4. Server: validate the body with Zod, build the prompt from enums and numbers only, try providers in `COACH_PROVIDERS` order with a 3 s timeout each inside a 4 s total budget, validate output, return `{ text, provider }` or an error. The client falls back to a template on any error.

**Drafted system prompt** (fixed on the server)
> You are a warm, brief wellness game coach inside a habit game. Reply with one or two short sentences, maximum 240 characters, plain English. Encourage and reflect on the event only. Do not give medical advice, diagnoses, dosing, calorie or weight targets, or comments on bodies. Never shame. No emojis other than at most one. Never mention being an AI.

**User message** (built by the server): "Event: {event}. XP gained: {xpGained}. Level: {level}. Streak: {streak} days. Strongest stat: {topStat}. Time of day: {timeBucket}. Tone: {tone}."

**Templates**: at least 5 lines per event, at least 40 in total, chosen with a seeded pick that avoids repeating the last line. Hand-written, tone-reviewed, Nigerian-friendly where natural.

## 6. Output validation
A line is valid only if all hold:
- 1 to 240 characters after trimming, at most 2 sentences
- contains none of the banned stems: `diagnos`, `prescri`, `medicat`, `dose`, `dosage`, `disease`, `cure`, `treat`, `calorie`, `kcal`, `lose weight`, `weight loss`, `bmi`, `fat`, `skinny`, `obese`, `you must`, `you should stop`
- is not empty after stripping markdown and URLs
Short terms (`fat`, `cure`, `treat`, `bmi`, `dose`) match whole words only, so "fatigue" or "treat yourself to rest" are handled deliberately rather than by accident. When in doubt the validator rejects and the template is used. The banned list lives in one file and is easy to extend.

## 7. Properties to test (fast-check)
1. `xpForLevel` is strictly increasing and `levelFromXp(xpForLevel(L)) === L` for L 1 to 99. `levelFromXp` is non-decreasing in XP.
2. For any valid log, XP awarded is an integer greater than or equal to 0, and adding it never decreases total XP or any stat.
3. Replay is deterministic and order-insensitive: shuffling the input array gives the same `CharacterState`.
4. Per-day XP never exceeds the daily cap for any set of logs.
5. Streak is at least 0, at most the number of distinct active days, and matches the definition in section 4.
6. Deleting a log never increases total XP.
7. Quest selection returns exactly 3 distinct quests for any date and is stable for the same date.
8. Any string accepted by the coach validator has 240 characters or fewer and contains no banned stem. The orchestrator returns a non-empty string even when every provider throws or times out.
9. A `CoachInput` built from any `CharacterState` contains only the allowed fields and value ranges.
10. `avatarTier` returns a value from 1 to 4 for every level from 1 to 99 and never decreases as level increases.

## 8. PWA and offline
- Manifest with name, icons (192 and 512, maskable), theme color, `display: standalone`.
- Service worker precaches the shell and static assets, with a cache-first strategy for them and network-first for `/api/coach` (which is never cached).
- `/offline` page for uncached navigations.
- "Offline coach" badge driven by `navigator.onLine` plus a failed fetch.
- Update flow: when a new service worker is waiting, show a "New version ready" toast and apply it on next launch or on tap, never mid-log.
- Test: Playwright loads the app, calls `context.setOffline(true)`, logs a Move, and checks that XP and a template coach line appear.

## 9. UI map
- **Home:** avatar, character card (level, XP bar, five stat bars), streak chip, three quest cards, coach bubble, floating "Log" button.
- **Avatar:** two layers in one SVG component. The outer layer is an emblem frame with five segments, one per stat, whose fill length follows the stat value and whose frame ornament changes with `avatarTier`. The inner layer is a simple character illustration with four tiers (new, trained, seasoned, legend) that differ by outfit, accessories and glow. Everything is parametric SVG driven by CSS variables, so no raster assets are needed. Time-box the first version to one day, and ship tier 1 and 2 first if time is short. Add `role="img"` and a text description with level and strongest stat.
- **Log:** bottom sheet with Move, Eat, Rest tabs. Big tap targets, sensible defaults (last used values).
- **History:** timeline by day, tap to edit or delete.
- **Settings:** Export JSON, Reset, "Offline coach only" switch, about and not-medical-advice note.
- **Look:** dark game-HUD "system window" feel, high contrast, one accent color, one display font plus system text, subtle motion that turns off with reduced motion. Reuse your existing design tokens as a starting point, but build fresh components.

## 10. Error handling
- Storage unavailable (private mode): run in memory for the session and show a clear notice that data will not be kept.
- Zod failure on read: skip the record, keep going, show a non-blocking notice.
- Provider failure, timeout or 429: fall through the chain, then templates. Never show a raw error to the user.
- Clock changes or timezone travel: logs keep the `localDate` they were created with, so history never reshuffles.

## 11. Open questions for you
1. Final name? Until you choose, the working name stays "Alafia".
