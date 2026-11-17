import { describe, expect, it } from 'vitest';
import { QUEST_DEFINITIONS } from '@/engine/quests';
import { containsDash } from './dashes';
import {
  ALLOWED_TOKENS,
  daysLabel,
  FALLBACK_LINE,
  linesFor,
  pickTemplate,
  renderTemplate,
  TEMPLATE_LINES,
  ZERO_XP_LINES,
} from './templates';
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
const zeroLines = (['move', 'eat', 'rest'] as const).flatMap((e) => ZERO_XP_LINES[e]);
const allLines = [...COACH_EVENTS.flatMap((e) => TEMPLATE_LINES[e]), ...zeroLines];

/** Every "N day(s)" in a text uses the right plural. "N day streak" is an adjective and is fine. */
function pluralMistakes(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(/(\d+) (days?)\b( streak)?/g)) {
    const [whole, n, word, adjective] = m;
    if (adjective) {
      if (word !== 'day') bad.push(whole);
    } else if ((Number(n) === 1) !== (word === 'day')) {
      bad.push(whole);
    }
  }
  return bad;
}

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
      const zero = e === 'move' || e === 'eat' || e === 'rest' ? ZERO_XP_LINES[e] : [];
      for (const [xp, level, streak] of EXTREMES) {
        for (const line of [...TEMPLATE_LINES[e], ...zero]) {
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

describe('zero XP', () => {
  it('has at least 5 zero-XP lines for move, eat and rest, none using {xp}', () => {
    for (const e of ['move', 'eat', 'rest'] as const) {
      expect(ZERO_XP_LINES[e].length, e).toBeGreaterThanOrEqual(5);
      for (const line of ZERO_XP_LINES[e]) expect(line).not.toContain('{xp}');
    }
  });

  it('uses the zero-XP set for log events when xpGained is 0', () => {
    for (const e of ['move', 'eat', 'rest'] as const) {
      expect(linesFor(input(e, 0, 3, 2))).toBe(ZERO_XP_LINES[e]);
      expect(linesFor(input(e, 1, 3, 2))).toBe(TEMPLATE_LINES[e]);
    }
  });

  it('never shows an XP amount when xpGained is 0', () => {
    for (const e of COACH_EVENTS) {
      expect(linesFor(input(e, 0, 3, 2)).length, e).toBeGreaterThanOrEqual(5);
      for (let n = 0; n < 60; n++) {
        const out = pickTemplate(input(e, 0, 3, 2), `seed-${n}`);
        expect(out, out).not.toMatch(/\b0 XP\b|\+0\b/);
      }
    }
  });

  it('avoids repeating the last zero-XP line', () => {
    const i = input('rest', 0, 2, 1);
    for (let n = 0; n < 30; n++) {
      const first = pickTemplate(i, `s${n}`);
      expect(pickTemplate(i, `s${n}`, first)).not.toBe(first);
    }
  });
});

describe('day plurals', () => {
  it('labels 1 day and N days', () => {
    expect([0, 1, 2, 30].map(daysLabel)).toEqual(['0 days', '1 day', '2 days', '30 days']);
  });

  it('renders {days} with the right plural', () => {
    expect(renderTemplate('{days} in a row.', input('streak', 10, 2, 1))).toBe('1 day in a row.');
    expect(renderTemplate('{days} in a row.', input('streak', 10, 2, 2))).toBe('2 days in a row.');
  });

  it('every streak line reads correctly for 0 to 40 days', () => {
    for (let streak = 0; streak <= 40; streak++) {
      for (const line of TEMPLATE_LINES.streak) {
        const out = renderTemplate(line, input('streak', 10, 2, streak));
        expect(pluralMistakes(out), out).toEqual([]);
      }
    }
  });

  it('no line hard-codes "{streak} days"', () => {
    for (const line of allLines) expect(line, line).not.toMatch(/\{streak\} days\b/);
  });

  it('the checker itself catches mistakes', () => {
    expect(pluralMistakes('1 days in a row')).toEqual(['1 days']);
    expect(pluralMistakes('3 day in a row')).toEqual(['3 day']);
    expect(pluralMistakes('3 days streak')).toEqual(['3 days streak']);
    expect(pluralMistakes('3 day streak, 1 day, 2 days')).toEqual([]);
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
