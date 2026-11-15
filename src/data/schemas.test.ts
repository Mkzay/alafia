import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Log } from '@/engine/types';
import {
  coachMessageSchema,
  exportSchema,
  localDateSchema,
  logSchema,
  newLogInputSchema,
  settingDefaults,
} from './schemas';
import type { StoredLog } from './schemas';

const base = { id: 'a', loggedAt: 1, localDate: '2026-11-14', localMinutes: 600 };
const move = (o: object = {}) => ({ type: 'move', kind: 'cardio', minutes: 30, intensity: 'light', ...o });
const rest = (o: object = {}) => ({ type: 'rest', hours: 8, quality: 3, ...o });
const eat = (o: object = {}) => ({
  type: 'eat',
  slot: 'lunch',
  checks: { protein: true, veggies: true, fiberCarb: false, water: false },
  ...o,
});

const okInput = (v: unknown) => newLogInputSchema.safeParse(v).success;
const okLog = (v: unknown) => logSchema.safeParse(v).success;

describe('localDateSchema', () => {
  it('accepts real dates and rejects others', () => {
    expect(localDateSchema.safeParse('2026-11-14').success).toBe(true);
    expect(localDateSchema.safeParse('2028-02-29').success).toBe(true);
    expect(localDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(localDateSchema.safeParse('2026-13-01').success).toBe(false);
    expect(localDateSchema.safeParse('2026-1-1').success).toBe(false);
    expect(localDateSchema.safeParse('not a date').success).toBe(false);
  });
});

describe('move input', () => {
  it('limits minutes to 1..300', () => {
    expect([0, 1, 300, 301].map((minutes) => okInput(move({ minutes })))).toEqual([false, true, true, false]);
  });
  it('rejects fractional minutes and bad enums', () => {
    expect(okInput(move({ minutes: 20.5 }))).toBe(false);
    expect(okInput(move({ kind: 'yoga' }))).toBe(false);
    expect(okInput(move({ intensity: 'extreme' }))).toBe(false);
  });
});

describe('rest input', () => {
  it('limits hours to 0..14 in steps of 0.5', () => {
    expect([0, 0.5, 14, 14.5, 0.25, -1].map((hours) => okInput(rest({ hours })))).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
  it('limits quality to 1..5', () => {
    expect([0, 1, 5, 6, 2.5].map((quality) => okInput(rest({ quality })))).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
  });
});

describe('eat input', () => {
  it('needs all four checks as booleans', () => {
    expect(okInput(eat())).toBe(true);
    expect(okInput(eat({ checks: { protein: true } }))).toBe(false);
    expect(okInput(eat({ slot: 'brunch' }))).toBe(false);
  });
});

describe('privacy', () => {
  it('rejects calories and weight keys on input', () => {
    expect(okInput(eat({ calories: 500 }))).toBe(false);
    expect(okInput(move({ weightKg: 70 }))).toBe(false);
    expect(okInput(eat({ checks: { protein: true, veggies: true, fiberCarb: true, water: true, grams: 100 } }))).toBe(false);
  });
});

describe('stored log', () => {
  it('accepts valid logs and strips unknown keys', () => {
    const parsed = logSchema.parse({ ...base, ...move(), calories: 9 });
    expect('calories' in parsed).toBe(false);
  });
  it('checks base fields', () => {
    expect(okLog({ ...base, ...move() })).toBe(true);
    expect(okLog({ ...base, ...move(), localMinutes: 1440 })).toBe(false);
    expect(okLog({ ...base, ...move(), localMinutes: -1 })).toBe(false);
    expect(okLog({ ...base, ...move(), localDate: '2026-02-30' })).toBe(false);
    expect(okLog({ ...base, ...move(), id: '' })).toBe(false);
    expect(okLog({ ...base, ...move(), loggedAt: 0 })).toBe(false);
    expect(okLog({ ...base, type: 'swim' })).toBe(false);
  });
});

describe('coach message', () => {
  const m = { id: 'x', logId: 'a', text: 'Nice one.', source: 'template', createdAt: 5 };
  it('limits text to 1..240 characters', () => {
    expect(coachMessageSchema.safeParse(m).success).toBe(true);
    expect(coachMessageSchema.safeParse({ ...m, text: '' }).success).toBe(false);
    expect(coachMessageSchema.safeParse({ ...m, text: 'a'.repeat(241) }).success).toBe(false);
    expect(coachMessageSchema.safeParse({ ...m, source: 'robot' }).success).toBe(false);
  });
});

describe('defaults and export', () => {
  it('builds settings defaults for a date', () => {
    expect(settingDefaults('2026-11-14')).toEqual({
      aiEnabled: true,
      aiBudget: { date: '2026-11-14', used: 0 },
      firstRunAcknowledged: false,
    });
  });
  it('parses a valid export document', () => {
    const doc = {
      format: 'alafia-export',
      version: 1,
      exportedAt: 10,
      logs: [{ ...base, ...move() }],
      coachMessages: [],
      settings: settingDefaults('2026-11-14'),
    };
    expect(exportSchema.safeParse(doc).success).toBe(true);
    expect(exportSchema.safeParse({ ...doc, version: 2 }).success).toBe(false);
  });
});

describe('engine compatibility', () => {
  it('stored log types and engine Log types match', () => {
    expectTypeOf<StoredLog>().toEqualTypeOf<Log>();
  });
});
