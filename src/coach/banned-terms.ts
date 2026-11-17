/**
 * Words the coach must never say. Edit this file to extend the list.
 * All entries are lower case. Matching is case-insensitive on NFKC-normalized text.
 */

/** Match anywhere in the text, so every form is caught (therapist, starvation, ...). */
export const LONG_STEMS: readonly string[] = [
  'diagnos',
  'prescri',
  'medicat',
  'medicin',
  'dosage',
  'disease',
  'calorie',
  'kcal',
  'skinny',
  'obese',
  'treatment',
  'therap',
  'symptom',
  'supplement',
  'detox',
  'starv',
];

/**
 * Match as whole words. Each short term lists its plain endings (s, es, d, ed, ing, y)
 * written out, so the list can be reviewed. A test checks them against the ending rules.
 */
export const SHORT_TERM_FORMS: Readonly<Record<string, readonly string[]>> = {
  treat: ['treat', 'treats', 'treated', 'treating', 'treaty'],
  cure: ['cure', 'cures', 'cured', 'curing'],
  fat: ['fat', 'fats', 'fatted', 'fatting', 'fatty'],
  dose: ['dose', 'doses', 'dosed', 'dosing'],
  bmi: ['bmi', 'bmis'],
};

/** Match as whole words, joined by spaces, hyphens or underscores. */
export const PHRASES: readonly (readonly string[])[] = [
  ['lose', 'weight'],
  ['weight', 'loss'],
  ['you', 'must'],
  ['you', 'should', 'stop'],
];
