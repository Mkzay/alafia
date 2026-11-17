import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LONG_STEMS, PHRASES, SHORT_TERM_FORMS } from './banned-terms';
import { containsBannedTerm, countSentences, validateCoachText } from './validate';

const SAFE_WORDS = ['nice', 'walk', 'rest', 'well', 'done', 'level', 'steady', 'good', 'move', 'today'];
const BANNED = [
  ...LONG_STEMS,
  ...Object.values(SHORT_TERM_FORMS).flat(),
  ...PHRASES.map((p) => p.join(' ')),
];

const randomCase = (s: string, mask: number) =>
  [...s].map((c, i) => ((mask >> i % 31) & 1 ? c.toUpperCase() : c)).join('');

describe('validator properties (property 8a)', () => {
  it('anything accepted is short, clean and at most two sentences', () => {
    const text = fc.oneof(
      fc.string({ maxLength: 300 }),
      fc.string({ unit: 'grapheme', maxLength: 300 }),
      fc.array(fc.constantFrom(...SAFE_WORDS, ...BANNED, '.', '!', ' ', '\n', '**'), { maxLength: 80 }).map((w) => w.join(' ')),
    );
    fc.assert(
      fc.property(text, (t) => {
        const r = validateCoachText(t);
        if (!r.ok) return;
        expect(r.text.length).toBeGreaterThan(0);
        expect(r.text.length).toBeLessThanOrEqual(240);
        expect(countSentences(r.text)).toBeLessThanOrEqual(2);
        expect(containsBannedTerm(r.text)).toBe(false);
        expect(r.text).toBe(r.text.trim());
      }),
      { numRuns: 1000 },
    );
  });

  it('a banned term inserted in a clean line is always rejected', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...SAFE_WORDS), { minLength: 1, maxLength: 6 }),
        fc.constantFrom(...BANNED),
        fc.nat(),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (words, term, at, mask) => {
          const i = at % (words.length + 1);
          const line = [...words.slice(0, i), randomCase(term, mask), ...words.slice(i)].join(' ') + '.';
          expect(validateCoachText(line).ok).toBe(false);
        },
      ),
    );
  });
});
