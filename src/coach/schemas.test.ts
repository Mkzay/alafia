import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { STAT_ORDER } from '@/engine/types';
import type { StatId } from '@/engine/types';
import { coachInputSchema, coachOutputSchema } from './schemas';
import { COACH_STATS } from './types';
import type { CoachInput, CoachOutput, CoachStat } from './types';

const valid: CoachInput = {
  event: 'move',
  xpGained: 45,
  level: 2,
  streak: 1,
  topStat: 'endurance',
  timeBucket: 'morning',
  tone: 'warm',
};
const ok = (v: unknown) => coachInputSchema.safeParse(v).success;

describe('coachInputSchema', () => {
  it('accepts a valid input', () => {
    expect(ok(valid)).toBe(true);
  });

  it('allows xpGained 0 to 360', () => {
    expect([0, 300, 360].map((xpGained) => ok({ ...valid, xpGained }))).toEqual([true, true, true]);
    expect([-1, 361, 1.5].map((xpGained) => ok({ ...valid, xpGained }))).toEqual([false, false, false]);
  });

  it('checks level and streak ranges', () => {
    expect([0, 1, 99, 100].map((level) => ok({ ...valid, level }))).toEqual([false, true, true, false]);
    expect([-1, 0, 999, 1000].map((streak) => ok({ ...valid, streak }))).toEqual([false, true, true, false]);
  });

  it('rejects extra keys and missing keys', () => {
    expect(ok({ ...valid, name: 'Ada' })).toBe(false);
    expect(ok({ ...valid, note: 'ate jollof' })).toBe(false);
    const { tone: _tone, ...missing } = valid;
    void _tone;
    expect(ok(missing)).toBe(false);
  });

  it('rejects values outside the enums', () => {
    expect(ok({ ...valid, event: 'binge' })).toBe(false);
    expect(ok({ ...valid, topStat: 'charisma' })).toBe(false);
    expect(ok({ ...valid, timeBucket: 'noon' })).toBe(false);
    expect(ok({ ...valid, tone: 'angry' })).toBe(false);
  });
});

describe('coachOutputSchema', () => {
  it('checks text length, source and extra keys', () => {
    const out = { text: 'Nice.', source: 'ai', provider: 'groq' };
    expect(coachOutputSchema.safeParse(out).success).toBe(true);
    expect(coachOutputSchema.safeParse({ ...out, text: '' }).success).toBe(false);
    expect(coachOutputSchema.safeParse({ ...out, text: 'a'.repeat(241) }).success).toBe(false);
    expect(coachOutputSchema.safeParse({ ...out, source: 'human' }).success).toBe(false);
    expect(coachOutputSchema.safeParse({ ...out, extra: 1 }).success).toBe(false);
  });
});

describe('types stay in sync', () => {
  it('schemas match the interfaces', () => {
    expectTypeOf<z.infer<typeof coachInputSchema>>().toEqualTypeOf<CoachInput>();
    expectTypeOf<z.infer<typeof coachOutputSchema>>().toEqualTypeOf<CoachOutput>();
  });

  it('coach stats match the engine stats', () => {
    expectTypeOf<CoachStat>().toEqualTypeOf<StatId>();
    expect(COACH_STATS).toEqual(STAT_ORDER);
  });
});
