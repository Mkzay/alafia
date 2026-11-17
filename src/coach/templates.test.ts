import { describe, expect, it } from 'vitest';
import { QUEST_DEFINITIONS } from '@/engine/quests';
import { containsDash } from './dashes';
import { ALLOWED_TOKENS, FALLBACK_LINE, pickTemplate, renderTemplate, TEMPLATE_LINES } from './templates';
import { COACH_EVENTS } from './types';
import type { CoachEvent, CoachInput } from './types';
import { validateCoachText } from './validate';

const input = (event: CoachEvent, xpGained: number, level: number, streak: number): CoachInput => ({
  event,
  xpGained,
  level,
  streak,
  topStat: 'strength',
  timeBucket: 'morning',
  tone: 'warm',
});
const EXTREMES = [
  [360, 99, 999],
  [0, 1, 0],
] as const;
const PRESSURE = [/\bburn/i, /\bshred/i, /\bcheat/i, /\bgrind/i, /no excuses/i, /\bmissed\b/i, /\blazy\b/i, /\bshould have\b/i, /\bonly\b.*\bhours\b/i];
const allLines = COACH_EVENTS.flatMap((e) => TEMPLATE_LINES[e]);

describe('template counts', () => {
  it('has at least 5 lines per event and 40 in total', () => {
    for (const e of COACH_EVENTS) expect(TEMPLATE_LINES[e].length, e).toBeGreaterThanOrEqual(5);
    expect(allLines.length).toBeGreaterThanOrEqual(40);
    expect(Object.keys(TEMPLATE_LINES).sort()).toEqual([...COACH_EVENTS].sort());
  });

  it('has no duplicate lines', () => {
    expect(new Set(allLines).size).toBe(allLines.length);
  });
});

describe('template rules', () => {
  it('uses only allowed tokens', () => {
    for (const line of allLines) {
      for (const [, name] of line.matchAll(/\{([^}]*)\}/g)) {
        expect(ALLOWED_TOKENS as readonly string[], `${line}`).toContain(name);
      }
    }
  });

  it('every line passes the validator unchanged at both extremes', () => {
    for (const e of COACH_EVENTS) {
      for (const [xp, level, streak] of EXTREMES) {
        for (const line of TEMPLATE_LINES[e]) {
          const rendered = renderTemplate(line, input(e, xp, level, streak));
          expect(validateCoachText(rendered), rendered).toEqual({ ok: true, text: rendered });
        }
      }
    }
  });

  it('FALLBACK_LINE passes the validator', () => {
    expect(validateCoachText(FALLBACK_LINE)).toEqual({ ok: true, text: FALLBACK_LINE });
  });

  it('has no dashes in lines, the fallback or quest titles', () => {
    const texts = [...allLines, FALLBACK_LINE, ...Object.values(QUEST_DEFINITIONS).map((q) => q.title)];
    for (const t of texts) {
      expect(containsDash(t), t).toBe(false);
      expect(t, t).not.toMatch(/\s-\s/);
    }
  });

  it('uses no pressure or judging words', () => {
    for (const t of [...allLines, FALLBACK_LINE]) {
      for (const p of PRESSURE) expect(t, `${t} matches ${p}`).not.toMatch(p);
    }
  });
});

describe('rendering', () => {
  it('fills every token', () => {
    expect(renderTemplate('{xp} {level} {streak}', input('move', 45, 3, 7))).toBe('45 3 7');
    expect(renderTemplate('Level {level}! Level {level}.', input('level_up', 0, 12, 0))).toBe('Level 12! Level 12.');
  });

  it('keeps rendered lines of an event distinct at both extremes', () => {
    for (const e of COACH_EVENTS) {
      for (const [xp, level, streak] of EXTREMES) {
        const rendered = TEMPLATE_LINES[e].map((l) => renderTemplate(l, input(e, xp, level, streak)));
        expect(new Set(rendered).size, e).toBe(rendered.length);
      }
    }
  });
});

describe('pickTemplate', () => {
  it('is deterministic for the same seed', () => {
    const i = input('move', 45, 2, 1);
    expect(pickTemplate(i, 'log-1')).toBe(pickTemplate(i, 'log-1'));
  });

  it('varies with the seed', () => {
    const i = input('eat', 25, 2, 1);
    const picks = new Set(Array.from({ length: 50 }, (_, n) => pickTemplate(i, `seed-${n}`)));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('never repeats the last line', () => {
    for (const e of COACH_EVENTS) {
      const i = input(e, 45, 5, 3);
      for (let n = 0; n < 30; n++) {
        const first = pickTemplate(i, `s${n}`);
        expect(pickTemplate(i, `s${n}`, first), e).not.toBe(first);
      }
    }
  });

  it('returns a line for the given event', () => {
    const i = input('rest', 40, 2, 1);
    const options = TEMPLATE_LINES.rest.map((l) => renderTemplate(l, i));
    expect(options).toContain(pickTemplate(i, 'x'));
  });
});
