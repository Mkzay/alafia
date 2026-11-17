import { describe, expect, it } from 'vitest';
import { containsDash, DASH_CHARS, normalizeDashes } from './dashes';
import { validateCoachText } from './validate';

describe('normalizeDashes', () => {
  it('replaces every dash character', () => {
    for (const d of DASH_CHARS) {
      const out = normalizeDashes(`Nice work ${d} rest well`);
      expect(out, `U+${d.codePointAt(0)?.toString(16)}`).toBe('Nice work, rest well');
      expect(containsDash(out)).toBe(false);
    }
  });

  it('turns digit ranges into a hyphen', () => {
    expect(normalizeDashes('Try 3\u20135 minutes')).toBe('Try 3-5 minutes');
    expect(normalizeDashes('Try 3 \u2013 5 minutes')).toBe('Try 3-5 minutes');
    expect(normalizeDashes('Level 2\u20143 soon')).toBe('Level 2-3 soon');
  });

  it('turns word joins into a comma', () => {
    expect(normalizeDashes('rest\u2014well')).toBe('rest, well');
    expect(normalizeDashes('Good move \u2014 keep it up.')).toBe('Good move, keep it up.');
    expect(normalizeDashes('Good \u2013 steady')).toBe('Good, steady');
  });

  it('removes dashes at the edges and next to punctuation', () => {
    expect(normalizeDashes('\u2014 Nice start.')).toBe('Nice start.');
    expect(normalizeDashes('Nice start \u2014')).toBe('Nice start');
    expect(normalizeDashes('Nice start \u2014.')).toBe('Nice start.');
    expect(normalizeDashes('Done. \u2014 Next up.')).toBe('Done. Next up.');
    expect(normalizeDashes('Well done \u2014, really.')).toBe('Well done, really.');
  });

  it('collapses repeated dashes and commas', () => {
    expect(normalizeDashes('a \u2014\u2014 b')).toBe('a, b');
    expect(normalizeDashes('a \u2014 \u2014 b')).toBe('a, b');
    expect(normalizeDashes('a, \u2014 b')).toBe('a, b');
  });

  it('leaves hyphens and normal text alone', () => {
    expect(normalizeDashes('A well-earned rest.')).toBe('A well-earned rest.');
    expect(normalizeDashes('Plain text.')).toBe('Plain text.');
  });

  it('is idempotent and handles non-strings', () => {
    const once = normalizeDashes('Big day \u2014 level up \u2013 3\u20134 quests.');
    expect(normalizeDashes(once)).toBe(once);
    expect(normalizeDashes(undefined)).toBe('');
    expect(normalizeDashes(42)).toBe('');
  });

  it('feeds the validator', () => {
    expect(validateCoachText(normalizeDashes('Great walk \u2014 rest well.'))).toEqual({
      ok: true,
      text: 'Great walk, rest well.',
    });
    expect(validateCoachText(normalizeDashes('Great walk \u2014 good for weight loss.')).ok).toBe(false);
  });
});
