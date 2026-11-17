import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { containsDash, DASH_CHARS, normalizeDashes } from './dashes';

const piece = fc.oneof(
  fc.constantFrom(...DASH_CHARS, ' ', ',', '.', '!', '1', '9', 'a', 'Z', '-', '\n'),
  fc.string({ maxLength: 4 }),
);
const text = fc.array(piece, { maxLength: 40 }).map((parts) => parts.join(''));

describe('dash normalizer properties', () => {
  it('leaves no dash and is idempotent', () => {
    fc.assert(
      fc.property(text, (t) => {
        const once = normalizeDashes(t);
        expect(containsDash(once)).toBe(false);
        expect(normalizeDashes(once)).toBe(once);
      }),
      { numRuns: 500 },
    );
  });

  it('changes nothing in dash-free text without comma runs', () => {
    fc.assert(
      fc.property(fc.string(), (t) => {
        fc.pre(!containsDash(t) && !/,\s*,/.test(t));
        expect(normalizeDashes(t)).toBe(t);
      }),
    );
  });
});
