import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { containsDash } from './dashes';
import { generateCoachLine } from './orchestrator';
import { COACH_EVENTS, COACH_STATS, TIME_BUCKETS, TONES } from './types';
import type { CoachInput, CoachProvider } from './types';
import { validateCoachText } from './validate';

type Behavior =
  | { kind: 'throw' }
  | { kind: 'reject' }
  | { kind: 'hang' }
  | { kind: 'lateIgnoringAbort'; ms: number }
  | { kind: 'nonString'; value: unknown }
  | { kind: 'text'; text: string }
  | { kind: 'slowText'; text: string; ms: number };

const lines = fc.oneof(
  fc.string({ maxLength: 300 }),
  fc.constantFrom('Nice walk today.', 'Great job \u2014 rest well.', 'You must rest.', 'One. Two. Three.', '', '   ', 'Check www.example.com', '**Bold** move!'),
);

const behavior: fc.Arbitrary<Behavior> = fc.oneof(
  fc.constant({ kind: 'throw' as const }),
  fc.constant({ kind: 'reject' as const }),
  fc.constant({ kind: 'hang' as const }),
  fc.integer({ min: 0, max: 8000 }).map((ms) => ({ kind: 'lateIgnoringAbort' as const, ms })),
  fc.constantFrom<unknown>(42, null, undefined, {}, ['x'], true).map((value) => ({ kind: 'nonString' as const, value })),
  lines.map((text) => ({ kind: 'text' as const, text })),
  fc.tuple(lines, fc.integer({ min: 0, max: 5000 })).map(([text, ms]) => ({ kind: 'slowText' as const, text, ms })),
);

function makeProvider(b: Behavior, i: number): CoachProvider {
  const name = `p${i}`;
  return {
    name,
    generate: (_input, { signal }) => {
      switch (b.kind) {
        case 'throw':
          throw new Error('boom');
        case 'reject':
          return Promise.reject(new Error('boom'));
        case 'hang':
          return new Promise<string>(() => undefined);
        case 'lateIgnoringAbort':
          return new Promise<string>((resolve) => setTimeout(() => resolve('Late but valid.'), b.ms));
        case 'nonString':
          return Promise.resolve(b.value as string);
        case 'text':
          return Promise.resolve(b.text);
        case 'slowText':
          return new Promise<string>((resolve, reject) => {
            const t = setTimeout(() => resolve(b.text), b.ms);
            signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new Error('aborted'));
            });
          });
      }
    },
  };
}

type Spend = 'true' | 'false' | 'throw' | 'reject' | 'hang';
function makeSpend(s: Spend): () => Promise<boolean> {
  return () => {
    if (s === 'throw') throw new Error('db');
    if (s === 'reject') return Promise.reject(new Error('db'));
    if (s === 'hang') return new Promise<boolean>(() => undefined);
    return Promise.resolve(s === 'true');
  };
}

const inputArb: fc.Arbitrary<CoachInput> = fc.record({
  event: fc.constantFrom(...COACH_EVENTS),
  xpGained: fc.integer({ min: 0, max: 360 }),
  level: fc.integer({ min: 1, max: 99 }),
  streak: fc.integer({ min: 0, max: 999 }),
  topStat: fc.constantFrom(...COACH_STATS),
  timeBucket: fc.constantFrom(...TIME_BUCKETS),
  tone: fc.constantFrom(...TONES),
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('orchestrator properties (property 8b)', () => {
  it('always returns a non-empty, valid, dash-free line and leaves no timers', async () => {
    await fc.assert(
      fc.asyncProperty(
        inputArb,
        fc.array(behavior, { maxLength: 4 }),
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom<Spend[]>('true', 'true', 'false', 'throw', 'reject', 'hang'),
        fc.string(),
        async (input, behaviors, online, aiEnabled, spend, seed) => {
          const providers = behaviors.map(makeProvider);
          const promise = generateCoachLine({
            input,
            providers,
            online,
            aiEnabled,
            spendAiCall: makeSpend(spend),
            seed,
          });
          await vi.advanceTimersByTimeAsync(10_000);
          const out = await promise;
          expect(out.text.length).toBeGreaterThan(0);
          expect(validateCoachText(out.text)).toEqual({ ok: true, text: out.text });
          expect(containsDash(out.text)).toBe(false);
          if (out.source === 'ai') {
            expect(providers.map((p) => p.name)).toContain(out.provider);
            expect(online && aiEnabled && spend === 'true').toBe(true);
          } else {
            expect(out.provider).toBeUndefined();
          }
          expect(vi.getTimerCount()).toBe(0);
        },
      ),
      { numRuns: 300 },
    );
  });
});
