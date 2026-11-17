import { fnv1a } from './hash';
import { FALLBACK_LINE, TEMPLATE_LINES } from './template-lines';
import type { CoachInput } from './types';

export { FALLBACK_LINE, TEMPLATE_LINES };

export const ALLOWED_TOKENS = ['xp', 'level', 'streak'] as const;
const TOKEN = /\{(xp|level|streak)\}/g;

export function renderTemplate(line: string, input: CoachInput): string {
  return line.replace(TOKEN, (_, name: (typeof ALLOWED_TOKENS)[number]) => {
    if (name === 'xp') return String(input.xpGained);
    if (name === 'level') return String(input.level);
    return String(input.streak);
  });
}

/** Seeded, deterministic pick that never repeats lastText. */
export function pickTemplate(input: CoachInput, seed: string, lastText?: string): string {
  const rendered = (TEMPLATE_LINES[input.event] ?? []).map((line) => renderTemplate(line, input));
  const candidates = rendered.filter((line) => line !== lastText);
  if (candidates.length === 0) return FALLBACK_LINE;
  return candidates[fnv1a(`${seed}|${input.event}`) % candidates.length];
}
