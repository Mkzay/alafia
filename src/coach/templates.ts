import { fnv1a } from './hash';
import { FALLBACK_LINE, TEMPLATE_LINES, ZERO_XP_LINES } from './template-lines';
import type { CoachInput } from './types';

export { FALLBACK_LINE, TEMPLATE_LINES, ZERO_XP_LINES };

export const ALLOWED_TOKENS = ['xp', 'level', 'streak', 'days'] as const;
type Token = (typeof ALLOWED_TOKENS)[number];
const TOKEN = /\{(xp|level|streak|days)\}/g;
const XP_TOKEN = '{xp}';

/** "1 day", "2 days", "0 days". */
export function daysLabel(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

export function renderTemplate(line: string, input: CoachInput): string {
  return line.replace(TOKEN, (_, name: Token) => {
    if (name === 'xp') return String(input.xpGained);
    if (name === 'level') return String(input.level);
    if (name === 'days') return daysLabel(input.streak);
    return String(input.streak);
  });
}

/** The lines that may be shown for this input, before rendering. */
export function linesFor(input: CoachInput): readonly string[] {
  if (input.xpGained === 0) {
    if (input.event === 'move' || input.event === 'eat' || input.event === 'rest') {
      return ZERO_XP_LINES[input.event];
    }
    return (TEMPLATE_LINES[input.event] ?? []).filter((line) => !line.includes(XP_TOKEN));
  }
  return TEMPLATE_LINES[input.event] ?? [];
}

/** Seeded, deterministic pick that never repeats lastText. */
export function pickTemplate(input: CoachInput, seed: string, lastText?: string): string {
  const rendered = linesFor(input).map((line) => renderTemplate(line, input));
  const candidates = rendered.filter((line) => line !== lastText);
  if (candidates.length === 0) return FALLBACK_LINE;
  return candidates[fnv1a(`${seed}|${input.event}`) % candidates.length];
}
