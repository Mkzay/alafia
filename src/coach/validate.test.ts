import { describe, expect, it } from 'vitest';
import { LONG_STEMS, PHRASES, SHORT_TERM_FORMS } from './banned-terms';
import { countSentences, validateCoachText } from './validate';

const accepts = (t: unknown) => validateCoachText(t).ok;
const reason = (t: unknown) => {
  const r = validateCoachText(t);
  return r.ok ? 'ok' : r.reason;
};

describe('length', () => {
  it('needs 1 to 240 characters after trimming', () => {
    expect(reason('')).toBe('empty');
    expect(reason('   \n ')).toBe('empty');
    expect(reason('A')).toBe('ok');
    expect(reason('a'.repeat(240))).toBe('ok');
    expect(reason('a'.repeat(241))).toBe('too_long');
    expect(reason(`  ${'a'.repeat(240)}  `)).toBe('ok');
  });
});

describe('sentences', () => {
  it('counts sentences', () => {
    expect(countSentences('Nice work')).toBe(1);
    expect(countSentences('Nice work.')).toBe(1);
    expect(countSentences('Nice work. Rest well.')).toBe(2);
    expect(countSentences('One. Two. Three.')).toBe(3);
    expect(countSentences('Wait... what?! Yes.')).toBe(3);
    expect(countSentences('You slept 7.5 hours. Lovely.')).toBe(2);
    expect(countSentences('Nice work\u2026 rest well')).toBe(2);
  });

  it('allows at most two', () => {
    expect(reason('Nice work. Rest well.')).toBe('ok');
    expect(reason('Nice work. Rest well. See you.')).toBe('too_many_sentences');
    expect(reason('Nice work. Rest well')).toBe('ok');
    expect(reason('Nice. Good. Ok')).toBe('too_many_sentences');
  });
});

describe('banned terms', () => {
  it('rejects every long stem anywhere in the text', () => {
    for (const stem of LONG_STEMS) {
      expect(reason(`Nice ${stem}ing work.`), stem).toBe('banned_term');
    }
    for (const word of ['treatments', 'therapist', 'symptomatic', 'medicinal', 'medications', 'supplemented', 'detoxing', 'starvation', 'starve']) {
      expect(reason(`A word: ${word}.`), word).toBe('banned_term');
    }
  });

  it('rejects every short-term form as a whole word', () => {
    for (const form of Object.values(SHORT_TERM_FORMS).flat()) {
      expect(reason(`So ${form} today.`), form).toBe('banned_term');
      expect(reason(`So ${form.toUpperCase()} today.`), form).toBe('banned_term');
    }
  });

  it('rejects phrases with any joiner', () => {
    for (const words of PHRASES) {
      expect(reason(`Nice, ${words.join(' ')} now.`)).toBe('banned_term');
      expect(reason(`Nice, ${words.join('   ')} now.`)).toBe('banned_term');
      expect(reason(`Nice, ${words.join('-')} now.`)).toBe('banned_term');
    }
  });

  it('treats hyphens and apostrophes as word boundaries', () => {
    expect(reason('Go fat-free today.')).toBe('banned_term');
    expect(reason("That fat's gone.")).toBe('banned_term');
  });

  it('passes near misses', () => {
    for (const t of ['Fatigue happens, rest well.', 'A secure habit is growing.', 'That was a fantastic walk.', 'Your dossier of wins grows.', 'Big curiosity today.', 'Retreating to bed is fine.']) {
      expect(reason(t), t).toBe('ok');
    }
  });

  it('sees through NFKC look-alikes and zero-width characters', () => {
    expect(reason('That is \uFF46\uFF41\uFF54.')).toBe('banned_term');
    expect(reason('f\u200Bat chance.')).toBe('banned_term');
    expect(reason('cal\u00ADorie count.')).toBe('banned_term');
    expect(reason('you\u2060 must rest.')).toBe('banned_term');
  });
});

describe('urls and markdown', () => {
  it('rejects URLs', () => {
    expect(reason('See https://x.org now.')).toBe('url');
    expect(reason('Visit www.example.ng.')).toBe('url');
    expect(reason('Read more at example.com.')).toBe('url');
    expect(reason('Nice [link](http://a.io).')).toBe('url');
  });

  it('strips markdown and returns the cleaned text', () => {
    expect(validateCoachText('**Great** walk, _well_ done!')).toEqual({ ok: true, text: 'Great walk, well done!' });
    expect(validateCoachText('# Level up\n> Keep going')).toEqual({ ok: true, text: 'Level up Keep going' });
    expect(validateCoachText('- `Nice`   work')).toEqual({ ok: true, text: 'Nice work' });
    expect(reason('** __ ~~')).toBe('empty');
  });
});

describe('design examples (C2.7)', () => {
  it('rejects the listed lines', () => {
    for (const t of [
      'Nice session, you must rest.',
      'Great for weight loss!',
      'That is a lot of fat.',
      'Treat yourself to rest.',
      'Small treats add up.',
      'Rest cures a lot.',
      'Two doses of water.',
      'Check the BMI.',
      'Read more at www.example.com.',
    ]) {
      expect(accepts(t), t).toBe(false);
    }
  });

  it('accepts the listed lines', () => {
    for (const t of ['Fatigue happens, rest well.', 'A secure habit is growing.', 'You moved for 30 minutes. Nice work.']) {
      expect(accepts(t), t).toBe(true);
    }
  });
});

describe('non-strings', () => {
  it('never throws', () => {
    for (const v of [undefined, null, 42, {}, [], Symbol('x'), () => 'hi']) {
      expect(reason(v)).toBe('not_text');
    }
  });
});
