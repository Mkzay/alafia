import { LONG_STEMS, PHRASES, SHORT_TERM_FORMS } from './banned-terms';
import { MAX_SENTENCES, MAX_TEXT_LENGTH } from './constants';

export type ValidationReason =
  | 'not_text'
  | 'empty'
  | 'url'
  | 'too_long'
  | 'too_many_sentences'
  | 'banned_term';

export type ValidationResult = { ok: true; text: string } | { ok: false; reason: ValidationReason };

const INVISIBLE = /[\u00AD\u200B-\u200F\u2060\uFEFF]/g;
const URL_PATTERN =
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|ng|io|co|app|dev|ai|info|biz|me|xyz|edu|gov|ly|link)\b/i;
const SENTENCE_END = /[.!?\u2026]+(?=\s|$)/;

// No lookbehind, so older mobile browsers can load this module.
const WORD_START = '(?:^|[^\\p{L}\\p{N}])';
const WORD_END = '(?=$|[^\\p{L}\\p{N}])';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SHORT_FORMS_PATTERN = new RegExp(
  `${WORD_START}(?:${Object.values(SHORT_TERM_FORMS).flat().map(escapeRegex).join('|')})${WORD_END}`,
  'iu',
);
const PHRASE_PATTERNS = PHRASES.map(
  (words) => new RegExp(`${WORD_START}${words.map(escapeRegex).join('[\\s_-]+')}${WORD_END}`, 'iu'),
);

function stripMarkdown(text: string): string {
  const lines = text.split(/\r?\n/).map((line) =>
    line
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, ''),
  );
  return lines
    .join(' ')
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=$|[\s).,!?;:])/g, '$1$2')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countSentences(text: string): number {
  return text.split(SENTENCE_END).filter((part) => part.trim() !== '').length;
}

export function containsBannedTerm(text: string): boolean {
  const lower = text.toLowerCase();
  if (LONG_STEMS.some((stem) => lower.includes(stem))) return true;
  if (SHORT_FORMS_PATTERN.test(lower)) return true;
  return PHRASE_PATTERNS.some((p) => p.test(lower));
}

/** Design section 6. Never throws. Returns the cleaned text when valid. */
export function validateCoachText(raw: unknown): ValidationResult {
  try {
    if (typeof raw !== 'string') return { ok: false, reason: 'not_text' };
    const normalized = raw.normalize('NFKC').replace(INVISIBLE, '');
    if (URL_PATTERN.test(normalized)) return { ok: false, reason: 'url' };
    const text = stripMarkdown(normalized);
    if (text.length === 0) return { ok: false, reason: 'empty' };
    if (text.length > MAX_TEXT_LENGTH) return { ok: false, reason: 'too_long' };
    if (countSentences(text) > MAX_SENTENCES) return { ok: false, reason: 'too_many_sentences' };
    if (containsBannedTerm(text)) return { ok: false, reason: 'banned_term' };
    return { ok: true, text };
  } catch {
    return { ok: false, reason: 'not_text' };
  }
}
