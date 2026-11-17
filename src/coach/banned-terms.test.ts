import { describe, expect, it } from 'vitest';
import { LONG_STEMS, PHRASES, SHORT_TERM_FORMS } from './banned-terms';

/** Plain endings s, es, d, ed, ing, y with the usual spelling rules. */
function plainForms(term: string): string[] {
  const endsInE = term.endsWith('e');
  const base = endsInE ? term.slice(0, -1) : term;
  // Short consonant-vowel-consonant words double the last letter (fat, fatted).
  const doubled = /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(term) && term.length === 3 ? term + term.at(-1) : term;
  const plural = /(s|x|z|ch|sh)$/.test(term) ? `${term}es` : `${term}s`;
  const past = endsInE ? `${term}d` : `${doubled}ed`;
  const ing = endsInE ? `${base}ing` : `${doubled}ing`;
  const forms = [term, plural, past, ing];
  if (!endsInE) forms.push(`${doubled}y`);
  return forms;
}

describe('banned term data', () => {
  it('lists every plain-ending form of each short term', () => {
    for (const [term, forms] of Object.entries(SHORT_TERM_FORMS)) {
      const expected = term === 'bmi' ? ['bmi', 'bmis'] : plainForms(term);
      expect([...forms].sort(), term).toEqual(expected.sort());
    }
  });

  it('includes the forms named in the decision log', () => {
    const all = Object.values(SHORT_TERM_FORMS).flat();
    for (const f of ['treat', 'treats', 'treated', 'treating', 'cure', 'cures', 'fat', 'fats', 'dose', 'doses']) {
      expect(all).toContain(f);
    }
  });

  it('includes the COACH-18 stems', () => {
    for (const s of ['treatment', 'therap', 'symptom', 'medicin', 'medicat', 'supplement', 'detox', 'starv']) {
      expect(LONG_STEMS).toContain(s);
    }
  });

  it('is lower case with no duplicates', () => {
    const entries = [...LONG_STEMS, ...Object.values(SHORT_TERM_FORMS).flat(), ...PHRASES.flat()];
    for (const e of entries) expect(e).toBe(e.toLowerCase());
    expect(new Set(LONG_STEMS).size).toBe(LONG_STEMS.length);
    const forms = Object.values(SHORT_TERM_FORMS).flat();
    expect(new Set(forms).size).toBe(forms.length);
  });
});
