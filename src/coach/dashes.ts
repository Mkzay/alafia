/**
 * Dash normalizer. Runs on AI text before validation (COACH-3).
 * A dash between two digits becomes "-". Any other dash becomes ", ".
 */

/** Figure, en, em, horizontal bar, two-em, three-em, presentation em and en, small em. */
export const DASH_CHARS = '\u2012\u2013\u2014\u2015\u2E3A\u2E3B\uFE31\uFE32\uFE58';

const D = `[${DASH_CHARS}]`;
const PUNCT = '[.,!?;:\u2026]';

const DIGIT_RANGE = new RegExp(`(\\d)\\s*${D}+\\s*(?=\\d)`, 'g');
const LEADING = new RegExp(`^\\s*${D}+\\s*`);
const TRAILING = new RegExp(`\\s*${D}+\\s*$`);
const BEFORE_PUNCT = new RegExp(`\\s*${D}+\\s*(?=${PUNCT})`, 'g');
const AFTER_PUNCT = new RegExp(`(${PUNCT})\\s*${D}+\\s*`, 'g');
const ANY = new RegExp(`\\s*${D}+\\s*`, 'g');
const COMMA_RUN = /,(?:\s*,)+/g;
const HAS_DASH = new RegExp(D);

export function containsDash(text: string): boolean {
  return HAS_DASH.test(text);
}

export function normalizeDashes(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(DIGIT_RANGE, '$1-')
    .replace(LEADING, '')
    .replace(TRAILING, '')
    .replace(BEFORE_PUNCT, '')
    .replace(AFTER_PUNCT, '$1 ')
    .replace(ANY, ', ')
    .replace(COMMA_RUN, ',');
}
